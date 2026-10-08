import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createExchangeService } from '../../src/exchanges/service.js';

const query = vi.fn();
const service = createExchangeService({ query });
beforeEach(() => vi.resetAllMocks());

describe('Gestión de intercambios', () => {
  test('crea una propuesta dirigida a otro usuario por nombre', async () => {
    query.mockResolvedValue({ rows: [{ id: '7' }] });
    expect(await service.create('12', 'luis', 'Devolución de mochila')).toEqual({
      id: '7',
    });
    expect(query.mock.calls[0][0]).toContain('users.id <> $1');
    expect(query.mock.calls[0][0]).toContain('INSERT INTO object_exchanges');
    expect(query.mock.calls[0][1]).toEqual([
      '12',
      'luis',
      'Devolución de mochila',
    ]);
  });

  test('rechaza el propio usuario como destinatario', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(service.create('12', 'ana', 'Intercambio de libro')).rejects.toMatchObject({
      code: 'EXCHANGE_TARGET_INVALID',
    });
  });

  test('solo acepta la propuesta el destinatario y mientras siga pendiente', async () => {
    query.mockResolvedValue({ rows: [{ id: '7', status: 'accepted' }] });
    await service.accept('7', '15');
    expect(query.mock.calls[0][0]).toContain("receiver_id = $2 AND status = 'pending'");
    expect(query.mock.calls[0][1]).toEqual(['7', '15']);
  });

  test('solo completa tras confirmar ambas personas', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: '7',
          status: 'completed',
          initiator_confirmed_at: new Date(),
          recipient_confirmed_at: new Date(),
          completed_at: new Date(),
        },
      ],
    });
    const result = await service.confirm('7', '15');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("status = 'accepted'");
    expect(sql).toContain('giver_confirmed_at IS NOT NULL');
    expect(sql).toContain('receiver_confirmed_at IS NOT NULL');
    expect(params).toEqual(['7', '15']);
    expect(result.status).toBe('completed');
  });

  test('permite reseñar solo a participantes tras completar el intercambio', async () => {
    query.mockResolvedValue({ rows: [{ id: '3', rating: 5 }] });
    await service.review('7', '12', { rating: 5, comment: 'Todo perfecto.' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain('FROM object_exchanges');
    expect(sql).toContain('giver_id = $2 OR receiver_id = $2');
    expect(sql).toContain('CASE WHEN giver_id = $2 THEN receiver_id ELSE giver_id END');
    expect(params).toEqual(['7', '12', 5, 'Todo perfecto.']);
  });

  test('no permite editar ni duplicar una reseña', async () => {
    query.mockRejectedValue({ code: '23505' });
    await expect(
      service.review('7', '12', { rating: 5, comment: 'Repetida.' }),
    ).rejects.toMatchObject({ code: 'REVIEW_EXISTS' });
  });

  test('calcula la media y devuelve comentarios recientes', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ average_rating: '4.5', review_count: 2 }],
      })
      .mockResolvedValueOnce({ rows: [{ rating: 5, comment: 'Buen trato.' }] });
    expect(await service.getRatingSummary('12')).toEqual({
      averageRating: 4.5,
      reviewCount: 2,
      reviews: [{ rating: 5, comment: 'Buen trato.' }],
    });
  });
});
import { describe, expect, test } from 'vitest';
import {
  exchangeProposalSchema,
  exchangeReviewSchema,
} from '../../src/exchanges/validation.js';

describe('Validación de intercambios', () => {
  test('limpia y limita la descripción de la propuesta', () => {
    expect(exchangeProposalSchema.parse({ description: '  Libro  ' })).toEqual({
      description: 'Libro',
    });
    expect(
      exchangeProposalSchema.safeParse({ description: 'x'.repeat(301) }).success,
    ).toBe(false);
  });
});

describe('Validación de valoraciones', () => {
  test.each([1, 2, 3, 4, 5])('acepta %i estrellas con comentario', (rating) => {
    expect(
      exchangeReviewSchema.parse({ rating: String(rating), comment: 'Buen intercambio.' }),
    ).toEqual({ rating, comment: 'Buen intercambio.' });
  });

  test.each(['0', '6', '2.5', ''])('rechaza la valoración %s', (rating) => {
    expect(
      exchangeReviewSchema.safeParse({ rating, comment: 'Comentario.' }).success,
    ).toBe(false);
  });

  test('requiere comentario y no admite más de 1000 caracteres', () => {
    expect(exchangeReviewSchema.safeParse({ rating: '5', comment: ' ' }).success).toBe(
      false,
    );
    expect(
      exchangeReviewSchema.safeParse({ rating: '5', comment: 'x'.repeat(1001) })
        .success,
    ).toBe(false);
  });
});
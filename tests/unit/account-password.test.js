/** Cambio de contraseña aislado: validación y servicio, con base de datos y Argon2 simulados. */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import argon2 from 'argon2';
import { passwordChangeSchema } from '../../src/auth/validation.js';
import { createAuthService } from '../../src/auth/service.js';
vi.mock('argon2', () => ({
  default: { hash: vi.fn(), verify: vi.fn(), argon2id: 2 },
}));
const query = vi.fn();
const service = createAuthService({ query });
const valid = {
  current_password: 'Contraseña actual 1',
  new_password: 'Una frase nueva 42',
  confirm_password: 'Una frase nueva 42',
};
beforeEach(() => vi.resetAllMocks());

describe('Validación del cambio de contraseña', () => {
  /** Para qué sirve: aceptar un cambio con los tres campos correctos.
   * Qué comprueba: devuelve los datos sin modificar las contraseñas. */
  test('acepta datos válidos', () => {
    expect(passwordChangeSchema.parse(valid)).toEqual(valid);
  });

  /** Para qué sirve: aplicar a la nueva contraseña las mismas reglas que en el registro.
   * Qué comprueba: rechaza cada caso indicando el campo afectado. */
  test.each([
    ['current_password', { current_password: '' }],
    ['new_password', { new_password: 'corta', confirm_password: 'corta' }],
    [
      'new_password',
      { new_password: 'x'.repeat(129), confirm_password: 'x'.repeat(129) },
    ],
    ['confirm_password', { confirm_password: 'Otra frase distinta 42' }],
    ['confirm_password', { confirm_password: '' }],
  ])('rechaza %s incorrecto', (field, change) => {
    const result = passwordChangeSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
  });

  /** Para qué sirve: aceptar exactamente los límites de la política de contraseñas.
   * Qué comprueba: admite nuevas contraseñas de 12 y 128 caracteres. */
  test.each([12, 128])('acepta una nueva contraseña de %i caracteres', (length) => {
    const password = 'x'.repeat(length);
    expect(
      passwordChangeSchema.safeParse({
        ...valid,
        new_password: password,
        confirm_password: password,
      }).success,
    ).toBe(true);
  });
});

describe('Servicio de cambio de contraseña', () => {
  /** Para qué sirve: guardar la nueva contraseña solo tras verificar la actual.
   * Qué comprueba: verifica con el hash guardado, guarda un hash Argon2id nuevo con SQL
   * parametrizado, actualiza updated_at y nunca envía la contraseña en claro. */
  test('cambia la contraseña si la actual es correcta', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ password_hash: '$argon2id$antiguo' }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    argon2.verify.mockResolvedValue(true);
    argon2.hash.mockResolvedValue('$argon2id$nuevo');

    expect(await service.changePassword('7', valid)).toBe(true);

    expect(argon2.verify).toHaveBeenCalledWith(
      '$argon2id$antiguo',
      valid.current_password,
    );
    expect(argon2.hash).toHaveBeenCalledWith(
      valid.new_password,
      expect.objectContaining({ type: argon2.argon2id }),
    );
    expect(query.mock.calls[0]).toEqual([
      'SELECT password_hash FROM users WHERE id = $1',
      ['7'],
    ]);
    const [sql, params] = query.mock.calls[1];
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('updated_at = now()');
    expect(params).toEqual(['$argon2id$nuevo', '7']);
    expect(params).not.toContain(valid.new_password);
  });

  /** Para qué sirve: impedir el cambio sin conocer la contraseña actual.
   * Qué comprueba: devuelve false y no calcula ni guarda ningún hash nuevo. */
  test('no cambia nada si la contraseña actual es incorrecta', async () => {
    query.mockResolvedValueOnce({ rows: [{ password_hash: '$argon2id$antiguo' }] });
    argon2.verify.mockResolvedValue(false);

    expect(await service.changePassword('7', valid)).toBe(false);
    expect(argon2.hash).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  /** Para qué sirve: no fallar si el usuario de la sesión ya no existe.
   * Qué comprueba: devuelve false sin verificar ni guardar nada. */
  test('no cambia nada si el usuario no existe', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    expect(await service.changePassword('999', valid)).toBe(false);
    expect(argon2.verify).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  /** Para qué sirve: no ocultar fallos de infraestructura.
   * Qué comprueba: propaga un error inesperado de la base de datos al guardar. */
  test('propaga errores inesperados al guardar', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ password_hash: '$argon2id$antiguo' }] })
      .mockRejectedValueOnce(new Error('fallo de prueba'));
    argon2.verify.mockResolvedValue(true);
    argon2.hash.mockResolvedValue('$argon2id$nuevo');

    await expect(service.changePassword('7', valid)).rejects.toThrow(
      'fallo de prueba',
    );
  });
});

/** Servicio de autenticación aislado: base de datos y Argon2 simulados. */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import argon2 from 'argon2';
import { createAuthService } from '../../src/auth/service.js';
vi.mock('argon2', () => ({
  default: { hash: vi.fn(), verify: vi.fn(), argon2id: 2 },
}));
const query = vi.fn();
const service = createAuthService({ query });
const input = {
  first_name: 'Ana',
  last_name: 'García',
  email: 'ana@example.com',
  organization: null,
  password: 'Una frase segura 42',
};
beforeEach(() => vi.resetAllMocks());

describe('Registro de usuarios', () => {
  /** Para qué sirve: guardar credenciales seguras y evitar SQL construido con datos del usuario.
   * Qué comprueba: usa Argon2id, parámetros SQL y nunca inserta la contraseña en claro. */
  test('guarda un hash y devuelve solo datos públicos', async () => {
    argon2.hash.mockResolvedValue('$argon2id$hash-ficticio');
    query.mockResolvedValue({
      rows: [{ id: '42', first_name: 'Ana', email: input.email }],
    });
    const result = await service.register(input);
    expect(argon2.hash).toHaveBeenCalledWith(
      input.password,
      expect.objectContaining({ type: argon2.argon2id }),
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('$1');
    expect(sql).not.toContain(input.email);
    expect(params).toEqual([
      'Ana',
      'García',
      input.email,
      '$argon2id$hash-ficticio',
      null,
    ]);
    expect(params).not.toContain(input.password);
    expect(result).not.toHaveProperty('password_hash');
  });

  /** Para qué sirve: resolver un correo duplicado incluso con registros simultáneos.
   * Qué comprueba: traduce la restricción users_email_unique a un error controlado. */
  test('traduce el correo duplicado', async () => {
    argon2.hash.mockResolvedValue('$argon2id$hash');
    query.mockRejectedValue({
      code: '23505',
      constraint: 'users_email_unique',
    });
    await expect(service.register(input)).rejects.toMatchObject({
      code: 'EMAIL_EXISTS',
    });
  });

  /** Para qué sirve: no ocultar fallos de infraestructura como si fueran datos incorrectos.
   * Qué comprueba: propaga el fallo inesperado del almacenamiento. */
  test('propaga errores inesperados al registrar', async () => {
    const error = new Error('Fallo simulado');
    argon2.hash.mockResolvedValue('$argon2id$hash');
    query.mockRejectedValue(error);
    await expect(service.register(input)).rejects.toBe(error);
  });

  /** Para qué sirve: evitar cuentas incompletas cuando falla el hash.
   * Qué comprueba: propaga el fallo de Argon2 y no intenta insertar datos. */
  test('no inserta si falla el cálculo del hash', async () => {
    const error = new Error('Hash no disponible');
    argon2.hash.mockRejectedValue(error);
    await expect(service.register(input)).rejects.toBe(error);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('Autenticación', () => {
  /** Para qué sirve: reconocer al usuario únicamente después de verificar su contraseña.
   * Qué comprueba: consulta parametrizada, verificación Argon2 y respuesta sin hash. */
  test('devuelve el usuario con contraseña correcta', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: '42',
          first_name: 'Ana',
          email: input.email,
          password_hash: '$argon2id$hash',
        },
      ],
    });
    argon2.verify.mockResolvedValue(true);
    expect(await service.authenticate(input)).toEqual({
      id: '42',
      first_name: 'Ana',
      email: input.email,
    });
    expect(query.mock.calls[0][1]).toEqual([input.email]);
    expect(argon2.verify).toHaveBeenCalledWith(
      '$argon2id$hash',
      input.password,
    );
  });

  /** Para qué sirve: rechazar tanto contraseñas erróneas como cuentas inexistentes.
   * Qué comprueba: devuelve null en ambos casos y realiza verificación de hash en ambos. */
  test.each([true, false])(
    'rechaza el acceso (existe usuario: %s)',
    async (exists) => {
      query.mockResolvedValue({
        rows: exists ? [{ id: '42', password_hash: '$argon2id$hash' }] : [],
      });
      argon2.verify.mockResolvedValue(false);
      expect(await service.authenticate(input)).toBeNull();
      expect(argon2.verify).toHaveBeenCalledTimes(1);
    },
  );

  /** Para qué sirve: no autenticar una cuenta inexistente aunque coincida el hash ficticio.
   * Qué comprueba: la ausencia de usuario prevalece sobre una verificación positiva simulada. */
  test('el hash ficticio nunca permite entrar', async () => {
    query.mockResolvedValue({ rows: [] });
    argon2.verify.mockResolvedValue(true);
    expect(await service.authenticate(input)).toBeNull();
  });
});

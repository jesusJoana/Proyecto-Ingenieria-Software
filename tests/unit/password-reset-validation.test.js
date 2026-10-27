/** Validación de la recuperación de contraseña: datos ficticios, sin HTTP, archivos .env ni PostgreSQL. */
import { describe, expect, test } from 'vitest';
import {
  resetRequestSchema,
  passwordResetSchema,
  isValidResetToken,
} from '../../src/auth/validation.js';

describe('Validación de la solicitud de recuperación', () => {
  /** Para qué sirve: buscar el correo igual que en el registro y el acceso.
   * Qué comprueba: limpia espacios y pasa el correo a minúsculas. */
  test('normaliza el correo', () => {
    expect(resetRequestSchema.parse({ email: ' ANA@Example.com ' })).toEqual({
      email: 'ana@example.com',
    });
  });

  /** Para qué sirve: no consultar la base con valores que no son un correo.
   * Qué comprueba: rechaza vacío, sin formato de correo, demasiado largo o no texto. */
  test.each([[''], ['sin-correo'], ['a'.repeat(250) + '@e.com'], [['a@e.com']]])(
    'rechaza el correo %j',
    (email) => {
      const result = resetRequestSchema.safeParse({ email });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path[0]).toBe('email');
    },
  );
});

describe('Validación de la nueva contraseña', () => {
  const valid = {
    password: 'Una frase nueva 42',
    confirm_password: 'Una frase nueva 42',
  };

  /** Para qué sirve: aceptar una nueva contraseña correcta.
   * Qué comprueba: devuelve los datos sin modificar la contraseña (no recorta espacios). */
  test('acepta datos válidos', () => {
    expect(passwordResetSchema.parse(valid)).toEqual(valid);
  });

  /** Para qué sirve: aplicar las mismas reglas que en el registro (12-128 y confirmación).
   * Qué comprueba: rechaza cada caso indicando el campo afectado. */
  test.each([
    ['password', { password: 'corta', confirm_password: 'corta' }],
    ['password', { password: 'x'.repeat(129), confirm_password: 'x'.repeat(129) }],
    ['confirm_password', { confirm_password: 'Otra frase distinta 42' }],
    ['confirm_password', { confirm_password: '' }],
  ])('rechaza %s incorrecto', (field, change) => {
    const result = passwordResetSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
  });

  /** Para qué sirve: respetar exactamente los límites de la política de contraseñas.
   * Qué comprueba: admite contraseñas de 12 y 128 caracteres. */
  test.each([12, 128])('acepta una contraseña de %i caracteres', (length) => {
    const password = 'x'.repeat(length);
    expect(
      passwordResetSchema.safeParse({ password, confirm_password: password }).success,
    ).toBe(true);
  });
});

describe('Formato del token del enlace', () => {
  /** Para qué sirve: descartar enlaces manipulados antes de calcular su hash y consultar la base.
   * Qué comprueba: solo acepta 64 caracteres hexadecimales en minúscula. */
  test.each([
    ['a'.repeat(64), true],
    ['0123456789abcdef'.repeat(4), true],
    ['a'.repeat(63), false],
    ['a'.repeat(65), false],
    ['A'.repeat(64), false],
    ['g'.repeat(64), false],
    ['', false],
    [undefined, false],
  ])('%j es válido: %s', (token, expected) => {
    expect(isValidResetToken(token)).toBe(expected);
  });
});

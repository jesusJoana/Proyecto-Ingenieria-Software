/** Validación de formularios: datos ficticios, sin HTTP, archivos .env ni PostgreSQL. */
import { describe, expect, test } from 'vitest';
import {
  registrationSchema,
  loginSchema,
  formValues,
  fieldErrors,
} from '../../src/auth/validation.js';

const valid = {
  first_name: ' Ana ',
  last_name: ' García ',
  email: ' ANA@example.com ',
  organization: ' Universidad ',
  password: 'Una frase segura 42',
  confirm_password: 'Una frase segura 42',
};

describe('Validación del registro', () => {
  /** Para qué sirve: preparar datos acordes con users.
   * Qué comprueba: limpia espacios, normaliza correo y admite la organización opcional. */
  test('normaliza los datos válidos', () => {
    expect(registrationSchema.parse(valid)).toMatchObject({
      first_name: 'Ana',
      last_name: 'García',
      email: 'ana@example.com',
      organization: 'Universidad',
    });
    expect(
      registrationSchema.parse({ ...valid, organization: '' }).organization,
    ).toBeNull();
    const { organization, ...withoutOrganization } = valid;
    expect(
      registrationSchema.parse(withoutOrganization).organization,
    ).toBeNull();
  });

  /** Para qué sirve: impedir campos obligatorios vacíos y valores fuera de sus límites.
   * Qué comprueba: rechaza cada variante en el servidor, aunque el navegador la admita. */
  test.each([
    ['first_name', ' '],
    ['first_name', 'x'.repeat(101)],
    ['last_name', ''],
    ['last_name', 'x'.repeat(151)],
    ['email', 'sin-correo'],
    ['email', 'a b@example.com'],
    ['email', 'a'.repeat(250) + '@e.com'],
    ['password', 'corta'],
    ['password', 'x'.repeat(129)],
    ['confirm_password', 'diferente'],
    ['organization', 'x'.repeat(201)],
    ['first_name', ['Ana', 'Otra']],
  ])('rechaza el campo %s inválido (%j)', (field, value) => {
    const result = registrationSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(
      true,
    );
  });

  /** Para qué sirve: aceptar exactamente los límites de la política de contraseñas.
   * Qué comprueba: admite 12 y 128 caracteres y no elimina espacios de la contraseña. */
  test.each([12, 128])('acepta contraseña de %i caracteres', (length) => {
    const password = ' ' + 'a'.repeat(length - 2) + ' ';
    expect(
      registrationSchema.parse({
        ...valid,
        password,
        confirm_password: password,
      }).password,
    ).toBe(password);
  });

  /** Para qué sirve: impedir asignaciones de campos internos enviadas desde el formulario.
   * Qué comprueba: descarta id y password_hash aportados por el cliente. */
  test('ignora campos internos del usuario', () => {
    const result = registrationSchema.parse({
      ...valid,
      id: '1',
      password_hash: 'falso',
    });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('password_hash');
  });
});

/** Para qué sirve: no reenviar secretos ni estructuras arbitrarias a la vista tras un error.
 * Qué comprueba: conserva solo campos públicos, limita su tamaño y descarta arrays y contraseña. */
test('prepara valores públicos seguros para el formulario', () => {
  const result = formValues({
    ...valid,
    first_name: ['a'],
    organization: 'x'.repeat(500),
    _csrf: 'secreto',
  });
  expect(result.first_name).toBe('');
  expect(result.organization).toHaveLength(254);
  expect(result).not.toHaveProperty('password');
  expect(result).not.toHaveProperty('confirm_password');
  expect(result).not.toHaveProperty('_csrf');
  expect(formValues()).toEqual({
    first_name: '',
    last_name: '',
    email: '',
    organization: '',
  });
});

/** Para qué sirve: mostrar errores por campo sin estructuras internas ni mensajes duplicados.
 * Qué comprueba: convierte un tipo inválido a un mensaje comprensible y conserva el primer error. */
test('prepara un mensaje por campo', () => {
  expect(
    fieldErrors({
      issues: [
        { path: ['email'], code: 'invalid_type', message: 'Interno' },
        { path: ['email'], code: 'custom', message: 'Otro error' },
      ],
    }),
  ).toEqual({ email: 'Completa este campo con un valor válido.' });
});

describe('Validación del acceso', () => {
  /** Para qué sirve: validar el acceso sin aplicar retroactivamente la política de registro.
   * Qué comprueba: normaliza el correo y conserva una contraseña no vacía sin modificarla. */
  test('acepta credenciales y conserva la contraseña exacta', () => {
    expect(
      loginSchema.parse({ email: ' ANA@example.com ', password: ' antigua ' }),
    ).toEqual({ email: 'ana@example.com', password: ' antigua ' });
  });

  /** Para qué sirve: rechazar peticiones de acceso incompletas o de tamaño excesivo.
   * Qué comprueba: detecta correo inválido y contraseña vacía, múltiple o demasiado larga. */
  test.each([
    { email: 'no', password: 'clave' },
    { email: 'a@b.es', password: '' },
    { email: 'a@b.es', password: ['a', 'b'] },
    { email: 'a@b.es', password: 'x'.repeat(129) },
  ])('rechaza credenciales inválidas (%j)', (values) =>
    expect(loginSchema.safeParse(values).success).toBe(false),
  );
});

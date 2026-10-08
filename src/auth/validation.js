/** Reglas de formulario alineadas con users; no aceptan campos internos del cliente. */
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'El correo admite hasta 254 caracteres.')
  .regex(
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
    'Introduce un correo electrónico válido.',
  );
const password = z
  .string()
  .min(12, 'Utiliza al menos 12 caracteres.')
  .max(128, 'La contraseña admite hasta 128 caracteres.');

export const registrationSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
      .max(30, 'El nombre de usuario admite hasta 30 caracteres.')
      .regex(
        /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/,
        'Usa letras, números, guiones o guiones bajos; empieza y termina con una letra o número.',
      ),
    first_name: z
      .string()
      .trim()
      .min(1, 'Introduce tu nombre.')
      .max(100, 'El nombre admite hasta 100 caracteres.'),
    last_name: z
      .string()
      .trim()
      .min(1, 'Introduce tus apellidos.')
      .max(150, 'Los apellidos admiten hasta 150 caracteres.'),
    email,
    organization: z
      .string()
      .trim()
      .max(200, 'La organización admite hasta 200 caracteres.')
      .optional()
      .transform((value) => value || null),
    password,
    confirm_password: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Las contraseñas no coinciden.',
  });

/** Cambio de contraseña con sesión iniciada: la nueva cumple las mismas reglas que en el registro. */
export const passwordChangeSchema = z
  .object({
    current_password: z
      .string()
      .min(1, 'Introduce tu contraseña actual.')
      .max(128, 'La contraseña admite hasta 128 caracteres.'),
    new_password: password,
    confirm_password: z.string().min(1, 'Repite la nueva contraseña.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Las contraseñas no coinciden.',
  });

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, 'Introduce tu contraseña.')
    .max(128, 'La contraseña admite hasta 128 caracteres.'),
});

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
    .max(30, 'El nombre de usuario admite hasta 30 caracteres.')
    .regex(
      /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/,
      'Usa letras, números, guiones o guiones bajos; empieza y termina con una letra o número.',
    ),
  first_name: z
    .string()
    .trim()
    .min(1, 'Introduce tu nombre.')
    .max(100, 'El nombre admite hasta 100 caracteres.'),
  last_name: z
    .string()
    .trim()
    .min(1, 'Introduce tus apellidos.')
    .max(150, 'Los apellidos admiten hasta 150 caracteres.'),
  email,
  organization: z
    .string()
    .trim()
    .max(200, 'La organización admite hasta 200 caracteres.')
    .optional()
    .transform((value) => value || null),
  age: z
    .union([z.literal(''), z.coerce.number().int().min(13).max(120)])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  description: z
    .string()
    .trim()
    .max(500, 'La descripción admite hasta 500 caracteres.')
    .optional()
    .transform((value) => value || null),
  locality: z
    .string()
    .trim()
    .max(100, 'La localidad admite hasta 100 caracteres.')
    .optional()
    .transform((value) => value || null),
  remove_avatar: z
    .enum(['on'])
    .optional()
    .transform((value) => Boolean(value)),
});

/** Conserva solo campos públicos para volver a dibujar el formulario tras un error. */
export function formValues(body = {}) {
  return Object.fromEntries(
    [
      'username',
      'first_name',
      'last_name',
      'email',
      'organization',
      'age',
      'description',
      'locality',
    ].map((key) => [
      key,
      typeof body[key] === 'string' ? body[key].slice(0, 500) : '',
    ]),
  );
}

/** Un mensaje por campo; evita mostrar estructuras internas de Zod. */
export function fieldErrors(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    fields[key] ??=
      issue.code === 'invalid_type'
        ? 'Completa este campo con un valor válido.'
        : issue.message;
  }
  return fields;
}

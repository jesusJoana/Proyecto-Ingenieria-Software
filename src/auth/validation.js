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

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, 'Introduce tu contraseña.')
    .max(128, 'La contraseña admite hasta 128 caracteres.'),
});

/** Conserva solo campos públicos para volver a dibujar el formulario tras un error. */
export function formValues(body = {}) {
  return Object.fromEntries(
    ['first_name', 'last_name', 'email', 'organization'].map((key) => [
      key,
      typeof body[key] === 'string' ? body[key].slice(0, 254) : '',
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

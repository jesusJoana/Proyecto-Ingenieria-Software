/** Validación de las publicaciones de objetos. Los valores se guardan en inglés y se muestran en español. */
import { z } from 'zod';

export const KINDS = { lost: 'Perdido', found: 'Encontrado' };

export const CATEGORIES = {
  electronics: 'Electrónica',
  documents: 'Documentos',
  keys: 'Llaves',
  clothing: 'Ropa',
  accessories: 'Accesorios',
  pets: 'Mascotas',
  other: 'Otros',
};

export const STATUSES = {
  active: 'Activa',
  reserved: 'Reservada',
  resolved: 'Resuelta',
};

const FIELDS = [
  'kind',
  'title',
  'description',
  'category',
  'color',
  'brand',
  'location',
  'event_date',
  'university',
  'campus',
  'city',
  'country',
  'campus_address',
  'location_mode',
  'latitude',
  'longitude',
  'deposit_location',
];

/** Fecha de hoy en la zona horaria del servidor, como AAAA-MM-DD. */
export function today(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const optionalText = (max, message) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

export function createPostSchema(now = () => new Date()) {
  const requiredText = (max, label) =>
    z
      .string()
      .trim()
      .min(2, `Indica ${label}.`)
      .max(max, `El campo admite hasta ${max} caracteres.`);
  const coordinate = (min, max) =>
    z
      .string()
      .trim()
      .min(1, 'Selecciona un punto en el mapa o introduce sus coordenadas.')
      .refine(
        (value) => /^-?\d+(\.\d+)?$/.test(value),
        'Introduce una coordenada válida.',
      )
      .transform(Number)
      .pipe(z.number().finite().min(min).max(max));
  return z
    .object({
      university: requiredText(180, 'la universidad'),
      campus: requiredText(180, 'el campus o sede'),
      city: requiredText(100, 'la ciudad'),
      country: requiredText(100, 'el país'),
      campus_address: requiredText(250, 'la dirección del campus'),
      location_mode: z.enum(['campus', 'exact'], {
        message: 'Selecciona campus o punto exacto.',
      }),
      latitude: coordinate(-85, 85),
      longitude: coordinate(-180, 180),
      deposit_location: z
        .string()
        .trim()
        .max(250, 'El lugar de depósito admite hasta 250 caracteres.')
        .default(''),
      kind: z.enum(Object.keys(KINDS), {
        message: 'Indica si has perdido o encontrado el objeto.',
      }),
      title: z
        .string()
        .trim()
        .min(3, 'El título debe tener al menos 3 caracteres.')
        .max(100, 'El título admite hasta 100 caracteres.'),
      description: z
        .string()
        .trim()
        .min(10, 'Describe el objeto con al menos 10 caracteres.')
        .max(2000, 'La descripción admite hasta 2000 caracteres.'),
      category: z.enum(Object.keys(CATEGORIES), {
        message: 'Selecciona una categoría de la lista.',
      }),
      color: optionalText(40, 'El color admite hasta 40 caracteres.'),
      brand: optionalText(60, 'La marca admite hasta 60 caracteres.'),
      location: z
        .string()
        .trim()
        .min(2, 'Indica el lugar con al menos 2 caracteres.')
        .max(150, 'El lugar admite hasta 150 caracteres.'),
      event_date: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica una fecha válida.')
        .refine(isRealDate, 'Indica una fecha válida.')
        .refine(
          (value) => value >= '2000-01-01',
          'La fecha no puede ser anterior al año 2000.',
        )
        .refine(
          (value) => value <= today(now()),
          'La fecha no puede ser posterior a hoy.',
        ),
    })
    .superRefine((data, ctx) => {
      if (data.kind === 'found' && data.deposit_location.length < 2)
        ctx.addIssue({
          code: 'custom',
          path: ['deposit_location'],
          message: 'Indica dónde está depositado ahora (o escribe «Conmigo»).',
        });
    })
    .transform((data) => ({
      ...data,
      deposit_location: data.kind === 'found' ? data.deposit_location : null,
    }));
}

export const postSchema = createPostSchema();

/** Valores del formulario para volver a mostrarlos tras un error. */
export function postFormValues(body = {}) {
  return Object.fromEntries(
    FIELDS.map((key) => [
      key,
      typeof body[key] === 'string' ? body[key].slice(0, 2100) : '',
    ]),
  );
}

export function isValidPostId(value) {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

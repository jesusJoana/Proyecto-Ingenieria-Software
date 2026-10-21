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
  return z.object({
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
  });
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

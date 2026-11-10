import { z } from "zod";
export const CATEGORIES = {
  electronics: "Electrónica",
  documents: "Documentos",
  keys: "Llaves",
  clothing: "Ropa",
  accessories: "Accesorios",
  pets: "Mascotas",
  other: "Otros",
};
export const STATUSES = {
  available: "Disponible",
  reserved: "Reservado",
  returned: "Devuelto",
  withdrawn: "Retirado",
};
export const SEARCH_LIMIT = 20;
export const PUBLIC_FIELDS = [
  "category",
  "object_type",
  "university",
  "campus",
  "general_area",
  "found_from",
  "found_until",
  "campus_latitude",
  "campus_longitude",
];
export const PRIVATE_FIELDS = [
  "distinguishing_details",
  "exact_location",
  "deposit_location",
];
export const POSITION_FIELDS = [
  "found_latitude",
  "found_longitude",
  "found_accuracy",
  "custody_latitude",
  "custody_longitude",
  "custody_accuracy",
];
const FIELDS = [
  ...PUBLIC_FIELDS,
  ...PRIVATE_FIELDS,
  ...POSITION_FIELDS,
  "remove_photo",
];
const preciseNumber = (min, max) =>
  z
    .union([
      z.literal("").transform(() => null),
      z
        .string()
        .trim()
        .regex(/^-?\d+(\.\d+)?$/)
        .transform(Number)
        .pipe(z.number().finite().min(min).max(max)),
    ])
    .optional()
    .transform((value) => value ?? null);
export function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function realDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
const date = z.string().trim().refine(realDate, "Indica una fecha válida.");
const text = (max, min = 2) =>
  z
    .string()
    .trim()
    .min(min, `Indica al menos ${min} caracteres.`)
    .max(max, `Admite hasta ${max} caracteres.`);
const optional = (max) =>
  z
    .string()
    .trim()
    .max(max, `Admite hasta ${max} caracteres.`)
    .optional()
    .default("");
const coordinate = (max) =>
  z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^-?\d+(\.\d+)?$/)
        .transform(Number)
        .pipe(z.number().finite().min(-max).max(max)),
    ])
    .optional()
    .transform((value) =>
      value === undefined || value === ""
        ? null
        : Math.round(value * 100) / 100,
    );
export function createPostSchema(now = () => new Date()) {
  return z
    .object({
      kind: z
        .literal("found", {
          message: "Solo se pueden publicar objetos encontrados.",
        })
        .optional(),
      category: z.enum(Object.keys(CATEGORIES), {
        message: "Selecciona una categoría.",
      }),
      object_type: text(60),
      university: text(180),
      campus: text(180),
      general_area: text(150),
      distinguishing_details: text(2000, 10),
      exact_location: optional(250),
      deposit_location: optional(250),
      found_latitude: preciseNumber(-90, 90),
      found_longitude: preciseNumber(-180, 180),
      found_accuracy: preciseNumber(0, 40075000),
      custody_latitude: preciseNumber(-90, 90),
      custody_longitude: preciseNumber(-180, 180),
      custody_accuracy: preciseNumber(0, 40075000),
      found_from: date,
      found_until: date.optional().or(z.literal("")),
      campus_latitude: coordinate(85),
      campus_longitude: coordinate(180),
      remove_photo: z.literal("1").optional(),
    })
    .superRefine((data, ctx) => {
      for (const prefix of ["found", "custody"]) {
        const lat = data[`${prefix}_latitude`],
          lng = data[`${prefix}_longitude`];
        if (
          (lat === null) !== (lng === null) ||
          (lat === null && data[`${prefix}_accuracy`] !== null)
        )
          ctx.addIssue({
            code: "custom",
            path: [`${prefix}_latitude`],
            message: "Indica ambas coordenadas o deja la ubicación vacía.",
          });
      }
      const end = data.found_until || data.found_from;
      if (end < data.found_from)
        ctx.addIssue({
          code: "custom",
          path: ["found_until"],
          message: "El final no puede ser anterior al inicio.",
        });
      if (end > today(now()) || data.found_from > today(now()))
        ctx.addIssue({
          code: "custom",
          path: ["found_from"],
          message: "La fecha no puede ser posterior a hoy.",
        });
      if ((data.campus_latitude === null) !== (data.campus_longitude === null))
        ctx.addIssue({
          code: "custom",
          path: ["campus_latitude"],
          message: "Indica ambas coordenadas o deja las dos vacías.",
        });
    })
    .transform(({ kind, remove_photo, ...data }) => ({
      ...data,
      ...(data.campus_latitude === null &&
      data.found_latitude !== null &&
      Math.abs(data.found_latitude) <= 85
        ? {
            campus_latitude: Math.round(data.found_latitude * 100) / 100,
            campus_longitude: Math.round(data.found_longitude * 100) / 100,
          }
        : {}),
      found_until: data.found_until || data.found_from,
      removePhoto: remove_photo === "1",
    }));
}
export const postSchema = createPostSchema();
export const createEditPostSchema = createPostSchema;
export const editPostSchema = postSchema;
export const withdrawalSchema = z.object({
  reason: text(1000),
  confirm: z.literal("1", { message: "Confirma la retirada." }),
});
export const SEARCH_DEFAULTS = Object.freeze({
  q: "",
  category: "",
  university: "",
  campus: "",
  general_area: "",
  from: "",
  until: "",
  page: 1,
});
export function parseSearch(query = {}) {
  const filters = { ...SEARCH_DEFAULTS };
  let invalid = false;
  const schemas = {
    q: text(100, 1),
    category: z.enum(Object.keys(CATEGORIES)),
    university: text(180, 1),
    campus: text(180, 1),
    general_area: text(150, 1),
    from: date,
    until: date,
    page: z
      .string()
      .regex(/^[1-9]\d{0,5}$/)
      .transform(Number),
  };
  for (const [key, schema] of Object.entries(schemas)) {
    if (query[key] === undefined || query[key] === "") continue;
    const result = schema.safeParse(query[key]);
    if (result.success) filters[key] = result.data;
    else invalid = true;
  }
  if (filters.from && filters.until && filters.from > filters.until) {
    filters.from = "";
    filters.until = "";
    invalid = true;
  }
  return { filters, invalid };
}
export function postFormValues(body = {}) {
  return Object.fromEntries(
    FIELDS.map((key) => [
      key,
      typeof body[key] === "string" ? body[key].slice(0, 2100) : "",
    ]),
  );
}
export function isValidPostId(value) {
  return (
    typeof value === "string" &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

import { z } from "zod";

export const searchSchema = z.string().trim().max(100);

export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Escribe un mensaje antes de enviarlo.")
    .max(2000, "El mensaje no puede superar los 2000 caracteres."),
});

export function isValidId(value) {
  return typeof value === "string" && /^[1-9]\d{0,18}$/.test(value);
}

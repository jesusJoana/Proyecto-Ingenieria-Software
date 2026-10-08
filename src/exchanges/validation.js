import { z } from 'zod';

export const exchangeProposalSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, 'Describe brevemente el objeto o intercambio.')
    .max(300, 'El detalle admite hasta 300 caracteres.'),
});

export const exchangeReviewSchema = z.object({
  rating: z.coerce
    .number()
    .int('Selecciona una cantidad entera de estrellas.')
    .min(1, 'La valoración mínima es una estrella.')
    .max(5, 'La valoración máxima es de cinco estrellas.'),
  comment: z
    .string()
    .trim()
    .min(1, 'Escribe un comentario para publicar la valoración.')
    .max(1000, 'El comentario admite hasta 1000 caracteres.'),
});
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  senha: z.string().min(1),
});

export type EstadoLogin = { erro?: string; email?: string };

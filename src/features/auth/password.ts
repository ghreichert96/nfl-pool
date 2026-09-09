import { z } from "zod";

export const passwordSchema = z
  .object({
    password: z.string().min(6).max(128),
    confirmation: z.string().min(6).max(128),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Passwords do not match",
    path: ["confirmation"],
  });

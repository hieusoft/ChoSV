import { z } from 'zod';

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  university: z.string().optional(),
  campus: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

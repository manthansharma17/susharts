import { z } from 'zod';
import { USER_ROLES } from './product.js';

export const currentUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

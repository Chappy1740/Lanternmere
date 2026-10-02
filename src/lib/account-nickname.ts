import { z } from 'zod';

export const gameNicknameSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[^@\p{Cc}\p{Cf}]+$/u);

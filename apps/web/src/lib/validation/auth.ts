import { z } from 'zod';

/** Moroccan CNIE: one or two letters followed by digits (e.g. AB123456). */
export const cinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\d{3,7}$/, 'invalid_cin');

/** E.164, Moroccan numbers by default (+2126..., +2127...). */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .transform((v) => (v.startsWith('0') ? `+212${v.slice(1)}` : v))
  .pipe(z.string().regex(/^\+\d{8,15}$/, 'invalid_phone'));

/** ASVS 6.2: at least 8 characters, at most 128, no composition rules. */
export const passwordSchema = z.string().min(8, 'too_short').max(128, 'too_long');

export const signinSchema = z.object({
  cin: cinSchema,
  password: z.string().min(1, 'required').max(128),
});

export const signupSchema = z.object({
  cin: cinSchema,
  phone: phoneSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email('invalid_email').max(254).optional().or(z.literal('').transform(() => undefined)),
  /** Asking for official access files a request; it never grants the role. */
  requestOfficial: z
    .object({
      department: z.string().trim().min(2).max(120),
      position: z.string().trim().max(120).optional(),
      justification: z.string().trim().max(1000).optional(),
    })
    .optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

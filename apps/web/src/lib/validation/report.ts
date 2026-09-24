import { z } from 'zod';
import { phoneSchema } from '@/lib/validation/auth';

/** Generous box around Morocco; anything outside is almost certainly a GPS or input error. */
export const MOROCCO_BOUNDS = { minLat: 20.5, maxLat: 36.2, minLng: -17.5, maxLng: -0.9 };

const photoUrl = z.string().regex(/^\/api\/uploads\/[a-f0-9]{24}$/, 'invalid_photo');

export const createReportSchema = z
  .object({
    clientSubmissionId: z.string().uuid('invalid_submission_id').optional(),
    latitude: z.coerce.number().finite(),
    longitude: z.coerce.number().finite(),
    description: z.string().trim().min(3, 'too_short').max(2000, 'too_long'),
    cause: z.string().trim().max(64).optional(),
    anonymous: z.boolean().optional().default(false),
    contactPhone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
    characteristics: z.record(z.unknown()).optional(),
    images: z.array(photoUrl).max(5, 'too_many').optional().default([]),
    /** When the report was written on the device (offline submissions arrive later). */
    capturedAt: z.coerce.date().optional(),
  })
  .superRefine((value, ctx) => {
    const { minLat, maxLat, minLng, maxLng } = MOROCCO_BOUNDS;
    if (value.latitude < minLat || value.latitude > maxLat) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'out_of_region' });
    }
    if (value.longitude < minLng || value.longitude > maxLng) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['longitude'], message: 'out_of_region' });
    }
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;

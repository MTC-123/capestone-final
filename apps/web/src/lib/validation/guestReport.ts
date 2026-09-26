import { z } from 'zod';
import { MOROCCO_BOUNDS } from '@/lib/validation/report';

export const guestReportSchema = z.object({
  clientSubmissionId: z.string().uuid(),
  observation: z.enum(['FIRE', 'SMOKE', 'UNSURE']),
  locationBasis: z.enum(['FIRE', 'OBSERVER', 'APPROXIMATE', 'LANDMARK']),
  locationText: z.string().trim().max(300).optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  accuracyMeters: z.number().finite().min(1).max(1_000_000).optional(),
  description: z.string().trim().max(2000).default(''),
  contactPhone: z.string().trim().max(40).optional(),
  images: z.array(z.string().regex(/^\/api\/uploads\/[a-f0-9]{24}$/)).max(3).default([]),
  capturedAt: z.coerce.date(),
}).superRefine((value, ctx) => {
  if (!value.locationText && (value.latitude == null || value.longitude == null)) {
    ctx.addIssue({ code: 'custom', path: ['locationText'], message: 'location_required' });
  }
  if ((value.latitude == null) !== (value.longitude == null)) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'coordinate_pair_required' });
  }
  if (value.locationBasis !== 'LANDMARK' && (value.latitude == null || value.longitude == null)) {
    ctx.addIssue({ code: 'custom', path: ['locationBasis'], message: 'coordinates_required_for_location_basis' });
  }
  if (value.locationBasis === 'LANDMARK' && !value.locationText) {
    ctx.addIssue({ code: 'custom', path: ['locationText'], message: 'landmark_required' });
  }
  if (value.accuracyMeters != null && (value.latitude == null || value.longitude == null)) {
    ctx.addIssue({ code: 'custom', path: ['accuracyMeters'], message: 'coordinates_required_for_accuracy' });
  }
  if (value.latitude != null && (value.latitude < MOROCCO_BOUNDS.minLat || value.latitude > MOROCCO_BOUNDS.maxLat)) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'out_of_region' });
  }
  if (value.longitude != null && (value.longitude < MOROCCO_BOUNDS.minLng || value.longitude > MOROCCO_BOUNDS.maxLng)) {
    ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'out_of_region' });
  }
});

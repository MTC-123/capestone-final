/**
 * Demo mode powers the public showcase deployment: one-click persona sign-in
 * and the guided tour. It is off unless DEMO_MODE is exactly "true", so a
 * production deployment that forgets the variable stays locked down.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

export const DEMO_PERSONAS = {
  official: { cin: 'CD789012', landing: '/map' },
  civilian: { cin: 'AB123456', landing: '/report' },
} as const;

export type DemoPersona = keyof typeof DEMO_PERSONAS;

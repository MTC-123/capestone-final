export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RemediationHint = {
  title: string;
  steps?: string[];
  url?: string;
};

export type FieldError = {
  field: string;
  code?: string;
  message?: string;
};

export type ApiErrorEnvelope = {
  code: number;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  timestamp: string;
  requestId: string;
  hint?: RemediationHint[];
  fields?: FieldError[];
  meta?: Record<string, unknown>;
  debug?: {
    stack?: string;
    cause?: unknown;
  };
};

export type ApiErrorResponse = {
  error: ApiErrorEnvelope;
};

export const ERROR_CODE_RANGES = {
  CLIENT: { min: 1000, max: 1999 },
  AUTH: { min: 2000, max: 2999 },
  BUSINESS: { min: 3000, max: 3999 },
  EXTERNAL: { min: 4000, max: 4999 },
  SYSTEM: { min: 5000, max: 5999 },
  DISPATCH: { min: 6000, max: 6999 },
  VEHICLE: { min: 7000, max: 7999 },
  FIRE_RECORD: { min: 8000, max: 8999 },
  COORDINATION: { min: 9000, max: 9999 },
  OPERATIONS: { min: 10000, max: 10999 },
  EQUIPMENT: { min: 11000, max: 11999 },
} as const;


import type { ZodType, ZodTypeDef } from 'zod';
import { AppError } from '@/lib/errors/AppError';

/** Reads the JSON body and validates it, mapping failures to 400/422 AppErrors. */
export async function parseJsonBody<T>(request: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }
  return parseWith(schema, body);
}

export function parseWith<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(1001, {
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '_root',
        code: issue.code === 'invalid_type' && issue.received === 'undefined' ? 'required' : issue.message,
      })),
    });
  }
  return result.data;
}

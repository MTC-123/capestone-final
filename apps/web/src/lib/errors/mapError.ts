import { AppError } from '@/lib/errors/AppError';

function extractMissingEnvFromMessage(message: string): string[] {
  const regex = /Environment variable not found:\s*([A-Z0-9_]+)/g;
  const matches: string[] = [];
  let result: RegExpExecArray | null;
  while ((result = regex.exec(message)) !== null) {
    if (result[1]) matches.push(result[1]);
  }
  return matches;
}

export function mapUnknownToAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const message =
    typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : '';

  const missingEnv = message ? extractMissingEnvFromMessage(message) : [];
  if (missingEnv.length) {
    return new AppError(5001, { meta: { missingEnv }, cause: error });
  }

  const isPrismaClientKnownRequestError =
    typeof (error as { name?: unknown })?.name === 'string' &&
    String((error as { name: string }).name).includes('Prisma');

  if (isPrismaClientKnownRequestError) {
    // Client mistakes surfaced by the database are not server failures.
    const code = (error as { code?: unknown }).code;
    if (code === 'P2025' || code === 'P2001' || code === 'P2018') return new AppError(1003, { cause: error }); // record not found
    if (code === 'P2023') return new AppError(1000, { cause: error }); // malformed id (not an ObjectId)
    return new AppError(5002, { cause: error });
  }

  return new AppError(5000, { cause: error });
}


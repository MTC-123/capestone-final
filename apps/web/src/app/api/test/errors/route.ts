export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request) => {
  if (process.env.NODE_ENV === 'production') throw new AppError(1003);

  const url = new URL(request.url);
  const scenario = url.searchParams.get('case') ?? '';

  if (scenario === 'validation') {
    throw new AppError(1001, {
      fields: [
        { field: 'cin', code: 'invalid' },
        { field: 'password', code: 'required' },
      ],
    });
  }

  if (scenario === 'unauth') throw new AppError(2000);
  if (scenario === 'forbidden') throw new AppError(2001);
  if (scenario === 'external') throw new AppError(4000);
  if (scenario === 'config') throw new AppError(5001, { meta: { missingEnv: ['DATABASE_URL', 'JWT_SECRET'] } });
  if (scenario === 'unexpected') throw new Error('boom');

  return NextResponse.json({ ok: true });
});


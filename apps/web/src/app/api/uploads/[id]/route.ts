export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { requireUser } from '@/lib/security/guards';

/** Serves a photo to its owner or to officials. */
export const GET = withApiHandler(async (request: Request, context?: { params?: Record<string, string> }) => {
  const user = await requireUser(request);
  const id = context?.params?.id ?? '';
  if (!/^[a-f0-9]{24}$/.test(id)) throw new AppError(1003);

  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) throw new AppError(1003);
  if (upload.ownerId !== user.userId && user.role !== 'OFFICIAL') throw new AppError(1003);

  if (upload.blobUrl) {
    const response = NextResponse.redirect(upload.blobUrl, 302);
    response.headers.set('Cache-Control', 'private, max-age=300');
    return response;
  }
  if (!upload.data) throw new AppError(1003);

  return new Response(Buffer.from(upload.data), {
    headers: {
      'Content-Type': upload.contentType,
      'Content-Length': String(upload.size),
      'Cache-Control': 'private, max-age=86400, immutable',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

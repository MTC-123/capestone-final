export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { requireGuestToken } from '@/lib/security/guestReport';
import { MAX_UPLOAD_BYTES, detectImageType, readImageSize, stripJpegMetadata } from '@/lib/uploads/image';

export const POST = withApiHandler(async (request: Request) => {
  await enforceRateLimit('guestUpload', request);
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError(1005);
  const form = await request.formData();
  const clientSubmissionId = form.get('clientSubmissionId');
  const key = form.get('key');
  const file = form.get('file');
  if (typeof clientSubmissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(clientSubmissionId)) throw new AppError(1001);
  if (typeof key !== 'string' || !/^\d{1,2}$/.test(key)) throw new AppError(1001);
  if (!(file instanceof Blob)) throw new AppError(1001);
  await requireGuestToken(request, clientSubmissionId);
  const idempotencyKey = `guest:${clientSubmissionId}:${key}`;
  const existing = await prisma.upload.findUnique({ where: { idempotencyKey } });
  if (existing) return NextResponse.json({ url: `/api/uploads/${existing.id}`, duplicate: true });
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(1005);

  const original = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageType(original);
  if (!kind) throw new AppError(1004);
  const bytes = kind === 'image/jpeg' ? stripJpegMetadata(original) : original;
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const dimensions = readImageSize(bytes, kind);
  let blobUrl: string | undefined;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const stored = await put(`reports/${sha256}.${kind.split('/')[1]}`, Buffer.from(bytes), {
      access: 'public', contentType: kind, addRandomSuffix: true,
    });
    blobUrl = stored.url;
  }
  try {
    const upload = await prisma.upload.create({
      data: {
        guestSubmissionId: clientSubmissionId, idempotencyKey, contentType: kind, size: bytes.byteLength, sha256,
        width: dimensions?.width, height: dimensions?.height, blobUrl,
        data: blobUrl ? undefined : Buffer.from(bytes),
      },
    });
    return NextResponse.json({ url: `/api/uploads/${upload.id}`, duplicate: false }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      const winner = await prisma.upload.findUnique({ where: { idempotencyKey } });
      if (winner) return NextResponse.json({ url: `/api/uploads/${winner.id}`, duplicate: true });
    }
    throw error;
  }
});

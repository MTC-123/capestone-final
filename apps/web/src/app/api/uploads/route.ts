export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { requireUser } from '@/lib/security/guards';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { audit } from '@/lib/audit/log';
import { MAX_UPLOAD_BYTES, detectImageType, readImageSize, stripJpegMetadata } from '@/lib/uploads/image';

const KEY_PATTERN = /^[A-Za-z0-9:_-]{8,120}$/;

function uploadUrl(id: string) {
  return `/api/uploads/${id}`;
}

/**
 * Accepts one photo as multipart/form-data (`file`, optional `key`).
 * Re-sending the same `key` returns the original upload, which is what makes
 * offline-queue retries safe.
 */
export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser(request);
  await enforceRateLimit('upload', request, user.userId);

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError(1005);

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }

  const file = form.get('file');
  const rawKey = form.get('key');
  if (!(file instanceof Blob)) throw new AppError(1001, { fields: [{ field: 'file', code: 'required' }] });
  if (rawKey !== null && (typeof rawKey !== 'string' || !KEY_PATTERN.test(rawKey))) {
    throw new AppError(1001, { fields: [{ field: 'key', code: 'invalid' }] });
  }
  const idempotencyKey = `${user.userId}:${typeof rawKey === 'string' ? rawKey : crypto.randomUUID()}`;

  const existing = await prisma.upload.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return NextResponse.json({ id: existing.id, url: uploadUrl(existing.id), duplicate: true });
  }

  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(1005);
  const original = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageType(original);
  if (!kind) {
    await audit({ action: 'upload.rejected', actor: user, outcome: 'DENIED', meta: { declaredType: file.type, size: file.size }, request });
    throw new AppError(1004);
  }

  const bytes = kind === 'image/jpeg' ? stripJpegMetadata(original) : original;
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const size = readImageSize(bytes, kind);
  const extension = kind.split('/')[1];

  let blobUrl: string | undefined;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const stored = await put(`reports/${sha256}.${extension}`, Buffer.from(bytes), {
      access: 'public',
      contentType: kind,
      addRandomSuffix: true,
    });
    blobUrl = stored.url;
  }

  try {
    const upload = await prisma.upload.create({
      data: {
        ownerId: user.userId,
        idempotencyKey,
        contentType: kind,
        size: bytes.byteLength,
        sha256,
        width: size?.width,
        height: size?.height,
        blobUrl,
        data: blobUrl ? undefined : Buffer.from(bytes),
      },
    });
    await audit({ action: 'upload.create', actor: user, targetType: 'upload', targetId: upload.id, meta: { size: upload.size, contentType: kind }, request });
    return NextResponse.json({ id: upload.id, url: uploadUrl(upload.id), duplicate: false }, { status: 201 });
  } catch (error) {
    // A concurrent retry with the same key won the insert.
    if ((error as { code?: string })?.code === 'P2002') {
      const winner = await prisma.upload.findUnique({ where: { idempotencyKey } });
      if (winner) return NextResponse.json({ id: winner.id, url: uploadUrl(winner.id), duplicate: true });
    }
    throw error;
  }
});

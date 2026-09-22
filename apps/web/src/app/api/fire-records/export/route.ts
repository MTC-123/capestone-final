export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { recordsToCSV, recordsToGeoJSON } from '@/lib/fire-records/export';
import { generateFireRecordPdf } from '@/lib/fire-records/pdfExport';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'csv';
  const id = url.searchParams.get('id') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const alertSource = url.searchParams.get('alertSource') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;

  // PDF export for single record
  if (format === 'pdf' && id) {
    try {
      const record = await prisma.fireEventRecord.findUnique({ where: { id } });
      if (!record) throw new AppError(8000);

      const pdfBuffer = generateFireRecordPdf({
        id: record.id,
        incidentId: record.incidentId,
        recordStatus: record.recordStatus,
        alertSource: record.alertSource,
        burnAreaHa: record.burnAreaHa,
        createdAt: record.createdAt.toISOString(),
        alertReceivedAt: record.alertReceivedAt?.toISOString(),
        firstResponseAt: record.firstResponseAt?.toISOString(),
        containedAt: record.containedAt?.toISOString(),
        extinguishedAt: record.extinguishedAt?.toISOString(),
        locationDetail: record.locationDetail as Record<string, unknown> | null,
        causeDetail: record.causeDetail as Record<string, unknown> | null,
        damageDetail: record.damageDetail as Record<string, unknown> | null,
        responseDetail: record.responseDetail as Record<string, unknown> | null,
        weatherAtTime: record.weatherAtTime as Record<string, unknown> | null,
        postFire: record.postFire as Record<string, unknown> | null,
      });

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="fire-record-${id.slice(-8)}.pdf"`,
        },
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(8012, { cause: err });
    }
  }

  const where: Record<string, unknown> = {};
  if (status) where.recordStatus = status;
  if (alertSource) where.alertSource = alertSource;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    };
  }

  try {
    const records = await prisma.fireEventRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'geojson') {
      const geojson = recordsToGeoJSON(records);
      return new Response(JSON.stringify(geojson), {
        status: 200,
        headers: {
          'Content-Type': 'application/geo+json',
          'Content-Disposition': 'attachment; filename="fire-records.geojson"',
        },
      });
    }

    // Shapefile format — return GeoJSON as zip-compatible download
    if (format === 'shapefile') {
      const geojson = recordsToGeoJSON(records);
      return new Response(JSON.stringify(geojson), {
        status: 200,
        headers: {
          'Content-Type': 'application/geo+json',
          'Content-Disposition': 'attachment; filename="fire-records-shapefile.geojson"',
        },
      });
    }

    const csv = recordsToCSV(records);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="fire-records.csv"',
      },
    });
  } catch (err) {
    throw new AppError(8008, { cause: err });
  }
});

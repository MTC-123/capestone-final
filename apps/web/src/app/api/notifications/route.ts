import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { Notification, NotificationType } from '@/types';

export const dynamic = 'force-dynamic';

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_SOURCE_ITEMS = 10;
const MAX_NOTIFICATIONS = 10;

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  const notifications: Notification[] = [];
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  try {
    const { prisma } = await import('@/lib/prisma');

    const reportWhere: Prisma.ReportWhereInput = {
      createdAt: { gte: since },
    };
    if (user.role !== 'OFFICIAL') {
      reportWhere.userId = user.userId;
    }

    const recentReports = await prisma.report.findMany({
      take: MAX_SOURCE_ITEMS,
      orderBy: { createdAt: 'desc' },
      where: reportWhere,
      select: {
        id: true,
        referenceNumber: true,
        description: true,
        createdAt: true,
        status: true,
      },
    });

    for (const report of recentReports) {
      const reference = report.referenceNumber ?? report.id.slice(0, 8);
      notifications.push({
        id: `report-${report.id}`,
        type: 'NEW_REPORT' as NotificationType,
        title: `New report ${reference}`,
        body: report.description?.slice(0, 140) ?? '',
        read: false,
        createdAt: report.createdAt.toISOString(),
        referenceId: report.id,
        referenceUrl: `/reports-list?report=${report.id}`,
      });
    }

    const recentIncidents = await prisma.incident.findMany({
      take: MAX_SOURCE_ITEMS,
      orderBy: { updatedAt: 'desc' },
      where: {
        updatedAt: { gte: since },
      },
      select: { id: true, status: true, updatedAt: true, reportId: true },
    });

    let visibleIncidents = recentIncidents;
    if (user.role !== 'OFFICIAL') {
      const reportIds = recentIncidents
        .map((incident) => incident.reportId)
        .filter((reportId): reportId is string => Boolean(reportId));

      const ownedReports = reportIds.length
        ? await prisma.report.findMany({
            where: {
              id: { in: reportIds },
              userId: user.userId,
            },
            select: { id: true },
          })
        : [];
      const ownedReportIds = new Set(ownedReports.map((report) => report.id));
      visibleIncidents = recentIncidents.filter((incident) =>
        Boolean(incident.reportId && ownedReportIds.has(incident.reportId))
      );
    }

    for (const incident of visibleIncidents) {
      notifications.push({
        id: `incident-${incident.id}-${incident.status}`,
        type: 'STATUS_CHANGE' as NotificationType,
        title: `Incident status: ${incident.status}`,
        body: `Incident #${incident.id.slice(0, 6)} updated to ${incident.status}`,
        read: false,
        createdAt: incident.updatedAt.toISOString(),
        referenceId: incident.id,
        referenceUrl: `/map?selected=${incident.id}`,
      });
    }
  } catch {
    // Notification failures should not break the top navigation.
  }

  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const response = NextResponse.json({ notifications: notifications.slice(0, MAX_NOTIFICATIONS) });
  response.headers.set('Cache-Control', 'no-store');
  return response;
});

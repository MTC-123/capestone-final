import type { SeedRng } from './rng';

export interface AuditLogInput {
  actorId?: string;
  actorCin?: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE';
  meta?: Record<string, unknown>;
  createdAt: Date;
}

export interface BuildAuditLogsArgs {
  r: SeedRng;
  officialCin: string;
  officialId: string;
  civilianCin: string;
  civilianId: string;
  activeIncidentId: string;
  primaryFireRecordId?: string;
  officialRequestIds: string[];
  reportIds: string[];
}

export function buildAuditLogs(args: BuildAuditLogsArgs): AuditLogInput[] {
  const { r, officialCin, officialId, civilianCin, civilianId, activeIncidentId, primaryFireRecordId, officialRequestIds, reportIds } = args;
  const now = new Date('2026-09-24T11:00:00Z');
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  const entries: AuditLogInput[] = [
    { actorId: civilianId, actorCin: civilianCin, actorRole: 'CIVILIAN', action: 'auth.signup', targetType: 'user', targetId: civilianId, createdAt: minsAgo(60 * 24 * 40) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'auth.signin', targetType: 'user', targetId: officialId, createdAt: minsAgo(180) },
    { actorId: civilianId, actorCin: civilianCin, actorRole: 'CIVILIAN', action: 'auth.signin', targetType: 'user', targetId: civilianId, createdAt: minsAgo(210) },
    { actorCin: 'XX000000', actorRole: 'CIVILIAN', action: 'auth.signin_failed', outcome: 'DENIED', meta: { reason: 'invalid_password' }, createdAt: minsAgo(400) },
    { actorCin: 'XX000000', actorRole: 'CIVILIAN', action: 'auth.signin_failed', outcome: 'DENIED', meta: { reason: 'invalid_password' }, createdAt: minsAgo(398) },
    { actorCin: 'XX000000', actorRole: 'CIVILIAN', action: 'auth.locked', outcome: 'DENIED', meta: { reason: 'too_many_attempts' }, createdAt: minsAgo(395) },
    { actorId: civilianId, actorCin: civilianCin, actorRole: 'CIVILIAN', action: 'report.create', targetType: 'report', targetId: r.pick(reportIds), createdAt: minsAgo(90) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'report.status_change', targetType: 'report', targetId: r.pick(reportIds), meta: { from: 'PENDING', to: 'IN_PROGRESS' }, createdAt: minsAgo(70) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'incident.create', targetType: 'incident', targetId: activeIncidentId, createdAt: minsAgo(540) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'incident.update', targetType: 'incident', targetId: activeIncidentId, meta: { status: 'INTERVENTION' }, createdAt: minsAgo(500) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'dispatch.assign', targetType: 'incident', targetId: activeIncidentId, meta: { unit: 'FT-AZR-02' }, createdAt: minsAgo(480) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'dispatch.status_change', targetType: 'incident', targetId: activeIncidentId, meta: { status: 'ON_SCENE' }, createdAt: minsAgo(440) },
    { actorId: civilianId, actorCin: civilianCin, actorRole: 'CIVILIAN', action: 'official_request.create', targetType: 'official_request', targetId: officialRequestIds[0], createdAt: minsAgo(60 * 24 * 10) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'official_request.create', targetType: 'official_request', targetId: officialRequestIds[1], createdAt: minsAgo(60 * 24 * 5) },
  ];

  if (primaryFireRecordId) {
    entries.push(
      { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'fire_record.verify', targetType: 'fire_record', targetId: primaryFireRecordId, createdAt: minsAgo(60 * 24 * 70) },
      { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'fire_record.lock', targetType: 'fire_record', targetId: primaryFireRecordId, createdAt: minsAgo(60 * 24 * 69) },
    );
  }

  entries.push(
    { actorId: civilianId, actorCin: civilianCin, actorRole: 'CIVILIAN', action: 'upload.create', targetType: 'report', targetId: r.pick(reportIds), createdAt: minsAgo(85) },
    { actorId: civilianId, actorCin: civilianCin, actorRole: 'CIVILIAN', action: 'upload.rejected', outcome: 'FAILURE', meta: { reason: 'file_too_large' }, createdAt: minsAgo(84) },
    { actorId: officialId, actorCin: officialCin, actorRole: 'OFFICIAL', action: 'auth.logout', targetType: 'user', targetId: officialId, createdAt: minsAgo(30) },
  );

  return entries;
}

export interface NotificationDeliveryInput {
  event: string;
  channel: 'IN_APP' | 'EMAIL' | 'WHATSAPP';
  recipient: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';
  adapter: string;
  attempts: number;
  lastError?: string;
  payload?: Record<string, unknown>;
  targetType?: string;
  targetId?: string;
  sentAt?: Date;
  createdAt: Date;
}

export interface BuildNotificationsArgs {
  r: SeedRng;
  officialPhones: string[];
  officialEmails: string[];
  activeIncidentId: string;
  reportIds: string[];
}

export function buildNotificationDeliveries(args: BuildNotificationsArgs): NotificationDeliveryInput[] {
  const { r, officialPhones, officialEmails, activeIncidentId, reportIds } = args;
  const now = new Date('2026-09-24T11:00:00Z');
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  const out: NotificationDeliveryInput[] = [];

  // report.submitted -> in-app + email fanout to officials
  for (let i = 0; i < 5; i++) {
    const createdAt = minsAgo(r.int(30, 600));
    out.push({
      event: 'report.submitted',
      channel: 'IN_APP',
      recipient: r.pick(officialPhones),
      status: 'SENT',
      adapter: 'inapp-adapter',
      attempts: 1,
      targetType: 'report',
      targetId: r.pick(reportIds),
      sentAt: createdAt,
      createdAt,
    });
  }

  for (let i = 0; i < 4; i++) {
    const createdAt = minsAgo(r.int(30, 600));
    out.push({
      event: 'report.submitted',
      channel: 'EMAIL',
      recipient: r.pick(officialEmails),
      status: r.bool(0.85) ? 'SENT' : 'FAILED',
      adapter: 'smtp-adapter',
      attempts: r.int(1, 2),
      lastError: undefined,
      targetType: 'report',
      targetId: r.pick(reportIds),
      sentAt: createdAt,
      createdAt,
    });
  }

  // dispatch.assigned -> WhatsApp to field officials (Twilio adapter)
  for (let i = 0; i < 4; i++) {
    const createdAt = minsAgo(r.int(60, 500));
    const configured = i % 3 !== 0; // simulate Twilio not always configured
    out.push({
      event: 'dispatch.assigned',
      channel: 'WHATSAPP',
      recipient: r.pick(officialPhones),
      status: configured ? 'SENT' : 'SKIPPED',
      adapter: 'twilio-whatsapp',
      attempts: configured ? 1 : 0,
      lastError: configured ? undefined : 'twilio_not_configured',
      targetType: 'incident',
      targetId: activeIncidentId,
      sentAt: configured ? createdAt : undefined,
      createdAt,
    });
  }

  // official_request.decided
  out.push({
    event: 'official_request.decided',
    channel: 'EMAIL',
    recipient: r.pick(officialEmails),
    status: 'SENT',
    adapter: 'smtp-adapter',
    attempts: 1,
    targetType: 'official_request',
    sentAt: minsAgo(60 * 24 * 3),
    createdAt: minsAgo(60 * 24 * 3),
  });

  // report.status_changed
  for (let i = 0; i < 3; i++) {
    const createdAt = minsAgo(r.int(40, 300));
    out.push({
      event: 'report.status_changed',
      channel: 'IN_APP',
      recipient: r.pick(officialPhones),
      status: 'SENT',
      adapter: 'inapp-adapter',
      attempts: 1,
      targetType: 'report',
      targetId: r.pick(reportIds),
      sentAt: createdAt,
      createdAt,
    });
  }

  // a couple of queued/failed ones for realism
  out.push(
    {
      event: 'dispatch.assigned', channel: 'EMAIL', recipient: r.pick(officialEmails), status: 'QUEUED', adapter: 'smtp-adapter', attempts: 0,
      targetType: 'incident', targetId: activeIncidentId, createdAt: minsAgo(2),
    },
    {
      event: 'report.submitted', channel: 'WHATSAPP', recipient: r.pick(officialPhones), status: 'FAILED', adapter: 'twilio-whatsapp', attempts: 3,
      lastError: 'rate_limited', targetType: 'report', targetId: r.pick(reportIds), createdAt: minsAgo(15),
    },
  );

  return out;
}

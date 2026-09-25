/**
 * RICER Ifrane — demo database seed.
 *
 * Re-runnable: wipes the demo collections (deleteMany, dependency order)
 * then inserts a full, internally-consistent dataset — a live "campagne
 * 2026" wildfire season for Ifrane Province — using a seeded PRNG so every
 * run produces the exact same data (same counts, same reference numbers).
 *
 * Refuses to run against NODE_ENV=production unless SEED_ALLOW_PRODUCTION=true.
 *
 * Usage: npm run prisma:seed   (== npx tsx prisma/seed.ts)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { createRng, referenceNumber, jitter as jitterPoint } from './seed-data/rng';
import { point, zoneByKey, STATIONS, TOWNS, type ForestZoneKey } from './seed-data/geo';
import { CIVILIANS, OFFICIALS, OFFICIAL_REQUESTS } from './seed-data/users';
import { INCIDENTS } from './seed-data/incidents';
import { ORIGIN_REPORTS, buildAdditionalReports, type ReportSeed } from './seed-data/reports';
import { VEHICLES, TEAMS } from './seed-data/fleet';
import { EQUIPMENT, RETARDANT_PRODUCTS, INFRASTRUCTURE } from './seed-data/equipment';
import {
  AGENCY_STATUSES,
  COMMUNICATION_LOGS,
  ICS_ASSIGNMENTS,
  POI_ACTIVATION_SLOT,
  MUTUAL_AID_SLOT,
} from './seed-data/coordination';
import { CAMPAIGN_2026, CHECKLIST_ITEMS } from './seed-data/campaign';
import { buildFireEventRecord, DEBRIEFING_INCIDENT_INDICES, EQUIPMENT_AUDIT_INCIDENT_INDEX } from './seed-data/fireRecords';
import { buildAuditLogs, buildNotificationDeliveries } from './seed-data/auditNotifications';

const prisma = new PrismaClient();
const SEED = 20260601;
const BCRYPT_COST = 12;

// ── Guard rails ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  console.error(
    '\nRefusing to seed: NODE_ENV=production.\n' +
      'This wipes and repopulates demo collections. If you really mean to seed the\n' +
      'Atlas demo database on purpose, re-run with SEED_ALLOW_PRODUCTION=true.\n'
  );
  process.exit(1);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}

const COMMUNE_BY_ZONE: Record<ForestZoneKey, string> = {
  cedreGouraud: TOWNS.ifrane.name,
  michlifenSlopes: TOWNS.ifrane.name,
  parcCentral: TOWNS.ifrane.name,
  tizguit: TOWNS.ifrane.name,
  jbelHebri: TOWNS.ifrane.name,
  ainLeuhForest: TOWNS.ainLeuh.name,
  timahditeForest: TOWNS.timahdite.name,
  tighboula: TOWNS.benSmim.name,
  ainVittelForest: TOWNS.ifrane.name,
  ajdirAzrou: TOWNS.azrou.name,
};

async function wipe() {
  // Children first, then parents, mirroring the FK-shaped references that
  // Mongo doesn't enforce for us.
  await prisma.notificationDelivery.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.debriefing.deleteMany({});
  await prisma.equipmentAudit.deleteMany({});
  await prisma.phaseChecklist.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.mutualAidRequest.deleteMany({});
  await prisma.iCSAssignment.deleteMany({});
  await prisma.pOIActivation.deleteMany({});
  await prisma.communicationLog.deleteMany({});
  await prisma.agencyStatus.deleteMany({});
  await prisma.fireEventRecord.deleteMany({});
  await prisma.dispatch.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.resource.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.retardantProduct.deleteMany({});
  await prisma.infrastructure.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.officialRequest.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
}

async function main() {
  const r = createRng(SEED);
  const counts: Record<string, number> = {};

  console.log('Wiping demo collections...');
  await wipe();

  // ── Users ────────────────────────────────────────────────────────────
  console.log('Seeding users...');
  const civilianIds = CIVILIANS.map(() => r.objectId());
  const officialIds = OFFICIALS.map(() => r.objectId());

  const civilianData = await Promise.all(
    CIVILIANS.map(async (c, i) => ({
      id: civilianIds[i],
      cin: c.cin,
      phone: c.phone,
      password: await bcrypt.hash(c.password, BCRYPT_COST),
      role: 'CIVILIAN' as const,
      fullName: c.fullName,
      email: c.email,
    }))
  );
  const officialData = await Promise.all(
    OFFICIALS.map(async (o, i) => ({
      id: officialIds[i],
      cin: o.cin,
      phone: o.phone,
      password: await bcrypt.hash(o.password, BCRYPT_COST),
      role: 'OFFICIAL' as const,
      fullName: o.fullName,
      department: o.department,
      position: o.position,
      email: o.email,
    }))
  );
  await prisma.user.createMany({ data: [...civilianData, ...officialData] });
  counts.User = civilianData.length + officialData.length;

  // Agency the primary official-per-department maps to, for authorship on
  // coordination records.
  const officialAgencyOrder: Record<number, string> = { 0: 'DEF', 1: 'PROTECTION_CIVILE', 2: 'GENDARMERIE_ROYALE', 3: 'AUTORITES_LOCALES' };
  function officialIndexForAgency(agency?: string): number {
    if (!agency) return 0;
    const idx = Object.entries(officialAgencyOrder).find(([, a]) => a === agency)?.[0];
    return idx ? Number(idx) : 0;
  }

  // ── Official requests (pending approvals) ───────────────────────────
  console.log('Seeding official requests...');
  const officialRequestIds = OFFICIAL_REQUESTS.map(() => r.objectId());
  const civilianIdByCin = new Map(CIVILIANS.map((c, i) => [c.cin, civilianIds[i]]));
  await prisma.officialRequest.createMany({
    data: OFFICIAL_REQUESTS.map((req, i) => ({
      id: officialRequestIds[i],
      userId: civilianIdByCin.get(req.civilianCin)!,
      department: req.department,
      position: req.position,
      justification: req.justification,
      status: 'PENDING' as const,
      createdAt: new Date('2026-09-14T09:00:00Z'),
    })),
  });
  counts.OfficialRequest = OFFICIAL_REQUESTS.length;

  // ── Incidents ────────────────────────────────────────────────────────
  console.log('Seeding incidents...');
  const incidentIds = INCIDENTS.map(() => r.objectId());
  // Report ids are pre-generated (before report content) so incidents can
  // reference the report that triggered them, and vice versa.
  const NUM_REPORTS = 40;
  const reportIds = Array.from({ length: NUM_REPORTS }, () => r.objectId());

  const incidentGeo = INCIDENTS.map((inc) => {
    const zone = zoneByKey(inc.zoneKey);
    const [lat, lng] = jitterPoint(r, zone.lat, zone.lng, zone.radius);
    return { lat, lng, zone };
  });

  const incidentCreatedAt = INCIDENTS.map((inc) => new Date(inc.createdAt));
  const incidentUpdatedAt = INCIDENTS.map((inc, i) => (inc.updatedAt ? new Date(inc.updatedAt) : incidentCreatedAt[i]));

  await prisma.incident.createMany({
    data: INCIDENTS.map((inc, i) => ({
      id: incidentIds[i],
      location: point(incidentGeo[i].lat, incidentGeo[i].lng),
      cause: inc.cause,
      severity: inc.severity,
      status: inc.status,
      description: inc.description,
      reportId: inc.originReportIndex !== undefined ? reportIds[inc.originReportIndex] : undefined,
      investigationStatus: inc.investigationStatus,
      investigationNotes: inc.investigationNotes,
      legalFollowUp: inc.legalFollowUp,
      createdAt: incidentCreatedAt[i],
      updatedAt: incidentUpdatedAt[i],
    })),
  });
  counts.Incident = INCIDENTS.length;

  const activeIndices = INCIDENTS.map((inc, i) => (inc.active ? i : -1)).filter((i) => i >= 0);
  const activeSlots = activeIndices.map((i) => ({
    incidentIndex: i,
    id: incidentIds[i],
    lat: incidentGeo[i].lat,
    lng: incidentGeo[i].lng,
    createdAt: incidentCreatedAt[i],
  }));

  // ── Reports ──────────────────────────────────────────────────────────
  console.log('Seeding reports...');
  const additionalReports = buildAdditionalReports(r, NUM_REPORTS - ORIGIN_REPORTS.length);
  // Link a handful of the extra reports as second/third confirmations of
  // the live incidents (realistic — multiple citizens report the same fire).
  const confirmPool = Array.from({ length: additionalReports.length }, (_, i) => i);
  const confirmIdxs = r.pickN(confirmPool, 5);
  confirmIdxs.forEach((idx) => {
    additionalReports[idx].linkedIncidentIndex = r.pick(activeIndices);
  });
  const allReportSeeds: ReportSeed[] = [...ORIGIN_REPORTS, ...additionalReports];

  const originIncidentIndexByReportIndex = new Map<number, number>();
  INCIDENTS.forEach((inc, i) => {
    if (inc.originReportIndex !== undefined) originIncidentIndexByReportIndex.set(inc.originReportIndex, i);
  });

  let refSeq = 1;
  await prisma.report.createMany({
    data: allReportSeeds.map((rep, i) => {
      const createdAt = new Date(rep.createdAt);
      const originIdx = originIncidentIndexByReportIndex.get(i);
      const incidentId = originIdx !== undefined ? incidentIds[originIdx] : rep.linkedIncidentIndex !== undefined ? incidentIds[rep.linkedIncidentIndex] : undefined;
      return {
        id: reportIds[i],
        userId: civilianIds[rep.civilianIndex],
        latitude: rep.lat,
        longitude: rep.lng,
        description: rep.description,
        images: [],
        status: rep.status,
        cause: rep.cause,
        incidentId,
        anonymous: rep.anonymous,
        contactPhone: rep.anonymous ? undefined : rep.contactPhone,
        characteristics: rep.characteristics as unknown as Prisma.InputJsonValue,
        referenceNumber: referenceNumber(createdAt, refSeq++),
        clientSubmissionId: r.uuid(),
        createdAt,
        updatedAt: createdAt,
      };
    }),
  });
  counts.Report = allReportSeeds.length;

  // ── Fleet: vehicles + teams ──────────────────────────────────────────
  console.log('Seeding vehicles and teams...');
  const vehicleIds = VEHICLES.map(() => r.objectId());
  const vehicleAssignedIncidentId: (string | undefined)[] = [];
  await prisma.vehicle.createMany({
    data: VEHICLES.map((v, i) => {
      const station = STATIONS[v.baseStation];
      const base = point(station.lat, station.lng);
      let location = base;
      let assignedTo: string | undefined;
      if (v.assignedActiveSlot !== undefined && activeSlots[v.assignedActiveSlot]) {
        const target = activeSlots[v.assignedActiveSlot];
        assignedTo = target.id;
        if (v.status === 'ON_SCENE') location = point(target.lat, target.lng);
        else if (v.status === 'EN_ROUTE') location = point((station.lat + target.lat) / 2, (station.lng + target.lng) / 2);
      }
      vehicleAssignedIncidentId.push(assignedTo);
      return {
        id: vehicleIds[i],
        callSign: v.callSign,
        type: v.type,
        status: v.status,
        capabilities: v.capabilities,
        baseLocation: base,
        location,
        assignedTo,
        capacity: v.capacity,
      };
    }),
  });
  counts.Vehicle = VEHICLES.length;

  const teamIds = TEAMS.map(() => r.objectId());
  const teamAssignedIncidentId: (string | undefined)[] = [];
  await prisma.team.createMany({
    data: TEAMS.map((t, i) => {
      const station = STATIONS[t.baseStation];
      let location = point(station.lat, station.lng);
      let assignedTo: string | undefined;
      if (t.assignedActiveSlot !== undefined && activeSlots[t.assignedActiveSlot]) {
        const target = activeSlots[t.assignedActiveSlot];
        assignedTo = target.id;
        if (t.status === 'ON_SCENE') location = point(target.lat, target.lng);
        else if (t.status === 'EN_ROUTE') location = point((station.lat + target.lat) / 2, (station.lng + target.lng) / 2);
      }
      teamAssignedIncidentId.push(assignedTo);
      return {
        id: teamIds[i],
        name: t.name,
        type: t.type,
        status: t.status,
        location,
        assignedTo,
        capacity: t.capacity,
        equipment: t.equipment,
      };
    }),
  });
  counts.Team = TEAMS.length;

  // Minimal legacy `Resource` rows so /api/geo/resources keeps working.
  await prisma.resource.createMany({
    data: [
      { type: 'TRUCK', name: 'FT-IFR-01', location: point(STATIONS.pcIfrane.lat, STATIONS.pcIfrane.lng), status: 'Disponible' },
      { type: 'TRUCK', name: 'FT-AZR-02', location: point(activeSlots[1].lat, activeSlots[1].lng), status: 'Sur place', assignedTo: 'Cèdre Gouraud' },
      { type: 'AIRCRAFT', name: 'HELI-DEF-01', location: point(STATIONS.helipadIfrane.lat, STATIONS.helipadIfrane.lng), status: 'En route', assignedTo: 'Cèdre Gouraud' },
      { type: 'PERSONNEL', name: 'Équipe Sol Ifrane Bravo', location: point(activeSlots[0].lat, activeSlots[0].lng), status: 'Sur place', assignedTo: "Parc National d'Ifrane" },
      { type: 'PERSONNEL', name: 'Équipe Sol Azrou Alpha', location: point(STATIONS.pcAzrou.lat, STATIONS.pcAzrou.lng), status: 'Disponible' },
      { type: 'EQUIPMENT', name: 'Groupe électrogène', location: point(STATIONS.pcIfrane.lat, STATIONS.pcIfrane.lng), status: 'Disponible' },
    ],
  });
  counts.Resource = 6;

  // ── Dispatch records for the active incidents ───────────────────────
  console.log('Seeding dispatch records...');
  const dispatchData: Prisma.DispatchCreateManyInput[] = [];
  VEHICLES.forEach((v, i) => {
    if (v.assignedActiveSlot === undefined) return;
    const slot = activeSlots[v.assignedActiveSlot];
    if (!slot) return;
    const station = STATIONS[v.baseStation];
    const distanceKm = Math.round(haversineKm(station, slot) * 10) / 10;
    const durationMin = Math.round((distanceKm / 35) * 60 + r.int(2, 8));
    const assignedAt = new Date(slot.createdAt.getTime() + r.int(2, 15) * 60_000);
    const eta = new Date(assignedAt.getTime() + durationMin * 60_000);
    const status: 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' = v.status === 'ON_SCENE' ? 'ARRIVED' : v.status === 'EN_ROUTE' ? 'EN_ROUTE' : 'ASSIGNED';
    dispatchData.push({
      id: r.objectId(),
      incidentId: slot.id,
      vehicleId: vehicleIds[i],
      status,
      route: {
        type: 'LineString',
        coordinates: [[station.lng, station.lat], [slot.lng, slot.lat]],
      },
      distance: distanceKm,
      duration: durationMin,
      eta,
      assignedBy: officialIds[0],
      assignedAt,
      arrivedAt: status === 'ARRIVED' ? eta : undefined,
    });
  });
  TEAMS.forEach((t, i) => {
    if (t.assignedActiveSlot === undefined) return;
    const slot = activeSlots[t.assignedActiveSlot];
    if (!slot) return;
    const station = STATIONS[t.baseStation];
    const distanceKm = Math.round(haversineKm(station, slot) * 10) / 10;
    const durationMin = Math.round((distanceKm / 12) * 60 + r.int(3, 10)); // ground crews move slower
    const assignedAt = new Date(slot.createdAt.getTime() + r.int(2, 15) * 60_000);
    const eta = new Date(assignedAt.getTime() + durationMin * 60_000);
    const status: 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' = t.status === 'ON_SCENE' ? 'ARRIVED' : t.status === 'EN_ROUTE' ? 'EN_ROUTE' : 'ASSIGNED';
    dispatchData.push({
      id: r.objectId(),
      incidentId: slot.id,
      teamId: teamIds[i],
      status,
      route: {
        type: 'LineString',
        coordinates: [[station.lng, station.lat], [slot.lng, slot.lat]],
      },
      distance: distanceKm,
      duration: durationMin,
      eta,
      assignedBy: officialIds[0],
      assignedAt,
      arrivedAt: status === 'ARRIVED' ? eta : undefined,
    });
  });
  await prisma.dispatch.createMany({ data: dispatchData });
  counts.Dispatch = dispatchData.length;

  // ── Equipment, retardant, infrastructure ─────────────────────────────
  console.log('Seeding equipment, retardant stock and infrastructure...');
  await prisma.equipment.createMany({
    data: EQUIPMENT.map((e) => ({
      id: r.objectId(),
      name: e.name,
      type: e.type,
      status: e.status,
      quantity: e.quantity,
      department: e.department,
      latitude: e.lat,
      longitude: e.lng,
      lastMaintenance: e.lastMaintenance ? new Date(e.lastMaintenance) : undefined,
      notes: e.notes,
    })),
  });
  counts.Equipment = EQUIPMENT.length;

  await prisma.retardantProduct.createMany({
    data: RETARDANT_PRODUCTS.map((p) => ({
      id: r.objectId(),
      name: p.name,
      type: p.type,
      quantity: p.quantity,
      unit: p.unit,
      storageLocation: p.storageLocation,
      storageLat: p.lat,
      storageLng: p.lng,
      acquisitionDate: new Date(p.acquisitionDate),
      expiryDate: p.expiryDate ? new Date(p.expiryDate) : undefined,
      notes: p.notes,
    })),
  });
  counts.RetardantProduct = RETARDANT_PRODUCTS.length;

  await prisma.infrastructure.createMany({
    data: INFRASTRUCTURE.map((i) => ({
      id: r.objectId(),
      name: i.name,
      type: i.type,
      status: i.status,
      latitude: i.lat,
      longitude: i.lng,
      capacity: i.capacity,
      capacityUnit: i.capacityUnit,
      lastInspectionDate: i.lastInspectionDate ? new Date(i.lastInspectionDate) : undefined,
      notes: i.notes,
    })),
  });
  counts.Infrastructure = INFRASTRUCTURE.length;

  // ── Coordination: agencies, comms, ICS, POI, mutual aid ──────────────
  console.log('Seeding coordination records...');
  await prisma.agencyStatus.createMany({
    data: AGENCY_STATUSES.map((a) => ({
      id: r.objectId(),
      agency: a.agency,
      status: a.status,
      unitsAvailable: a.unitsAvailable,
      unitsDeployed: a.unitsDeployed,
      aviationStatus: a.aviationStatus,
      contactName: a.contactName,
      contactPhone: a.contactPhone,
      contactEmail: a.contactEmail,
      notes: a.notes,
      lastHeartbeat: new Date('2026-09-24T10:55:00Z'),
      updatedBy: OFFICIALS[0].cin,
    })),
  });
  counts.AgencyStatus = AGENCY_STATUSES.length;

  await prisma.communicationLog.createMany({
    data: COMMUNICATION_LOGS.map((log) => {
      const slot = activeSlots[log.activeSlot];
      const authorIdx = officialIndexForAgency(log.fromAgency);
      return {
        id: r.objectId(),
        incidentId: slot.id,
        category: log.category,
        fromAgency: log.fromAgency,
        toAgency: log.toAgency,
        message: log.message,
        authorId: officialIds[authorIdx],
        authorCin: OFFICIALS[authorIdx].cin,
        createdAt: new Date(slot.createdAt.getTime() + log.minutesOffset * 60_000),
      };
    }),
  });
  counts.CommunicationLog = COMMUNICATION_LOGS.length;

  await prisma.iCSAssignment.createMany({
    data: ICS_ASSIGNMENTS.map((ics, i) => {
      const slot = activeSlots[ics.activeSlot];
      return {
        id: r.objectId(),
        incidentId: slot.id,
        role: ics.role,
        assigneeName: ics.assigneeName,
        assigneeAgency: ics.assigneeAgency,
        assigneePhone: ics.assigneePhone,
        assignedBy: OFFICIALS[0].cin,
        assignedAt: new Date(slot.createdAt.getTime() + (15 + i * 5) * 60_000),
        notes: ics.notes,
      };
    }),
  });
  counts.ICSAssignment = ICS_ASSIGNMENTS.length;

  const poiSlot = activeSlots[POI_ACTIVATION_SLOT];
  await prisma.pOIActivation.create({
    data: {
      incidentId: poiSlot.id,
      level: 'POI_2',
      activatedBy: OFFICIALS[0].cin,
      activatedAt: new Date(poiSlot.createdAt.getTime() + 90 * 60_000),
      notes: 'Escalade suite à la confirmation de propagation vers le versant nord (drone DPEFLCD).',
    },
  });
  counts.POIActivation = 1;

  const mutualAidSlot = activeSlots[MUTUAL_AID_SLOT];
  await prisma.mutualAidRequest.create({
    data: {
      incidentId: mutualAidSlot.id,
      requestingProvince: 'Ifrane',
      targetProvince: 'Meknès',
      resourceType: 'Camions-citernes (2) et équipe sol supplémentaire',
      justification: "Moyens locaux engagés à saturation sur l'incendie de la cédraie de Gouraud ; renfort nécessaire pour tenir la ligne nord.",
      status: 'APPROVED',
      respondedAt: new Date(mutualAidSlot.createdAt.getTime() + 130 * 60_000),
      respondedBy: OFFICIALS[0].cin,
      responseNotes: 'Renfort approuvé par la province de Meknès — délai de route estimé à 1h20.',
      requestedBy: OFFICIALS[3].cin,
      createdAt: new Date(mutualAidSlot.createdAt.getTime() + 105 * 60_000),
    },
  });
  counts.MutualAidRequest = 1;

  // ── Campaign 2026 ─────────────────────────────────────────────────────
  console.log('Seeding campaign 2026...');
  const campaign = await prisma.campaign.create({
    data: {
      year: CAMPAIGN_2026.year,
      label: CAMPAIGN_2026.label,
      status: CAMPAIGN_2026.status,
      activePhase: CAMPAIGN_2026.activePhase,
      seasonStart: new Date(CAMPAIGN_2026.seasonStart),
      seasonEnd: new Date(CAMPAIGN_2026.seasonEnd),
      notes: CAMPAIGN_2026.notes,
      createdBy: OFFICIALS[0].cin,
    },
  });
  counts.Campaign = 1;

  await prisma.phaseChecklist.createMany({
    data: CHECKLIST_ITEMS.map((item) => ({
      id: r.objectId(),
      campaignId: campaign.id,
      phase: item.phase,
      task: item.task,
      responsibleUnit: item.responsibleUnit,
      deadline: new Date(item.deadline),
      status: item.status,
      notes: item.notes,
      completedBy: item.completedBy,
      completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
      sortOrder: item.sortOrder,
    })),
  });
  counts.PhaseChecklist = CHECKLIST_ITEMS.length;

  // ── Fire event records for extinguished/closed incidents ────────────
  console.log('Seeding fire event records...');
  const resolvedIndices = INCIDENTS.map((inc, i) => ({ inc, i })).filter(({ inc }) => inc.status === 'ETEINT' || inc.status === 'MAITRISE' || inc.status === 'COMPLETED').map(({ i }) => i);

  const fireRecordIdByIncidentIndex = new Map<number, string>();
  const fireRecordCreateData: Prisma.FireEventRecordCreateManyInput[] = [];
  const fireRecordBurnAreaByIndex = new Map<number, number>();

  for (const i of resolvedIndices) {
    const inc = INCIDENTS[i];
    const geo = incidentGeo[i];
    const zone = geo.zone;
    const built = buildFireEventRecord(r, {
      incidentIndex: i,
      incidentId: incidentIds[i],
      actorCin: OFFICIALS[0].cin,
      cause: inc.cause,
      severity: inc.severity,
      status: inc.status,
      createdAt: incidentCreatedAt[i],
      updatedAt: incidentUpdatedAt[i],
      lat: geo.lat,
      lng: geo.lng,
      commune: COMMUNE_BY_ZONE[inc.zoneKey],
      forestName: zone.name,
      legalFollowUp: inc.legalFollowUp,
    });
    const id = r.objectId();
    fireRecordIdByIncidentIndex.set(i, id);
    fireRecordBurnAreaByIndex.set(i, built.burnAreaHa);
    fireRecordCreateData.push({ id, ...(built.data as Prisma.FireEventRecordCreateManyInput) });
  }
  await prisma.fireEventRecord.createMany({ data: fireRecordCreateData });
  counts.FireEventRecord = fireRecordCreateData.length;

  // ── Debriefings ───────────────────────────────────────────────────────
  console.log('Seeding debriefings...');
  const debriefingSpecs: Array<{ idx: number; data: Prisma.DebriefingCreateManyInput }> = [
    {
      idx: DEBRIEFING_INCIDENT_INDICES[0], // major Parc National lightning fire
      data: {
        id: r.objectId(),
        fireRecordId: fireRecordIdByIncidentIndex.get(DEBRIEFING_INCIDENT_INDICES[0])!,
        date: new Date(incidentCreatedAt[DEBRIEFING_INCIDENT_INDICES[0]].getTime() + 4 * 86_400_000),
        superficieIncendiee: fireRecordBurnAreaByIndex.get(DEBRIEFING_INCIDENT_INDICES[0]),
        heureDeclenchement: '11:30',
        typeEssence: "Cèdre de l'Atlas",
        alertePrecoce: true,
        alertePrecoceDetail: 'Détection FIRMS 35 minutes après le démarrage estimé, confirmée par le poste vigie Michlifen.',
        premiereIntervention: 'CEDEFO / Protection Civile',
        premiereInterventionDetail: 'VPI-01 et FT-IFR-03 arrivés en moins de 40 minutes.',
        vegetationSecondaire: 'Chêne vert, genévrier',
        topographie: ['FORTE_PENTE', 'VALLON'],
        pistesForestieres: true,
        pistesAmenagees: true,
        trancheesPF: true,
        trancheesPFAmenagees: true,
        pointsEau: true,
        pointsEauAccessible: true,
        pointsEauRempli: true,
        pointsEauUtilise: true,
        fonctionnaliteVPI: true,
        fonctionnaliteVPIDetail: 'Ensemble du parc VPI opérationnel tout au long de l\'intervention.',
        incidentLutte: 'Aucun incident notable, une légère brûlure superficielle sans arrêt de travail.',
        quAvaitEtePlanifie: "Intervention rapide avec deux équipes sol et appui aérien en réserve à Meknès.",
        quEstCeQuiEstArrive: "Vent de secteur nord-est plus soutenu que prévu, propagation accélérée en cime sur le versant nord ; renfort mutuel sollicité.",
        pourquoi: "Prévision météo locale non actualisée en temps réel au niveau du COS.",
        prochaineFois: "Intégrer un flux météo temps réel (vent, humidité) directement dans le tableau de bord du COS.",
        observationsParticulieres: 'Coordination DPEFLCD / Protection Civile / Gendarmerie jugée exemplaire par l\'ensemble des intervenants.',
        animateurNom: 'Benali',
        animateurQualite: 'Chef du Centre Provincial de Gestion des Risques',
        participants: [
          { nom: 'Benali', prenom: 'Karim', poste: 'COS' },
          { nom: 'Alaoui', prenom: 'Hassan', poste: 'Commandant Protection Civile' },
          { nom: 'Idrissi', prenom: 'Youssef', poste: "Chef d'équipe DPEFLCD" },
        ],
        status: 'completed',
      },
    },
    {
      idx: DEBRIEFING_INCIDENT_INDICES[1], // arson case on the Michlifen slopes
      data: {
        id: r.objectId(),
        fireRecordId: fireRecordIdByIncidentIndex.get(DEBRIEFING_INCIDENT_INDICES[1])!,
        date: new Date(incidentCreatedAt[DEBRIEFING_INCIDENT_INDICES[1]].getTime() + 3 * 86_400_000),
        superficieIncendiee: fireRecordBurnAreaByIndex.get(DEBRIEFING_INCIDENT_INDICES[1]),
        heureDeclenchement: '20:15',
        typeEssence: 'Chêne vert',
        alertePrecoce: false,
        alertePrecoceDetail: "Départs multiples simultanés — détection tardive de nuit, alerte via appel citoyen.",
        premiereIntervention: 'Protection Civile',
        premiereInterventionDetail: 'FT-AZR-02 mobilisé en urgence de nuit.',
        vegetationSecondaire: 'Maquis, broussailles sèches',
        topographie: ['PENTE_MODEREE'],
        pistesForestieres: true,
        pistesAmenagees: false,
        trancheesPF: false,
        pointsEau: true,
        pointsEauAccessible: true,
        pointsEauRempli: true,
        pointsEauUtilise: true,
        incidentLutte: "Périmètre de sécurité renforcé après indices de malveillance relevés sur site.",
        quAvaitEtePlanifie: "Aucune planification spécifique — départs de feu imprévisibles en pleine nuit.",
        quEstCeQuiEstArrive: "Trois foyers distincts allumés à quelques minutes d'intervalle, ralentissant la réponse initiale.",
        pourquoi: "Absence de patrouille nocturne dédiée sur ce secteur en dehors des pics de risque déclarés.",
        prochaineFois: "Renforcer la surveillance nocturne par drone thermique sur les secteurs sensibles identifiés.",
        observationsParticulieres: 'Dossier transmis à la Gendarmerie Royale — enquête en cours.',
        animateurNom: 'Alaoui',
        animateurQualite: 'Commandant, Caserne Protection Civile Ifrane',
        participants: [
          { nom: 'Alaoui', prenom: 'Hassan', poste: 'COS' },
          { nom: 'Tazi', prenom: 'Rachid', poste: 'Gendarmerie Royale' },
        ],
        status: 'completed',
      },
    },
  ];
  await prisma.debriefing.createMany({ data: debriefingSpecs.map((d) => d.data) });
  counts.Debriefing = debriefingSpecs.length;

  // ── Equipment audit (Annexe 2) for the flagship incident ─────────────
  console.log('Seeding equipment audit...');
  const auditIdx = EQUIPMENT_AUDIT_INCIDENT_INDEX;
  const auditZone = incidentGeo[auditIdx].zone;
  await prisma.equipmentAudit.create({
    data: {
      fireRecordId: fireRecordIdByIncidentIndex.get(auditIdx)!,
      verificationDate: new Date(incidentCreatedAt[auditIdx].getTime() + 2 * 86_400_000),
      auditType: 'general',
      dpeflcd: 'Direction Provinciale des Eaux et Forêts — Ifrane',
      secteur: auditZone.name,
      foret: auditZone.name,
      canton: COMMUNE_BY_ZONE[INCIDENTS[auditIdx].zoneKey],
      lieudit: auditZone.name,
      items: [
        { category: 'VPI', name: 'VPI-01', quantiteEngagee: 1, quantiteRendue: 1, quantitePerdue: 0, fonctionnel: true, aEntretenir: true, aRemplacer: false, quantiteNecessaire: 2, quantitePresente: 2 },
        { category: 'Motopompe', name: 'PMP-01', quantiteEngagee: 2, quantiteRendue: 2, quantitePerdue: 0, fonctionnel: true, aEntretenir: false, aRemplacer: false, quantiteNecessaire: 2, quantitePresente: 2 },
        { category: 'Outillage manuel', name: 'Battes à feu', quantiteEngagee: 20, quantiteRendue: 17, quantitePerdue: 3, fonctionnel: true, aEntretenir: false, aRemplacer: true, quantiteNecessaire: 20, quantitePresente: 17 },
        { category: 'Protection individuelle', name: 'Tenues ignifugées', quantiteEngagee: 15, quantiteRendue: 15, quantitePerdue: 0, fonctionnel: true, aEntretenir: true, aRemplacer: false, quantiteNecessaire: 15, quantitePresente: 15 },
        { category: 'Communication', name: 'Radios VHF portatives', quantiteEngagee: 10, quantiteRendue: 9, quantitePerdue: 1, fonctionnel: true, aEntretenir: false, aRemplacer: true, quantiteNecessaire: 10, quantitePresente: 9 },
      ],
      signedBy: OFFICIALS[0].fullName,
      signedByRole: OFFICIALS[0].position,
      donateur: 'DPEFLCD Ifrane',
      recepteur: 'Caserne Protection Civile Ifrane',
      status: 'validated',
    },
  });
  counts.EquipmentAudit = 1;

  // ── Audit log + notification delivery ────────────────────────────────
  console.log('Seeding audit log and notification deliveries...');
  const auditEntries = buildAuditLogs({
    r,
    officialCin: OFFICIALS[0].cin,
    officialId: officialIds[0],
    civilianCin: CIVILIANS[0].cin,
    civilianId: civilianIds[0],
    activeIncidentId: activeSlots[1].id,
    primaryFireRecordId: fireRecordIdByIncidentIndex.get(9),
    officialRequestIds,
    reportIds,
  });
  await prisma.auditLog.createMany({
    data: auditEntries.map((e) => ({ id: r.objectId(), ...e })) as Prisma.AuditLogCreateManyInput[],
  });
  counts.AuditLog = auditEntries.length;

  const notificationEntries = buildNotificationDeliveries({
    r,
    officialPhones: OFFICIALS.map((o) => o.phone),
    officialEmails: OFFICIALS.map((o) => o.email!).filter(Boolean),
    activeIncidentId: activeSlots[1].id,
    reportIds,
  });
  await prisma.notificationDelivery.createMany({
    data: notificationEntries.map((e) => ({ id: r.objectId(), ...e })) as Prisma.NotificationDeliveryCreateManyInput[],
  });
  counts.NotificationDelivery = notificationEntries.length;

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\nSeed complete. Collection counts:');
  const width = Math.max(...Object.keys(counts).map((k) => k.length)) + 2;
  for (const [model, count] of Object.entries(counts)) {
    console.log(`  ${model.padEnd(width)} ${count}`);
  }
  console.log(`\nDemo credentials:`);
  console.log(`  Civilian — CIN ${CIVILIANS[0].cin} / password123`);
  console.log(`  Official — CIN ${OFFICIALS[0].cin} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

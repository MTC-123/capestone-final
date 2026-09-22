import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Hash password for test users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create test users
  const civilian = await prisma.user.upsert({
    where: { cin: 'AB123456' },
    update: {},
    create: {
      cin: 'AB123456',
      phone: '+212612345678',
      password: hashedPassword,
      role: 'CIVILIAN',
    },
  });

  const official = await prisma.user.upsert({
    where: { cin: 'CD789012' },
    update: {},
    create: {
      cin: 'CD789012',
      phone: '+212687654321',
      password: hashedPassword,
      role: 'OFFICIAL',
      department: 'HCEFLCD',
      position: 'مدير العمليات الميدانية',
    },
  });

  console.log('Users created');

  // Create fire incidents around Ifrane (GeoJSON location + IncidentStatus)
  await prisma.incident.createMany({
    data: [
      {
        location: { type: 'Point', coordinates: [-5.1056, 33.5275] },
        cause: 'CAMPFIRE_UNATTENDED',
        severity: 3,
        status: 'ETEINT',
        description: 'حريق نار مخيم بالقرب من المركز',
      },
      {
        location: { type: 'Point', coordinates: [-5.1123, 33.5312] },
        cause: 'CIGARETTE',
        severity: 2,
        status: 'ETEINT',
        description: 'حريق صغير بسبب سيجارة',
      },
      {
        location: { type: 'Point', coordinates: [-5.0987, 33.5198] },
        cause: 'AGRICULTURAL_BURNING',
        severity: 4,
        status: 'INTERVENTION',
        description: 'حريق زراعي خارج عن السيطرة',
      },
      {
        location: { type: 'Point', coordinates: [-5.1189, 33.5356] },
        cause: 'LIGHTNING',
        severity: 5,
        status: 'ALERTE',
        description: 'حريق كبير بسبب صاعقة',
      },
      {
        location: { type: 'Point', coordinates: [-5.1134, 33.5243] },
        cause: 'ELECTRICAL',
        severity: 2,
        status: 'ETEINT',
      },
      {
        location: { type: 'Point', coordinates: [-5.0923, 33.5389] },
        cause: 'UNKNOWN',
        severity: 3,
        status: 'MAITRISE',
      },
      {
        location: { type: 'Point', coordinates: [-5.1212, 33.5156] },
        cause: 'ARSON',
        severity: 4,
        status: 'ALERTE',
        description: 'حريق متعمد - تحت التحقيق',
      },
      {
        location: { type: 'Point', coordinates: [-5.1045, 33.5423] },
        cause: 'EQUIPMENT_MALFUNCTION',
        severity: 2,
        status: 'ETEINT',
      },
      {
        location: { type: 'Point', coordinates: [-5.0889, 33.5089] },
        cause: 'CAMPFIRE_UNATTENDED',
        severity: 3,
        status: 'VIGILANCE',
      },
      {
        location: { type: 'Point', coordinates: [-5.1167, 33.5467] },
        cause: 'OTHER',
        severity: 2,
        status: 'VIGILANCE',
      },
      {
        location: { type: 'Point', coordinates: [-5.0956, 33.5234] },
        cause: 'CIGARETTE',
        severity: 1,
        status: 'ETEINT',
      },
      {
        location: { type: 'Point', coordinates: [-5.1089, 33.5178] },
        cause: 'LIGHTNING',
        severity: 4,
        status: 'INTERVENTION',
      },
    ],
  });

  console.log('✅ Incidents created');

  // Create reports
  await prisma.report.createMany({
    data: [
      {
        userId: civilian.id,
        latitude: 33.5275,
        longitude: -5.1056,
        description: 'رأيت دخانا كثيفا بالقرب من الغابة',
        images: [],
        status: 'PENDING',
        cause: 'UNKNOWN',
      },
      {
        userId: civilian.id,
        latitude: 33.5312,
        longitude: -5.1123,
        description: 'حريق صغير في الحديقة العامة',
        images: [],
        status: 'IN_PROGRESS',
        cause: 'CIGARETTE',
      },
      {
        userId: civilian.id,
        latitude: 33.5198,
        longitude: -5.0987,
        description: 'حريق كبير بحاجة إلى تدخل سريع',
        images: [],
        status: 'IN_PROGRESS',
        cause: 'AGRICULTURAL_BURNING',
      },
      {
        userId: civilian.id,
        latitude: 33.5356,
        longitude: -5.1189,
        description: 'سمعت انفجارا وبعدها ظهر الحريق',
        images: [],
        status: 'COMPLETED',
        cause: 'ELECTRICAL',
      },
      {
        userId: civilian.id,
        latitude: 33.5243,
        longitude: -5.1134,
        description: 'دخان أسود يتصاعد من المنطقة الصناعية',
        images: [],
        status: 'COMPLETED',
        cause: 'EQUIPMENT_MALFUNCTION',
      },
    ],
  });

  console.log('✅ Reports created');

  // Create equipment — Ifrane Province vehicles across departments
  await prisma.equipment.createMany({
    data: [
      { name: 'VPI-01', type: 'VPI', status: 'OPERATIONNEL', quantity: 1, latitude: 33.5228, longitude: -5.1107, department: 'Protection Civile', lastMaintenance: new Date('2025-01-15') },
      { name: 'VPI-02', type: 'VPI', status: 'OPERATIONNEL', quantity: 1, latitude: 33.4894, longitude: -5.1532, department: 'Protection Civile', lastMaintenance: new Date('2025-02-01') },
      { name: 'CC-01', type: 'CAMION_CITERNE', status: 'OPERATIONNEL', quantity: 1, latitude: 33.5350, longitude: -5.1200, department: 'DPEFLCD', lastMaintenance: new Date('2024-12-01') },
      { name: 'CC-02', type: 'CAMION_CITERNE', status: 'EN_MAINTENANCE', quantity: 1, latitude: 33.4400, longitude: -5.2200, department: 'DPEFLCD', lastMaintenance: new Date('2025-01-20') },
      { name: 'AMB-01', type: 'VEHICULE_LIAISON', status: 'OPERATIONNEL', quantity: 1, latitude: 33.5228, longitude: -5.1107, department: 'MI' },
      { name: '4x4-01', type: 'VEHICULE_LIAISON', status: 'OPERATIONNEL', quantity: 1, latitude: 33.5600, longitude: -5.0800, department: 'GR', lastMaintenance: new Date('2025-01-10') },
      { name: '4x4-02', type: 'VEHICULE_LIAISON', status: 'EN_PANNE', quantity: 1, latitude: 33.5000, longitude: -5.1500, department: 'GR' },
      { name: 'PMP-01', type: 'MOTOPOMPE', status: 'OPERATIONNEL', quantity: 1, latitude: 33.4500, longitude: -5.1000, department: 'DPEFLCD', lastMaintenance: new Date('2024-11-15') },
      { name: 'خراطيم مياه', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 50, department: 'DPEFLCD' },
      { name: 'بدلات واقية', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 40, department: 'DPEFLCD' },
      { name: 'أجهزة لاسلكي', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 20, department: 'DPEFLCD', lastMaintenance: new Date('2024-12-10') },
      { name: 'طائرات بدون طيار', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 3, department: 'DPEFLCD', lastMaintenance: new Date('2024-12-05') },
    ],
  });

  console.log('✅ Equipment created');

  // Create retardant products — Ifrane Province storage locations
  await prisma.retardantProduct.createMany({
    data: [
      { name: 'Phos-Chek LC95A', type: 'RETARDANT', quantity: 2000, unit: 'L', storageLocation: 'Dépôt DPEFLCD Ifrane', storageLat: 33.5350, storageLng: -5.1200, acquisitionDate: new Date('2024-06-01') },
      { name: 'Mousse AFFF 3%', type: 'MOUSSE', quantity: 800, unit: 'L', storageLocation: 'Caserne PC Ifrane', storageLat: 33.5228, storageLng: -5.1107, acquisitionDate: new Date('2024-03-15') },
      { name: 'Gel FireIce', type: 'GEL', quantity: 350, unit: 'L', storageLocation: 'Dépôt Azrou', storageLat: 33.4894, storageLng: -5.1532, acquisitionDate: new Date('2024-09-01') },
      { name: 'Retardant Class A', type: 'RETARDANT', quantity: 80, unit: 'L', storageLocation: 'Poste Ain Leuh', storageLat: 33.4400, storageLng: -5.2200, acquisitionDate: new Date('2023-12-01'), expiryDate: new Date('2025-12-01') },
    ],
  });

  console.log('✅ Retardant products created');

  // Create infrastructure — real Ifrane Province locations
  await prisma.infrastructure.createMany({
    data: [
      // Water points
      { name: "Point d'eau Dayet Aoua", type: 'WATER_POINT', status: 'OPERATIONNEL', latitude: 33.4753, longitude: -5.0639, capacity: 50000, capacityUnit: 'L' },
      { name: "Point d'eau Tizi n'Tretten", type: 'WATER_POINT', status: 'OPERATIONNEL', latitude: 33.5100, longitude: -5.0900, capacity: 25000, capacityUnit: 'L' },
      // Fire breaks
      { name: 'Tranchée Pare-Feu Cèdre Gouraud', type: 'FIREBREAK', status: 'OPERATIONNEL', latitude: 33.4100, longitude: -5.1600, capacity: 12, capacityUnit: 'km' },
      { name: 'Tranchée Pare-Feu Jbel Hebri', type: 'FIREBREAK', status: 'DEGRADE', latitude: 33.5800, longitude: -5.0500, capacity: 8, capacityUnit: 'km' },
      // Watchtowers
      { name: 'Poste Vigie Jbel Hebri', type: 'WATCHTOWER', status: 'OPERATIONNEL', latitude: 33.5850, longitude: -5.0450 },
      { name: 'Poste Vigie Tighboula', type: 'WATCHTOWER', status: 'OPERATIONNEL', latitude: 33.4300, longitude: -5.2000 },
      // Forest roads
      { name: 'Piste Forestière Ain Leuh–Azrou', type: 'FOREST_ROAD', status: 'OPERATIONNEL', latitude: 33.4650, longitude: -5.1800, capacity: 22, capacityUnit: 'km' },
      // Helipad
      { name: 'Héliport Ifrane', type: 'HELIPAD', status: 'OPERATIONNEL', latitude: 33.5130, longitude: -5.1080 },
      // Stations
      { name: 'Caserne Protection Civile Ifrane', type: 'STATION', status: 'OPERATIONNEL', latitude: 33.5228, longitude: -5.1107 },
      { name: 'CEDEFO Azrou', type: 'STATION', status: 'OPERATIONNEL', latitude: 33.4894, longitude: -5.1532 },
    ],
  });

  console.log('✅ Infrastructure created');

  // Create resources
  await prisma.resource.createMany({
    data: [
      {
        type: 'TRUCK',
        name: 'شاحنة إطفاء 1',
        location: { type: 'Point', coordinates: [-5.1056, 33.5275] },
        status: 'Disponible',
      },
      {
        type: 'TRUCK',
        name: 'شاحنة إطفاء 2',
        location: { type: 'Point', coordinates: [-5.1123, 33.5312] },
        status: 'En route',
        assignedTo: 'Incident en cours',
      },
      {
        type: 'TRUCK',
        name: 'شاحنة إطفاء 3',
        location: { type: 'Point', coordinates: [-5.0987, 33.5198] },
        status: 'Sur place',
        assignedTo: 'Zone agricole',
      },
      {
        type: 'AIRCRAFT',
        name: 'Avion bombardier 1',
        location: { type: 'Point', coordinates: [-5.1200, 33.5400] },
        status: 'Disponible',
      },
      {
        type: 'AIRCRAFT',
        name: 'Hélicoptère 1',
        location: { type: 'Point', coordinates: [-5.0900, 33.5300] },
        status: 'En mission',
        assignedTo: 'Zone forestière nord',
      },
      {
        type: 'PERSONNEL',
        name: 'Équipe pompiers A',
        location: { type: 'Point', coordinates: [-5.1056, 33.5275] },
        status: 'Disponible',
      },
      {
        type: 'PERSONNEL',
        name: 'Équipe pompiers B',
        location: { type: 'Point', coordinates: [-5.0987, 33.5198] },
        status: 'En intervention',
        assignedTo: 'Incident agricole',
      },
      {
        type: 'EQUIPMENT',
        name: 'Groupe électrogène',
        location: { type: 'Point', coordinates: [-5.1056, 33.5275] },
        status: 'Disponible',
      },
    ],
  });

  console.log('✅ Resources created');

  // Create risk basins (polygon geometries around Ifrane)
  await prisma.riskBasin.createMany({
    data: [
      {
        name: 'Zone forestière nord',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-5.1300, 33.5450],
            [-5.1100, 33.5500],
            [-5.0900, 33.5450],
            [-5.0900, 33.5350],
            [-5.1100, 33.5300],
            [-5.1300, 33.5350],
            [-5.1300, 33.5450],
          ]],
        },
        riskLevel: 4,
        description: 'Zone boisée dense au nord de Ifrane',
      },
      {
        name: 'Zone agricole sud',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-5.1200, 33.5250],
            [-5.1000, 33.5250],
            [-5.0800, 33.5200],
            [-5.0800, 33.5100],
            [-5.1000, 33.5100],
            [-5.1200, 33.5150],
            [-5.1200, 33.5250],
          ]],
        },
        riskLevel: 2,
        description: 'Terrains agricoles au sud',
      },
      {
        name: 'Périphérie urbaine',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-5.1150, 33.5350],
            [-5.0950, 33.5350],
            [-5.0950, 33.5250],
            [-5.1150, 33.5250],
            [-5.1150, 33.5350],
          ]],
        },
        riskLevel: 1,
        description: 'Zone urbaine périphérique',
      },
    ],
  });

  console.log('✅ Risk basins created');

  // Create truck deployments
  await prisma.truckDeployment.createMany({
    data: [
      {
        truckId: 'TRUCK-001',
        truckName: 'شاحنة إطفاء 1',
        latitude: 33.5275,
        longitude: -5.1056,
        status: 'Disponible',
      },
      {
        truckId: 'TRUCK-002',
        truckName: 'شاحنة إطفاء 2',
        latitude: 33.5312,
        longitude: -5.1123,
        status: 'En route',
        assignedTo: 'Incident en cours',
      },
      {
        truckId: 'TRUCK-003',
        truckName: 'شاحنة إطفاء 3',
        latitude: 33.5198,
        longitude: -5.0987,
        status: 'Sur place',
        assignedTo: 'Zone agricole',
      },
      {
        truckId: 'TRUCK-004',
        truckName: 'سيارة تدخل سريع 1',
        latitude: 33.5356,
        longitude: -5.1189,
        status: 'Disponible',
      },
      {
        truckId: 'TRUCK-005',
        truckName: 'سيارة تدخل سريع 2',
        latitude: 33.5243,
        longitude: -5.1134,
        status: 'En route',
        assignedTo: 'منطقة صناعية',
      },
    ],
  });

  console.log('✅ Truck deployments created');

  // Create dispatch teams around Ifrane
  await prisma.team.createMany({
    data: [
      {
        name: 'Station 1 Alpha',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1056, 33.5275] },
        capacity: 5,
        equipment: ['truck', 'hoses', 'axes'],
      },
      {
        name: 'Station 2 Bravo',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1189, 33.5356] },
        capacity: 4,
        equipment: ['truck', 'hoses'],
      },
      {
        name: 'Aerial Unit Charlie',
        type: 'AERIAL_SUPPORT',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.0923, 33.5389] },
        capacity: 3,
        equipment: ['helicopter', 'bambi_bucket'],
      },
      {
        name: 'Command Post Delta',
        type: 'COMMAND_UNIT',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1100, 33.5300] },
        capacity: 6,
        equipment: ['command_vehicle', 'comms'],
      },
    ],
  });

  console.log('✅ Dispatch teams created');

  // Create dispatch vehicles around Ifrane
  await prisma.vehicle.deleteMany({});
  await prisma.vehicle.createMany({
    data: [
      {
        callSign: 'FT-001',
        type: 'FIRE_TRUCK',
        status: 'AVAILABLE',
        capabilities: ['water_pump', 'ladder', 'foam'],
        baseLocation: { type: 'Point', coordinates: [-5.1056, 33.5275] },
        location: { type: 'Point', coordinates: [-5.1056, 33.5275] },
        capacity: 5000,
      },
      {
        callSign: 'FT-002',
        type: 'FIRE_TRUCK',
        status: 'AVAILABLE',
        capabilities: ['water_pump', 'hose_reel'],
        baseLocation: { type: 'Point', coordinates: [-5.1189, 33.5356] },
        location: { type: 'Point', coordinates: [-5.1189, 33.5356] },
        capacity: 3000,
      },
      {
        callSign: 'WT-001',
        type: 'WATER_TANKER',
        status: 'AVAILABLE',
        capabilities: ['water_tank', 'pump'],
        baseLocation: { type: 'Point', coordinates: [-5.0923, 33.5389] },
        location: { type: 'Point', coordinates: [-5.0923, 33.5389] },
        capacity: 10000,
      },
      {
        callSign: 'CMD-001',
        type: 'COMMAND',
        status: 'AVAILABLE',
        capabilities: ['comms', 'gps', 'mapping'],
        baseLocation: { type: 'Point', coordinates: [-5.1100, 33.5300] },
        location: { type: 'Point', coordinates: [-5.1100, 33.5300] },
        capacity: 0,
      },
    ],
  });

  console.log('✅ Dispatch vehicles created');

  // ── Fetch recently-seeded incidents for linking ──────────────────────────
  const recentIncidents = await prisma.incident.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  const incDraft    = recentIncidents[0]; // newest (ongoing)
  const incVerified = recentIncidents[1]; // recent 2026
  const incLocked   = recentIncidents[2]; // historic 2025

  if (!incDraft || !incVerified || !incLocked) {
    console.warn('⚠️  Not enough incidents to seed FireEventRecords — skipping enrichment');
  } else {

    // ── 3a. FireEventRecord (3 records) ────────────────────────────────────
    await prisma.fireEventRecord.createMany({
      data: [
        {
          incidentId: incLocked.id,
          alertSource: 'FIRMS_SATELLITE',
          ignitionAt: new Date('2025-07-14T11:30:00Z'),
          alertReceivedAt: new Date('2025-07-14T12:05:00Z'),
          verifiedAt: new Date('2025-07-14T12:20:00Z'),
          firstResponseAt: new Date('2025-07-14T12:45:00Z'),
          onSceneAt: new Date('2025-07-14T13:10:00Z'),
          containedAt: new Date('2025-07-14T18:30:00Z'),
          extinguishedAt: new Date('2025-07-15T08:00:00Z'),
          locationDetail: {
            commune: 'Ifrane',
            province: 'Ifrane',
            region: 'Fès-Meknès',
            forestName: 'Forêt de Cèdres du Moyen Atlas',
            altitude: 1680,
            slope: 15,
            aspect: 'NW',
            coordinates: [-5.1056, 33.5275],
          },
          causeDetail: {
            probable: 'CAMPFIRE_UNATTENDED',
            confirmed: true,
            investigationRef: 'INV-2025-071',
            notes: 'Traces de bivouac retrouvées sur site',
          },
          damageDetail: {
            areaBurned: 12.4,
            arboricultural: 8.2,
            maquis: 4.2,
            reforestation: 0,
            privatePropertyDamage: false,
            casualties: 0,
          },
          responseDetail: {
            commanderName: 'Khalid Benali',
            commanderRank: 'Capitaine',
            teamsDeployed: ['Station 1 Alpha', 'Station 2 Bravo'],
            vehiclesDeployed: ['VPI-01', 'CC-01'],
            waterUsed: 24000,
            retardantUsed: 800,
            aircraftSupport: false,
          },
          weatherAtTime: {
            temperature: 34,
            humidity: 18,
            windSpeed: 42,
            windDirection: 'NE',
            fwi: 38,
          },
          burnPerimeter: {
            type: 'Polygon',
            coordinates: [[
              [-5.1100, 33.5300],
              [-5.1000, 33.5310],
              [-5.0960, 33.5280],
              [-5.0950, 33.5240],
              [-5.1010, 33.5220],
              [-5.1090, 33.5230],
              [-5.1100, 33.5300],
            ]],
          },
          burnAreaHa: 12.4,
          burnCentroid: [-5.1025, 33.5265],
          burnBoundingBox: [-5.1100, 33.5220, -5.0950, 33.5310],
          recordStatus: 'LOCKED',
          lockedSections: ['location', 'cause', 'damage', 'response', 'weather'],
          auditTrail: [
            { action: 'CREATED',  actor: 'CD789012', at: '2025-07-14T12:05:00Z' },
            { action: 'VERIFIED', actor: 'CD789012', at: '2025-07-14T12:20:00Z' },
            { action: 'LOCKED',   actor: 'CD789012', at: '2025-07-16T09:00:00Z' },
          ],
        },
        {
          incidentId: incVerified.id,
          alertSource: 'CITIZEN_REPORT',
          ignitionAt: new Date('2026-02-03T14:20:00Z'),
          alertReceivedAt: new Date('2026-02-03T14:35:00Z'),
          verifiedAt: new Date('2026-02-03T15:00:00Z'),
          firstResponseAt: new Date('2026-02-03T15:30:00Z'),
          onSceneAt: new Date('2026-02-03T16:00:00Z'),
          containedAt: new Date('2026-02-03T20:45:00Z'),
          locationDetail: {
            commune: 'Azrou',
            province: 'Ifrane',
            region: 'Fès-Meknès',
            forestName: 'Forêt Ajdir',
            altitude: 1520,
            slope: 20,
            aspect: 'S',
            coordinates: [-5.1123, 33.5312],
          },
          causeDetail: {
            probable: 'AGRICULTURAL_BURNING',
            confirmed: false,
            investigationRef: 'INV-2026-012',
            notes: "Enquête en cours — champs adjacents brûlés",
          },
          damageDetail: {
            areaBurned: 3.7,
            arboricultural: 2.1,
            maquis: 1.6,
            reforestation: 0,
            privatePropertyDamage: false,
            casualties: 0,
          },
          responseDetail: {
            commanderName: 'Youssef Idrissi',
            commanderRank: 'Lieutenant',
            teamsDeployed: ['Station 1 Alpha'],
            vehiclesDeployed: ['VPI-02'],
            waterUsed: 6000,
            retardantUsed: 0,
            aircraftSupport: false,
          },
          weatherAtTime: {
            temperature: 22,
            humidity: 25,
            windSpeed: 18,
            windDirection: 'SW',
            fwi: 12,
          },
          recordStatus: 'VERIFIED',
          lockedSections: ['location', 'response'],
          auditTrail: [
            { action: 'CREATED',  actor: 'CD789012', at: '2026-02-03T14:35:00Z' },
            { action: 'VERIFIED', actor: 'CD789012', at: '2026-02-04T09:00:00Z' },
          ],
        },
        {
          incidentId: incDraft.id,
          alertSource: 'PATROL',
          ignitionAt: new Date('2026-03-15T10:10:00Z'),
          alertReceivedAt: new Date('2026-03-15T10:25:00Z'),
          recordStatus: 'DRAFT',
          lockedSections: [],
          auditTrail: [
            { action: 'CREATED', actor: 'CD789012', at: '2026-03-15T10:25:00Z' },
          ],
        },
      ],
    });

    console.log('✅ FireEventRecords created');

    // Fetch the records we just created (newest 3)
    const recentFireRecords = await prisma.fireEventRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    const frDraft    = recentFireRecords[0];
    const frVerified = recentFireRecords[1];
    const frLocked   = recentFireRecords[2];

    // ── 3b. Campaign ───────────────────────────────────────────────────────
    await prisma.campaign.upsert({
      where: { year: 2026 },
      update: {},
      create: {
        year: 2026,
        label: 'Campagne Anti-Incendies 2026',
        status: 'ACTIVE',
        activePhase: 'ALERTE',
        seasonStart: new Date('2026-05-01'),
        seasonEnd: new Date('2026-10-31'),
        notes: 'Saison à risque élevé — conditions météorologiques sèches persistantes depuis janvier',
        createdBy: 'CD789012',
      },
    });

    console.log('✅ Campaign created');

    // ── 3c. Debriefing (2 records) ─────────────────────────────────────────
    if (frLocked && frVerified) {
      await prisma.debriefing.createMany({
        data: [
          {
            fireRecordId: frLocked.id,
            date: new Date('2025-07-18T09:00:00Z'),
            superficieIncendiee: 12.4,
            heureDeclenchement: '11:30',
            typeEssence: "Cèdre de l'Atlas",
            alertePrecoce: true,
            alertePrecoceDetail: 'Détection FIRMS 35 minutes après le démarrage estimé',
            premiereIntervention: 'CEDEFO',
            premiereInterventionDetail: 'VPI-01 arrivé en 40 minutes',
            vegetationSecondaire: 'Chêne vert, bruyère',
            topographie: ['FORTE_PENTE', 'VALLON'],
            pistesForestieres: true,
            pistesAmenagees: true,
            trancheesPF: true,
            trancheesPFAmenagees: false,
            pointsEau: true,
            pointsEauAccessible: true,
            pointsEauRempli: true,
            pointsEauUtilise: true,
            fonctionnaliteVPI: true,
            fonctionnaliteVPIDetail: 'VPI-01 et VPI-02 opérationnels tout au long de l\'intervention',
            incidentLutte: 'Aucun incident notable',
            quAvaitEtePlanifie: 'Intervention rapide avec 2 équipes sol et coordination aérienne en réserve',
            quEstCeQuiEstArrive: 'Vent NE imprévu a accéléré la propagation vers NW — 3ème équipe demandée en renfort',
            pourquoi: 'Prévision météo METEONORM non transmise en temps réel au COS',
            prochaineFois: 'Intégrer flux météo temps réel dans la radio COS et alertes automatiques',
            observationsParticulieres: 'Coopération DPEFLCD/Protection Civile exemplaire',
            animateurNom: 'Benali',
            animateurQualite: 'Chef de secteur DPEFLCD',
            participants: [
              { nom: 'Benali',   prenom: 'Khalid',  poste: 'COS' },
              { nom: 'Idrissi',  prenom: 'Youssef', poste: "Chef d'équipe PC" },
              { nom: 'Marzouki', prenom: 'Fatima',  poste: 'Agent DPEFLCD' },
            ],
            status: 'completed',
          },
          {
            fireRecordId: frVerified.id,
            date: new Date('2026-02-10T10:00:00Z'),
            superficieIncendiee: 3.7,
            typeEssence: 'Chêne vert',
            topographie: ['PENTE_MODEREE'],
            pistesForestieres: true,
            pistesAmenagees: false,
            pointsEau: true,
            pointsEauAccessible: true,
            pointsEauRempli: false,
            pointsEauUtilise: true,
            participants: [],
            status: 'draft',
          },
        ],
      });
    }

    console.log('✅ Debriefings created');

    // ── 3d. CommunicationLog (4 entries) ───────────────────────────────────
    await prisma.communicationLog.createMany({
      data: [
        {
          incidentId: incLocked.id,
          category: 'ALERT_SENT',
          fromAgency: 'PROTECTION_CIVILE',
          toAgency: 'DEF',
          message: 'Alerte feu de forêt — zone Cèdre Gouraud, surface estimée 5 ha, vent NE 40 km/h. VPI-01 en route.',
          authorId: official.id,
          authorCin: 'CD789012',
        },
        {
          incidentId: incLocked.id,
          category: 'ORDER_GIVEN',
          fromAgency: 'DEF',
          toAgency: 'PROTECTION_CIVILE',
          message: 'Engagement de VPI-02 et CC-01. Station 2 Bravo déployée. COS désigné : Capitaine Benali.',
          authorId: official.id,
          authorCin: 'CD789012',
        },
        {
          incidentId: incVerified.id,
          category: 'ESCALATION',
          fromAgency: 'GENDARMERIE_ROYALE',
          toAgency: 'AUTORITES_LOCALES',
          message: "Escalade demandée — périmètre de sécurité insuffisant sur RN8. Renfort Gendarmerie requis.",
          authorId: official.id,
          authorCin: 'CD789012',
        },
        {
          incidentId: incDraft.id,
          category: 'STATUS_UPDATE',
          fromAgency: 'PROTECTION_CIVILE',
          message: 'SITREP 15h30 — Incendie localisé, pas de propagation, 1 équipe sur place. Situation stable.',
          authorId: official.id,
          authorCin: 'CD789012',
        },
      ],
    });

    console.log('✅ CommunicationLogs created');

    // ── 3e. AgencyStatus (3 entries, idempotent via upsert) ────────────────
    // MongoDB does not support skipDuplicates in createMany, so use upsert per agency
    for (const agencyData of [
      {
        agency: 'PROTECTION_CIVILE' as const,
        status: 'ONLINE' as const,
        unitsAvailable: 4,
        unitsDeployed: 2,
        contactName: 'Commandant Hassan Alaoui',
        contactPhone: '+212537566000',
        contactEmail: 'commandement@pc-ifrane.ma',
        notes: '2 VPI opérationnels sur province; CC-02 en maintenance planifiée',
        lastHeartbeat: new Date(),
      },
      {
        agency: 'GENDARMERIE_ROYALE' as const,
        status: 'ONLINE' as const,
        unitsAvailable: 6,
        unitsDeployed: 1,
        contactName: 'Commandant Rachid Tazi',
        contactPhone: '+212537567100',
        notes: 'Brigade territoriale Ifrane — couverture nord/est de la province',
        lastHeartbeat: new Date(),
      },
      {
        agency: 'DEF' as const,
        status: 'STANDBY' as const,
        unitsAvailable: 3,
        unitsDeployed: 0,
        aviationStatus: 'CL-215 prépositionné à la base aérienne de Meknès',
        contactName: 'Colonel Mustapha Alami',
        contactPhone: '+212537568200',
        notes: 'Prêt pour intervention PMA sur demande préfectorale',
        lastHeartbeat: new Date(),
      },
    ]) {
      await prisma.agencyStatus.upsert({
        where: { agency: agencyData.agency },
        update: agencyData,
        create: agencyData,
      });
    }

    console.log('✅ AgencyStatuses created');

    // ── 3f. POIActivation (2 entries) ──────────────────────────────────────
    await prisma.pOIActivation.createMany({
      data: [
        {
          incidentId: incLocked.id,
          level: 'POI_1',
          activatedBy: 'CD789012',
          activatedAt: new Date('2025-07-14T12:30:00Z'),
          deactivatedAt: new Date('2025-07-15T09:00:00Z'),
          notes: 'POI 1 activé suite à détection FIRMS confirmée sur terrain',
        },
        {
          incidentId: incVerified.id,
          level: 'POI_2',
          activatedBy: 'CD789012',
          activatedAt: new Date('2026-02-03T16:00:00Z'),
          notes: 'POI 2 activé — propagation vers zone habitée confirmée par patrouille',
        },
      ],
    });

    console.log('✅ POIActivations created');

  } // end enrichment block

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

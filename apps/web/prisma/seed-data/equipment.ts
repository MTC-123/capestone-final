import { STATIONS, WATCHTOWERS, WATER_POINTS, FOREST_ROADS, FIREBREAKS } from './geo';

export interface EquipmentSeed {
  name: string;
  type: 'VPI' | 'CAMION_CITERNE' | 'MOTOPOMPE' | 'VEHICULE_LIAISON' | 'AUTRE';
  status: 'OPERATIONNEL' | 'EN_PANNE' | 'EN_MAINTENANCE';
  quantity: number;
  department?: string;
  lat?: number;
  lng?: number;
  lastMaintenance?: string;
  notes?: string;
}

export const EQUIPMENT: EquipmentSeed[] = [
  { name: 'VPI-01 Ifrane', type: 'VPI', status: 'OPERATIONNEL', quantity: 1, department: 'Protection Civile', lat: STATIONS.pcIfrane.lat, lng: STATIONS.pcIfrane.lng, lastMaintenance: '2026-05-12' },
  { name: 'VPI-02 Ifrane', type: 'VPI', status: 'OPERATIONNEL', quantity: 1, department: 'Protection Civile', lat: STATIONS.pcIfrane.lat, lng: STATIONS.pcIfrane.lng, lastMaintenance: '2026-04-28' },
  { name: 'VPI-03 Azrou', type: 'VPI', status: 'OPERATIONNEL', quantity: 1, department: 'Protection Civile', lat: STATIONS.pcAzrou.lat, lng: STATIONS.pcAzrou.lng, lastMaintenance: '2026-05-02' },
  { name: 'VPI-04 Aïn Leuh', type: 'VPI', status: 'EN_MAINTENANCE', quantity: 1, department: 'DPEFLCD', lat: STATIONS.posteAinLeuh.lat, lng: STATIONS.posteAinLeuh.lng, lastMaintenance: '2026-08-30', notes: 'Révision pompe prévue avant fin septembre' },
  { name: 'CC-01 Ifrane', type: 'CAMION_CITERNE', status: 'OPERATIONNEL', quantity: 1, department: 'DPEFLCD', lat: STATIONS.pcIfrane.lat, lng: STATIONS.pcIfrane.lng, lastMaintenance: '2026-06-01' },
  { name: 'CC-02 Azrou (CEDEFO)', type: 'CAMION_CITERNE', status: 'OPERATIONNEL', quantity: 1, department: 'DPEFLCD', lat: STATIONS.cedefoAzrou.lat, lng: STATIONS.cedefoAzrou.lng, lastMaintenance: '2026-05-20' },
  { name: 'CC-03 Aïn Leuh', type: 'CAMION_CITERNE', status: 'EN_PANNE', quantity: 1, department: 'DPEFLCD', lat: STATIONS.posteAinLeuh.lat, lng: STATIONS.posteAinLeuh.lng, notes: 'Fuite hydraulique — pièce commandée' },
  { name: 'PMP-01 Cèdre Gouraud', type: 'MOTOPOMPE', status: 'OPERATIONNEL', quantity: 2, department: 'DPEFLCD', lat: 33.418, lng: -5.172, lastMaintenance: '2026-05-15' },
  { name: 'PMP-02 Jbel Hebri', type: 'MOTOPOMPE', status: 'OPERATIONNEL', quantity: 1, department: 'DPEFLCD', lat: 33.58, lng: -5.05, lastMaintenance: '2026-04-10' },
  { name: '4x4-01 Gendarmerie', type: 'VEHICULE_LIAISON', status: 'OPERATIONNEL', quantity: 1, department: 'GR', lat: STATIONS.pcIfrane.lat, lng: STATIONS.pcIfrane.lng, lastMaintenance: '2026-06-05' },
  { name: '4x4-02 DPEFLCD', type: 'VEHICULE_LIAISON', status: 'OPERATIONNEL', quantity: 1, department: 'DPEFLCD', lat: STATIONS.cedefoAzrou.lat, lng: STATIONS.cedefoAzrou.lng, lastMaintenance: '2026-05-22' },
  { name: 'Motos tout-terrain patrouille', type: 'VEHICULE_LIAISON', status: 'OPERATIONNEL', quantity: 4, department: 'DPEFLCD', lat: STATIONS.posteAinLeuh.lat, lng: STATIONS.posteAinLeuh.lng },
  { name: 'Tronçonneuses thermiques', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 12, department: 'DPEFLCD' },
  { name: 'Battes à feu (raquettes)', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 60, department: 'DPEFLCD' },
  { name: 'Tenues de protection ignifugées', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 45, department: 'Protection Civile' },
  { name: 'Radios portatives VHF', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 30, department: 'DPEFLCD', lastMaintenance: '2026-06-10' },
  { name: 'Drones de reconnaissance thermique', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 2, department: 'DPEFLCD', lastMaintenance: '2026-07-01' },
  { name: 'Groupes électrogènes', type: 'AUTRE', status: 'OPERATIONNEL', quantity: 5, department: 'Protection Civile' },
];

export interface RetardantSeed {
  name: string;
  type: 'MOUSSE' | 'RETARDANT' | 'GEL';
  quantity: number;
  unit: string;
  storageLocation: string;
  lat?: number;
  lng?: number;
  acquisitionDate: string;
  expiryDate?: string;
  notes?: string;
}

export const RETARDANT_PRODUCTS: RetardantSeed[] = [
  { name: 'Phos-Chek LC95A', type: 'RETARDANT', quantity: 4000, unit: 'L', storageLocation: 'Dépôt DPEFLCD Ifrane', lat: STATIONS.pcIfrane.lat, lng: STATIONS.pcIfrane.lng, acquisitionDate: '2026-04-15' },
  { name: 'Mousse AFFF 3%', type: 'MOUSSE', quantity: 1200, unit: 'L', storageLocation: 'Caserne Protection Civile Ifrane', lat: STATIONS.pcIfrane.lat, lng: STATIONS.pcIfrane.lng, acquisitionDate: '2026-03-20' },
  { name: 'Mousse AFFF 3%', type: 'MOUSSE', quantity: 600, unit: 'L', storageLocation: 'Caserne Protection Civile Azrou', lat: STATIONS.pcAzrou.lat, lng: STATIONS.pcAzrou.lng, acquisitionDate: '2026-03-20' },
  { name: 'Gel FireIce', type: 'GEL', quantity: 350, unit: 'L', storageLocation: 'CEDEFO Azrou', lat: STATIONS.cedefoAzrou.lat, lng: STATIONS.cedefoAzrou.lng, acquisitionDate: '2026-05-01' },
  { name: 'Retardant Class A', type: 'RETARDANT', quantity: 150, unit: 'L', storageLocation: 'Poste Forestier Aïn Leuh', lat: STATIONS.posteAinLeuh.lat, lng: STATIONS.posteAinLeuh.lng, acquisitionDate: '2025-11-01', expiryDate: '2027-11-01' },
];

export interface InfrastructureSeed {
  name: string;
  type: 'WATCHTOWER' | 'WATER_POINT' | 'FIREBREAK' | 'STATION' | 'FOREST_ROAD' | 'HELIPAD';
  status: 'OPERATIONNEL' | 'DEGRADE' | 'HORS_SERVICE';
  lat?: number;
  lng?: number;
  capacity?: number;
  capacityUnit?: string;
  lastInspectionDate?: string;
  notes?: string;
}

export const INFRASTRUCTURE: InfrastructureSeed[] = [
  ...WATER_POINTS.map((w): InfrastructureSeed => ({
    name: w.name, type: 'WATER_POINT', status: 'OPERATIONNEL', lat: w.lat, lng: w.lng, capacity: w.capacity, capacityUnit: 'L', lastInspectionDate: '2026-05-01',
  })),
  ...WATCHTOWERS.map((w, i): InfrastructureSeed => ({
    name: w.name, type: 'WATCHTOWER', status: i === 2 ? 'DEGRADE' : 'OPERATIONNEL', lat: w.lat, lng: w.lng, lastInspectionDate: '2026-06-01',
    notes: i === 2 ? 'Antenne radio à réparer — portée réduite' : undefined,
  })),
  ...FOREST_ROADS.map((f): InfrastructureSeed => ({
    name: f.name, type: 'FOREST_ROAD', status: 'OPERATIONNEL', lat: f.lat, lng: f.lng, capacity: f.km, capacityUnit: 'km', lastInspectionDate: '2026-04-20',
  })),
  ...FIREBREAKS.map((f, i): InfrastructureSeed => ({
    name: f.name, type: 'FIREBREAK', status: i === 1 ? 'DEGRADE' : 'OPERATIONNEL', lat: f.lat, lng: f.lng, capacity: f.km, capacityUnit: 'km', lastInspectionDate: '2026-04-25',
    notes: i === 1 ? 'Reboisement spontané réduisant la largeur effective' : undefined,
  })),
  { name: STATIONS.pcIfrane.name, type: 'STATION', status: 'OPERATIONNEL', lat: STATIONS.pcIfrane.lat, lng: STATIONS.pcIfrane.lng },
  { name: STATIONS.pcAzrou.name, type: 'STATION', status: 'OPERATIONNEL', lat: STATIONS.pcAzrou.lat, lng: STATIONS.pcAzrou.lng },
  { name: STATIONS.cedefoAzrou.name, type: 'STATION', status: 'OPERATIONNEL', lat: STATIONS.cedefoAzrou.lat, lng: STATIONS.cedefoAzrou.lng },
  { name: STATIONS.posteAinLeuh.name, type: 'STATION', status: 'OPERATIONNEL', lat: STATIONS.posteAinLeuh.lat, lng: STATIONS.posteAinLeuh.lng },
  { name: STATIONS.helipadIfrane.name, type: 'HELIPAD', status: 'OPERATIONNEL', lat: STATIONS.helipadIfrane.lat, lng: STATIONS.helipadIfrane.lng },
];

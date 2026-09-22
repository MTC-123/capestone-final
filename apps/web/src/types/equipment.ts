export type EquipmentType = 'VPI' | 'CAMION_CITERNE' | 'MOTOPOMPE' | 'VEHICULE_LIAISON' | 'AUTRE';
export type EquipmentStatus = 'OPERATIONNEL' | 'EN_PANNE' | 'EN_MAINTENANCE';
export type RetardantType = 'MOUSSE' | 'RETARDANT' | 'GEL';
export type InfrastructureType = 'WATCHTOWER' | 'WATER_POINT' | 'FIREBREAK' | 'STATION' | 'FOREST_ROAD' | 'HELIPAD';
export type InfrastructureStatus = 'OPERATIONNEL' | 'DEGRADE' | 'HORS_SERVICE';
export type EquipmentTab = 'equipment' | 'retardant' | 'infrastructure';

export interface Equipment {
  id: string;
  type: string;
  name: string;
  status: string;
  quantity: number;
  department?: string;
  latitude?: number;
  longitude?: number;
  lastMaintenance?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetardantProduct {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  storageLocation: string;
  storageLat?: number;
  storageLng?: number;
  expiryDate?: string;
  acquisitionDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Infrastructure {
  id: string;
  type: string;
  name: string;
  latitude?: number;
  longitude?: number;
  status: string;
  capacity?: number;
  capacityUnit?: string;
  lastInspectionDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

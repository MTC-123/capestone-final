import { STATIONS } from './geo';

export type VehicleStatusSeed = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'OUT_OF_SERVICE';
export type VehicleTypeSeed = 'FIRE_TRUCK' | 'WATER_TANKER' | 'COMMAND' | 'AMBULANCE' | 'HELICOPTER';

export interface VehicleSeed {
  callSign: string;
  type: VehicleTypeSeed;
  status: VehicleStatusSeed;
  capabilities: string[];
  baseStation: keyof typeof STATIONS;
  capacity: number;
  /** 0, 1 or 2 — which of the three `active: true` incidents (in the order
   * they appear in INCIDENTS) this unit is currently dispatched to. */
  assignedActiveSlot?: number;
}

export const VEHICLES: VehicleSeed[] = [
  { callSign: 'FT-IFR-01', type: 'FIRE_TRUCK', status: 'AVAILABLE', capabilities: ['water_pump', 'hose_reel', 'ladder'], baseStation: 'pcIfrane', capacity: 5000 },
  { callSign: 'FT-IFR-02', type: 'FIRE_TRUCK', status: 'AVAILABLE', capabilities: ['water_pump', 'hose_reel'], baseStation: 'pcIfrane', capacity: 4000 },
  { callSign: 'FT-IFR-03', type: 'FIRE_TRUCK', status: 'EN_ROUTE', capabilities: ['water_pump', 'foam', 'hose_reel'], baseStation: 'pcIfrane', capacity: 5000, assignedActiveSlot: 0 },
  { callSign: 'FT-AZR-01', type: 'FIRE_TRUCK', status: 'AVAILABLE', capabilities: ['water_pump', 'hose_reel'], baseStation: 'pcAzrou', capacity: 4500 },
  { callSign: 'FT-AZR-02', type: 'FIRE_TRUCK', status: 'ON_SCENE', capabilities: ['water_pump', 'foam', 'ladder'], baseStation: 'pcAzrou', capacity: 5000, assignedActiveSlot: 1 },
  { callSign: 'CCF-IFR-01', type: 'WATER_TANKER', status: 'AVAILABLE', capabilities: ['water_tank', 'pump'], baseStation: 'pcIfrane', capacity: 10000 },
  { callSign: 'CCF-IFR-02', type: 'WATER_TANKER', status: 'EN_ROUTE', capabilities: ['water_tank', 'pump'], baseStation: 'pcIfrane', capacity: 12000, assignedActiveSlot: 0 },
  { callSign: 'CCF-AZR-01', type: 'WATER_TANKER', status: 'ON_SCENE', capabilities: ['water_tank', 'pump'], baseStation: 'cedefoAzrou', capacity: 10000, assignedActiveSlot: 1 },
  { callSign: 'CCF-AINLEUH-01', type: 'WATER_TANKER', status: 'AVAILABLE', capabilities: ['water_tank', 'pump'], baseStation: 'posteAinLeuh', capacity: 8000 },
  { callSign: 'CMD-IFR-01', type: 'COMMAND', status: 'AVAILABLE', capabilities: ['comms', 'gps', 'mapping'], baseStation: 'pcIfrane', capacity: 0 },
  { callSign: 'CMD-IFR-02', type: 'COMMAND', status: 'ON_SCENE', capabilities: ['comms', 'gps', 'mapping', 'radio_relay'], baseStation: 'pcIfrane', capacity: 0, assignedActiveSlot: 0 },
  { callSign: 'AMB-IFR-01', type: 'AMBULANCE', status: 'AVAILABLE', capabilities: ['first_aid', 'stretcher'], baseStation: 'pcIfrane', capacity: 2 },
  { callSign: 'AMB-AZR-01', type: 'AMBULANCE', status: 'AVAILABLE', capabilities: ['first_aid', 'stretcher'], baseStation: 'pcAzrou', capacity: 2 },
  { callSign: 'HELI-DEF-01', type: 'HELICOPTER', status: 'EN_ROUTE', capabilities: ['bambi_bucket', 'aerial_recon'], baseStation: 'helipadIfrane', capacity: 1000, assignedActiveSlot: 1 },
  { callSign: 'FT-IFR-04', type: 'FIRE_TRUCK', status: 'RETURNING', capabilities: ['water_pump', 'hose_reel'], baseStation: 'pcAzrou', capacity: 4000 },
];

export type TeamTypeSeed = 'GROUND_CREW' | 'AERIAL_SUPPORT' | 'COMMAND_UNIT' | 'MEDICAL';
export type TeamStatusSeed = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'UNAVAILABLE';

export interface TeamSeed {
  name: string;
  type: TeamTypeSeed;
  status: TeamStatusSeed;
  baseStation: keyof typeof STATIONS;
  capacity: number;
  equipment: string[];
  assignedActiveSlot?: number;
}

export const TEAMS: TeamSeed[] = [
  { name: 'Équipe Sol Ifrane Alpha', type: 'GROUND_CREW', status: 'AVAILABLE', baseStation: 'pcIfrane', capacity: 6, equipment: ['pelles', 'battes à feu', 'motopompe'] },
  { name: 'Équipe Sol Ifrane Bravo', type: 'GROUND_CREW', status: 'ON_SCENE', baseStation: 'pcIfrane', capacity: 6, equipment: ['pelles', 'battes à feu', 'tronçonneuse'], assignedActiveSlot: 0 },
  { name: 'Équipe Sol Azrou Alpha', type: 'GROUND_CREW', status: 'AVAILABLE', baseStation: 'pcAzrou', capacity: 5, equipment: ['pelles', 'battes à feu'] },
  { name: 'Équipe Sol Azrou Bravo', type: 'GROUND_CREW', status: 'EN_ROUTE', baseStation: 'cedefoAzrou', capacity: 6, equipment: ['pelles', 'motopompe', 'lances'], assignedActiveSlot: 1 },
  { name: "Équipe Sol Aïn Leuh", type: 'GROUND_CREW', status: 'AVAILABLE', baseStation: 'posteAinLeuh', capacity: 5, equipment: ['pelles', 'battes à feu'] },
  { name: 'Unité Aérienne DEF Meknès', type: 'AERIAL_SUPPORT', status: 'EN_ROUTE', baseStation: 'helipadIfrane', capacity: 4, equipment: ['helicopter', 'bambi_bucket'], assignedActiveSlot: 1 },
  { name: 'Poste de Commandement Avancé Ifrane', type: 'COMMAND_UNIT', status: 'ON_SCENE', baseStation: 'pcIfrane', capacity: 8, equipment: ['command_vehicle', 'radio_relay', 'drone'], assignedActiveSlot: 0 },
  { name: 'Équipe Médicale Protection Civile Ifrane', type: 'MEDICAL', status: 'AVAILABLE', baseStation: 'pcIfrane', capacity: 4, equipment: ['stretcher', 'first_aid', 'oxygen'] },
  { name: 'Équipe Reconnaissance Jbel Hebri', type: 'GROUND_CREW', status: 'EN_ROUTE', baseStation: 'posteAinLeuh', capacity: 4, equipment: ['jumelles', 'radio', 'pelles'], assignedActiveSlot: 2 },
];

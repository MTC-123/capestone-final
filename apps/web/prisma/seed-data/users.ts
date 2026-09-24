/**
 * Demo accounts. Passwords are plain here and hashed once in seed.ts
 * (bcryptjs, cost 12) so this module stays pure data.
 */

export interface CivilianSeed {
  cin: string;
  phone: string;
  password: string;
  fullName: string;
  email?: string;
}

export interface OfficialSeed {
  cin: string;
  phone: string;
  password: string;
  fullName: string;
  department: string;
  position: string;
  email?: string;
}

// The first entry in each list is the fixed demo credential asked for
// explicitly — never change its cin/phone/password/fullName/department.
export const CIVILIANS: CivilianSeed[] = [
  {
    cin: 'AB123456',
    phone: '+212612345678',
    password: 'password123',
    fullName: 'Yasmine El Idrissi',
    email: 'yasmine.elidrissi@example.ma',
  },
  { cin: 'EF345678', phone: '+212661234567', password: 'password123', fullName: 'Omar Benjelloun', email: 'omar.benjelloun@example.ma' },
  { cin: 'GH456789', phone: '+212662345678', password: 'password123', fullName: 'Salma Chraibi', email: 'salma.chraibi@example.ma' },
  { cin: 'IJ567890', phone: '+212663456789', password: 'password123', fullName: 'Hamza Tazi', email: 'hamza.tazi@example.ma' },
  { cin: 'KL678901', phone: '+212664567890', password: 'password123', fullName: 'Nadia Bouzid', email: 'nadia.bouzid@example.ma' },
  { cin: 'MN789012', phone: '+212665678901', password: 'password123', fullName: 'Rachid Amrani', email: 'rachid.amrani@example.ma' },
  { cin: 'OP890123', phone: '+212666789012', password: 'password123', fullName: 'Imane Fassi', email: 'imane.fassi@example.ma' },
];

export const OFFICIALS: OfficialSeed[] = [
  {
    cin: 'CD789012',
    phone: '+212687654321',
    password: 'password123',
    fullName: 'Karim Benali',
    department: 'HCEFLCD',
    position: 'Chef du Centre Provincial de Gestion des Risques',
    email: 'karim.benali@eauxetforets.gov.ma',
  },
  {
    cin: 'QR901234',
    phone: '+212537566012',
    password: 'password123',
    fullName: 'Hassan Alaoui',
    department: 'Protection Civile',
    position: "Commandant, Caserne Protection Civile d'Ifrane",
    email: 'h.alaoui@protectioncivile.gov.ma',
  },
  {
    cin: 'ST012345',
    phone: '+212537567123',
    password: 'password123',
    fullName: 'Rachid Tazi',
    department: 'Gendarmerie Royale',
    position: 'Commandant, Brigade Territoriale Ifrane',
    email: 'r.tazi@gendarmerie.gov.ma',
  },
  {
    cin: 'UV123450',
    phone: '+212535660234',
    password: 'password123',
    fullName: 'Fatima-Zahra Mernissi',
    department: 'Autorités locales',
    position: "Cheffe de Cercle, Province d'Ifrane",
    email: 'fz.mernissi@interieur.gov.ma',
  },
];

export interface OfficialRequestSeed {
  civilianCin: string; // links to a CIVILIANS entry
  department: string;
  position: string;
  justification: string;
}

export const OFFICIAL_REQUESTS: OfficialRequestSeed[] = [
  {
    civilianCin: 'IJ567890',
    department: 'DPEFLCD',
    position: 'Agent forestier — secteur Aïn Leuh',
    justification:
      "Agent technique au Centre de Développement Forestier d'Aïn Leuh depuis 2021, je souhaite accéder au tableau de bord opérationnel pour saisir les patrouilles et signaler directement les départs de feu sur mon secteur.",
  },
  {
    civilianCin: 'OP890123',
    department: 'Protection Civile',
    position: 'Volontaire — équipe de première intervention Azrou',
    justification:
      "Volontaire formée aux premiers secours et à la lutte contre les feux de forêt (stage CEDEFO 2025). Je demande un accès officiel pour être intégrée aux équipes de garde durant la campagne 2026.",
  },
];

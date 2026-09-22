import { jsPDF } from 'jspdf';

interface PdfRecordData {
  id: string;
  incidentId: string;
  recordStatus: string;
  alertSource: string;
  burnAreaHa?: number | null;
  createdAt: string;
  alertReceivedAt?: string | null;
  firstResponseAt?: string | null;
  containedAt?: string | null;
  extinguishedAt?: string | null;
  locationDetail?: Record<string, unknown> | null;
  causeDetail?: Record<string, unknown> | null;
  damageDetail?: Record<string, unknown> | null;
  responseDetail?: Record<string, unknown> | null;
  weatherAtTime?: Record<string, unknown> | null;
  postFire?: Record<string, unknown> | null;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('fr-FR');
  } catch {
    return val;
  }
}

export function generateFireRecordPdf(record: PdfRecordData): ArrayBuffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const addSection = (title: string) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const addField = (label: string, value: string) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '—', 70, y);
    y += 6;
  };

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Fiche Incendie', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`ID: ${record.id}`, 14, y);
  y += 5;
  doc.text(`Statut: ${record.recordStatus}`, 14, y);

  // Location
  addSection('Localisation');
  const loc = record.locationDetail;
  addField('Nom', (loc?.locationName as string) ?? '');
  addField('Commune', (loc?.commune as string) ?? '');
  addField('DPEFLCD', (loc?.dpeflcd as string) ?? '');
  addField('District', (loc?.district as string) ?? '');
  addField('Triage', (loc?.triage as string) ?? '');
  addField('Surface brulee', record.burnAreaHa != null ? `${record.burnAreaHa} ha` : '');

  // Cause
  addSection('Cause');
  const cause = record.causeDetail;
  addField('Categorie', (cause?.category as string) ?? '');
  addField('Certitude', (cause?.certainty as string) ?? '');
  addField('Cause investiguee', (cause?.investigatedCause as string) ?? '');
  addField('Notes', (cause?.notes as string) ?? '');

  // Damage
  addSection('Degats');
  const dmg = record.damageDetail;
  addField('Surface brulee (ha)', dmg?.surfaceBurnedHa != null ? String(dmg.surfaceBurnedHa) : '');
  addField('Surface forestiere', dmg?.forestAreaHa != null ? `${dmg.forestAreaHa} ha` : '');
  addField('Infra. (MAD)', dmg?.infrastructureDamage != null ? String(dmg.infrastructureDamage) : '');
  addField('Agriculture (MAD)', dmg?.agricultureDamage != null ? String(dmg.agricultureDamage) : '');
  addField('Propriete (MAD)', dmg?.propertyDamage != null ? String(dmg.propertyDamage) : '');
  addField('Autres (MAD)', dmg?.otherDamage != null ? String(dmg.otherDamage) : '');
  addField('Total estime (MAD)', dmg?.totalEstimate != null ? String(dmg.totalEstimate) : '');

  // Response
  addSection('Intervention');
  const resp = record.responseDetail;
  addField('Vehicules', resp?.vehicleCount != null ? String(resp.vehicleCount) : '');
  addField('Aeronefs', resp?.aircraftCount != null ? String(resp.aircraftCount) : '');
  addField('Personnel', resp?.personnelCount != null ? String(resp.personnelCount) : '');
  addField('Eau (L)', resp?.waterVolumeLiters != null ? String(resp.waterVolumeLiters) : '');
  addField('Retardant (L)', resp?.retardantVolumeLiters != null ? String(resp.retardantVolumeLiters) : '');
  addField('Temps reponse (min)', resp?.responseTimeMinutes != null ? String(resp.responseTimeMinutes) : '');

  // Timeline
  addSection('Chronologie');
  addField('Alerte recue', formatDate(record.alertReceivedAt));
  addField('Premiere intervention', formatDate(record.firstResponseAt));
  addField('Contenu', formatDate(record.containedAt));
  addField('Eteint', formatDate(record.extinguishedAt));

  // Weather
  addSection('Meteo');
  const w = record.weatherAtTime;
  addField('Temperature', w?.temperatureC != null ? `${w.temperatureC} C` : '');
  addField('Humidite', w?.humidityPct != null ? `${w.humidityPct}%` : '');
  addField('Vent', w?.windSpeedKmh != null ? `${w.windSpeedKmh} km/h ${w?.windDirection ?? ''}` : '');
  addField('Jours depuis pluie', w?.daysSinceRain != null ? String(w.daysSinceRain) : '');

  // Post-fire
  addSection('Post-incendie');
  const pf = record.postFire;
  addField('Severite', (pf?.severityAssessment as string) ?? '');
  addField('Statut recuperation', (pf?.recoveryStatus as string) ?? '');
  addField('Plan rehabilitation', (pf?.rehabilitationPlan as string) ?? '');

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Genere le ${new Date().toLocaleString('fr-FR')}`, 14, 285);

  return doc.output('arraybuffer');
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { getCurrentUser } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { withApiHandler } from '@/lib/errors/withApiHandler';

type WmsLayer = {
  Name?: string; Title?: string; Abstract?: string;
  Dimension?: { '@_name'?: string; '#text'?: string } | Array<{ '@_name'?: string; '#text'?: string }>;
  Layer?: WmsLayer | WmsLayer[];
};

const FIRE_LAYER_GROUPS: Record<string, string> = Object.fromEntries(([
  ['Detection', [
    'VIIRS_NOAA20_Thermal_Anomalies_375m_All', 'VIIRS_NOAA21_Thermal_Anomalies_375m_All',
    'VIIRS_SNPP_Thermal_Anomalies_375m_All', 'MODIS_Combined_Thermal_Anomalies_All',
  ]],
  ['Satellite imagery', [
    'VIIRS_SNPP_CorrectedReflectance_TrueColor', 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    'VIIRS_NOAA21_CorrectedReflectance_TrueColor', 'MODIS_Terra_CorrectedReflectance_TrueColor',
    'MODIS_Aqua_CorrectedReflectance_TrueColor', 'MODIS_Terra_CorrectedReflectance_Bands721',
    'MODIS_Aqua_CorrectedReflectance_Bands721',
  ]],
  ['Smoke and air', [
    'MODIS_Aqua_Aerosol_Optical_Depth_3km', 'MODIS_Terra_Aerosol_Optical_Depth_3km',
    'OMI_Aerosol_Index', 'OMPS_Aerosol_Index',
  ]],
  ['Fuels and vegetation', [
    'VIIRS_SNPP_NDVI_8Day', 'VIIRS_NOAA20_NDVI_8Day', 'MODIS_Terra_L3_NDVI_16Day',
    'MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual',
  ]],
  ['Dryness and rain', [
    'SMAP_L4_Analyzed_Surface_Soil_Moisture', 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture',
    'SMAP_L3_Passive_Enhanced_Day_Soil_Moisture', 'IMERG_Precipitation_Rate',
  ]],
] as Array<[string, string[]]>).flatMap(([group, ids]) => ids.map((id) => [id, group])));

function groupFor(name: string, title: string): string {
  const text = `${name} ${title}`.toLowerCase();
  if (/fire|burn|thermal|viirs|modis/.test(text)) return 'Fire and thermal';
  if (/sentinel|landsat|reflectance|true.?color|false.?color/.test(text)) return 'Satellite imagery';
  if (/aerosol|smoke|air.?quality|dust/.test(text)) return 'Atmosphere and smoke';
  if (/vegetation|ndvi|forest|land.?cover/.test(text)) return 'Land and vegetation';
  if (/precipitation|temperature|snow|water|soil/.test(text)) return 'Weather and water';
  return 'Other NASA layers';
}

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'OFFICIAL') throw new AppError(2001);
  const source = await fetch('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0', {
    next: { revalidate: 3600 }, signal: AbortSignal.timeout(20000),
  });
  if (!source.ok) return NextResponse.json({ layers: [], unavailable: true }, { status: 503 });
  const xml = await source.text();
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true }).parse(xml);
  const root = (parsed.WMS_Capabilities?.Capability?.Layer ?? {}) as WmsLayer;
  const layers: Array<{ id: string; title: string; description: string; group: string; timeDomain: string | null; recommended: boolean }> = [];
  const visit = (node: WmsLayer) => {
    if (node.Name) {
      const dimensions = Array.isArray(node.Dimension) ? node.Dimension : node.Dimension ? [node.Dimension] : [];
      const time = dimensions.find((dimension) => dimension['@_name']?.toLowerCase() === 'time');
      layers.push({
        id: node.Name, title: node.Title || node.Name, description: node.Abstract || '',
        group: FIRE_LAYER_GROUPS[node.Name] || groupFor(node.Name, node.Title || ''),
        timeDomain: time?.['#text'] || null, recommended: Boolean(FIRE_LAYER_GROUPS[node.Name]),
      });
    }
    for (const child of Array.isArray(node.Layer) ? node.Layer : node.Layer ? [node.Layer] : []) visit(child);
  };
  visit(root);
  return NextResponse.json({ layers }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
});

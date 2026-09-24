import { cn } from '@/lib/cn';

/** Bounding box of /brand/ifrane-relief.svg (generated from AWS Terrarium DEM, 100 m contours). */
const BBOX = { west: -5.65, south: 33.05, east: -4.75, north: 33.8 };

export const IFRANE_PLACES = [
  { name: 'Ifrane', lng: -5.107, lat: 33.527 },
  { name: 'Azrou', lng: -5.221, lat: 33.434 },
  { name: 'Aïn Leuh', lng: -5.34, lat: 33.29 },
  { name: 'Timahdite', lng: -5.06, lat: 33.24 },
  { name: 'Dayet Aoua', lng: -5.03, lat: 33.65 },
] as const;

/** Illustrative hotspots in cedar forest areas (decorative, not live data). */
const HOTSPOTS = [
  { lng: -5.15, lat: 33.39, size: 1 },
  { lng: -4.98, lat: 33.58, size: 0.7 },
  { lng: -5.3, lat: 33.35, size: 0.55 },
];

function project(lng: number, lat: number) {
  return {
    left: `${((lng - BBOX.west) / (BBOX.east - BBOX.west)) * 100}%`,
    top: `${((BBOX.north - lat) / (BBOX.north - BBOX.south)) * 100}%`,
  };
}

/**
 * Topographic relief of Ifrane Province drawn from real elevation data, used
 * as a quiet brand backdrop. Colour follows the current theme through a CSS
 * mask, so one static SVG serves light and dark.
 */
export function ReliefBackdrop({
  className,
  showPlaces = true,
  showHotspots = true,
}: {
  className?: string;
  showPlaces?: boolean;
  showHotspots?: boolean;
}) {
  return (
    <div className={cn('pointer-events-none relative aspect-square select-none', className)} aria-hidden>
      <div
        className="absolute inset-0 bg-primary/80 dark:bg-primary/60"
        style={{
          maskImage: 'url(/brand/ifrane-relief.svg)',
          WebkitMaskImage: 'url(/brand/ifrane-relief.svg)',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      />
      {showHotspots &&
        HOTSPOTS.map((spot) => (
          <span key={`${spot.lng}${spot.lat}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={project(spot.lng, spot.lat)}>
            <span
              className="ember-pulse absolute inset-0 rounded-full bg-accent-fire/50"
              style={{ width: `${2.25 * spot.size}rem`, height: `${2.25 * spot.size}rem`, margin: `-${1.125 * spot.size}rem` }}
            />
            <span className="relative block h-2.5 w-2.5 rounded-full bg-accent-fire shadow-glow-fire ring-2 ring-background" />
          </span>
        ))}
      {showPlaces &&
        IFRANE_PLACES.map((place) => (
          <span
            key={place.name}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            style={project(place.lng, place.lat)}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
            {place.name}
          </span>
        ))}
    </div>
  );
}

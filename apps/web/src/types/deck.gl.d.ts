declare module '@deck.gl/core' {
  export class Layer<Props = Record<string, unknown>> {
    constructor(props: Props);
  }
}

declare module '@deck.gl/layers' {
  export class IconLayer<T = unknown> {
    constructor(props: {
      id: string;
      data: T[];
      getPosition: (d: T) => [number, number];
      getIcon: (d: T) => { url: string; width: number; height: number };
      getSize?: () => number;
      [key: string]: unknown;
    });
  }

  export class PathLayer<T = unknown> {
    constructor(props: {
      id: string;
      data: T[];
      getPath: (d: T) => [number, number][];
      getColor?: (d: T) => number[];
      getWidth?: (d: T) => number;
      [key: string]: unknown;
    });
  }

  export class ScatterplotLayer<T = unknown> {
    constructor(props: {
      id: string;
      data: T[];
      getPosition: (d: T) => [number, number];
      getRadius?: (d: T) => number;
      getFillColor?: (d: T) => [number, number, number, number];
      radiusUnits?: string;
      stroked?: boolean;
      updateTriggers?: Record<string, unknown[]>;
      [key: string]: unknown;
    });
  }

  export class ArcLayer<T = unknown> {
    constructor(props: {
      id: string;
      data: T[];
      getSourcePosition: (d: T) => [number, number];
      getTargetPosition: (d: T) => [number, number];
      getSourceColor?: (d: T) => [number, number, number, number];
      getTargetColor?: (d: T) => [number, number, number, number];
      getHeight?: number;
      getWidth?: number;
      pickable?: boolean;
      updateTriggers?: Record<string, unknown[]>;
      onHover?: (info: unknown) => boolean;
      [key: string]: unknown;
    });
  }
}

declare module '@deck.gl/mapbox' {
  import type { ReactNode } from 'react';

  export interface MapboxOverlayProps {
    layers?: unknown[];
    children?: ReactNode;
  }

  export function MapboxOverlay(props: MapboxOverlayProps): ReactNode;
}

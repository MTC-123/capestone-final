export interface PaginationParams {
  limit?: number;
  cursor?: string;
  offset?: number;
}

export interface CursorPaginationResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

export interface OffsetPaginationResponse<T> {
  data: T[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const DEFAULT_LIMITS = {
  REPORTS: 50,
  EQUIPMENT: 100,
  INCIDENTS: 50,
  FIRE_RECORDS: 50,
} as const;

'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface ErrorInfo {
  code?: number;
  message?: string;
  requestId?: string;
}

interface ErrorContextValue {
  lastRequestId: string | null;
  setLastRequestId: (id: string | null) => void;
  lastError: ErrorInfo | null;
  setLastError: (error: ErrorInfo | null) => void;
}

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ErrorInfo | null>(null);

  const stableSetLastRequestId = useCallback((id: string | null) => setLastRequestId(id), []);
  const stableSetLastError = useCallback((err: ErrorInfo | null) => setLastError(err), []);

  const value = useMemo<ErrorContextValue>(() => ({
    lastRequestId,
    setLastRequestId: stableSetLastRequestId,
    lastError,
    setLastError: stableSetLastError,
  }), [lastRequestId, stableSetLastRequestId, lastError, stableSetLastError]);

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

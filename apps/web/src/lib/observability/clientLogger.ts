/**
 * Client-side structured logger
 * Provides JSON-formatted logging in the browser with session tracking
 */

export interface ClientLogEvent {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  requestId?: string;
  route?: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

class ClientLogger {
  private sessionId: string;
  private readonly SESSION_KEY = 'ricer_session_id';

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') {
      return 'ssr-session';
    }

    try {
      const existing = sessionStorage.getItem(this.SESSION_KEY);
      if (existing) return existing;

      const newId = crypto.randomUUID();
      sessionStorage.setItem(this.SESSION_KEY, newId);
      return newId;
    } catch {
      // Fallback if sessionStorage is not available
      return `fallback-${Date.now()}`;
    }
  }

  private createEvent(
    level: ClientLogEvent['level'],
    payload: Omit<ClientLogEvent, 'timestamp' | 'level' | 'sessionId'>
  ): ClientLogEvent {
    return {
      timestamp: new Date().toISOString(),
      level,
      sessionId: this.sessionId,
      ...payload,
    };
  }

  private log(event: ClientLogEvent): void {
    const logLine = JSON.stringify(event);

    // Log to console based on level
    switch (event.level) {
      case 'error':
        console.error(logLine);
        break;
      case 'warn':
        console.warn(logLine);
        break;
      case 'info':
        console.info(logLine);
        break;
      case 'debug':
        console.debug(logLine);
        break;
    }

    // Send critical errors to backend in production
    if (event.level === 'error' && typeof window !== 'undefined') {
      this.sendToBackend(event).catch(() => {
        // Silently fail - don't want error logging to break the app
      });
    }
  }

  private async sendToBackend(event: ClientLogEvent): Promise<void> {
    // Only send in production to avoid noise in development
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    try {
      await fetch('/api/logs/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
        // Don't wait for response
        keepalive: true,
      });
    } catch {
      // Silently fail
    }
  }

  debug(payload: Omit<ClientLogEvent, 'timestamp' | 'level' | 'sessionId'>): void {
    const event = this.createEvent('debug', payload);
    this.log(event);
  }

  info(payload: Omit<ClientLogEvent, 'timestamp' | 'level' | 'sessionId'>): void {
    const event = this.createEvent('info', payload);
    this.log(event);
  }

  warn(payload: Omit<ClientLogEvent, 'timestamp' | 'level' | 'sessionId'>): void {
    const event = this.createEvent('warn', payload);
    this.log(event);
  }

  error(payload: Omit<ClientLogEvent, 'timestamp' | 'level' | 'sessionId'>): void {
    const event = this.createEvent('error', payload);
    this.log(event);
  }
}

// Singleton instance
export const clientLogger = new ClientLogger();

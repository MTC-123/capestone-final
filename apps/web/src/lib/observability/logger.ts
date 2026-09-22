export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEvent = {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  code?: number;
  severity?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
};

function write(level: LogLevel, payload: Omit<LogEvent, 'timestamp' | 'level'>) {
  const event: LogEvent = { timestamp: new Date().toISOString(), level, ...payload };
  const line = JSON.stringify(event);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'info') console.log(line);
  else console.debug(line);
}

export const logger = {
  debug: (payload: Omit<LogEvent, 'timestamp' | 'level'>) => write('debug', payload),
  info: (payload: Omit<LogEvent, 'timestamp' | 'level'>) => write('info', payload),
  warn: (payload: Omit<LogEvent, 'timestamp' | 'level'>) => write('warn', payload),
  error: (payload: Omit<LogEvent, 'timestamp' | 'level'>) => write('error', payload),
};


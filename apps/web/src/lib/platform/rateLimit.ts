import type { RedisClientType } from 'redis';

export type SlidingWindowLimitInput = {
  redis: RedisClientType | null;
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
};

export type SlidingWindowLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
};

const inMemoryWindows = new Map<string, number[]>();

function inMemoryLimit(input: SlidingWindowLimitInput): SlidingWindowLimitResult {
  const nowMs = input.nowMs ?? Date.now();
  const windowStart = nowMs - input.windowMs;

  const existing = inMemoryWindows.get(input.key) ?? [];
  const pruned = existing.filter((ts) => ts > windowStart);
  pruned.push(nowMs);
  inMemoryWindows.set(input.key, pruned);

  const count = pruned.length;
  const allowed = count <= input.limit;
  const remaining = Math.max(0, input.limit - count);

  if (allowed) return { allowed, limit: input.limit, remaining };

  const oldest = pruned[0] ?? nowMs;
  const retryAfterMs = Math.max(0, oldest + input.windowMs - nowMs);
  return { allowed, limit: input.limit, remaining, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

const slidingWindowScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZADD', key, now, member)
redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)
local earliest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local earliestScore = nil
if earliest and earliest[2] then
  earliestScore = tonumber(earliest[2])
end
redis.call('PEXPIRE', key, windowMs)
return { count, earliestScore }
`;

export async function slidingWindowLimit(input: SlidingWindowLimitInput): Promise<SlidingWindowLimitResult> {
  const nowMs = input.nowMs ?? Date.now();
  if (!input.redis) return inMemoryLimit({ ...input, nowMs });

  const member = `${nowMs}:${Math.random()}`;
  const result = (await input.redis.eval(slidingWindowScript, {
    keys: [input.key],
    arguments: [String(nowMs), String(input.windowMs), String(input.limit), member],
  })) as unknown;

  const tuple = Array.isArray(result) ? result : [];
  const count = Number(tuple[0] ?? 0);
  const earliestScore = typeof tuple[1] === 'number' ? Number(tuple[1]) : undefined;

  const allowed = count <= input.limit;
  const remaining = Math.max(0, input.limit - count);
  if (allowed) return { allowed, limit: input.limit, remaining };

  const oldest = earliestScore ?? nowMs;
  const retryAfterMs = Math.max(0, oldest + input.windowMs - nowMs);
  return { allowed, limit: input.limit, remaining, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

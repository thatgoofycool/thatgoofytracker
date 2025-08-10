import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Prefer Upstash; fall back to simple in-memory limiter for dev
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  ratelimit = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(30, '60 s') });
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

export async function limitRequest(key: string): Promise<{ allowed: boolean; reset: number }>{
  if (ratelimit) {
    const { success, reset } = await ratelimit.limit(key);
    return { allowed: success, reset };
  }
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 30;
  const b = memoryBuckets.get(key);
  if (!b || b.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, reset: now + windowMs };
  }
  if (b.count < limit) {
    b.count++;
    return { allowed: true, reset: b.resetAt };
  }
  return { allowed: false, reset: b.resetAt };
}



// lib/rate-limit.js

// Keep a singleton across hot reloads
const buckets = globalThis.__rateBuckets ?? (globalThis.__rateBuckets = new Map());

const DEFAULT_OPTIONS = {
  maxPerMinute: 60,
  windowMs: 60 * 1000,
};

function normalizeIp(ip = '') {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function getClientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').toString();
  const fwd = xf.split(',')[0].trim();
  const xr = (req.headers['x-real-ip'] || '').toString().trim();
  const sock = req.socket?.remoteAddress || '';
  const ip = fwd || xr || sock || 'unknown';
  return normalizeIp(ip);
}

/**
 * Token-bucket limiter
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{maxPerMinute?: number, windowMs?: number}} options
 * @returns {Promise<boolean>} true if allowed; false if limited (and response sent)
 */
export async function rateLimit(req, res, options = {}) {
  const { maxPerMinute, windowMs } = { ...DEFAULT_OPTIONS, ...options };
  const now = Date.now();
  const refillRate = maxPerMinute / (windowMs / 1000); // tokens per second
  const ip = getClientIp(req);

  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { tokens: maxPerMinute, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // Refill tokens
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  const refill = elapsedSec * refillRate;
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + refill);
  bucket.lastRefill = now;

  // Lazy cleanup of stale buckets
  const stale = now - bucket.lastRefill > windowMs * 5 && bucket.tokens >= maxPerMinute;
  if (stale) buckets.delete(ip);

  if (bucket.tokens < 1) {
    const secondsPerToken = windowMs / 1000 / maxPerMinute;
    const retryAfter = Math.max(1, Math.ceil(secondsPerToken));

    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', String(maxPerMinute));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.status(429).json({ error: 'Too many requests', retryAfter });
    return false;
  }

  bucket.tokens -= 1;

  // Optional response headers for clients
  res.setHeader('X-RateLimit-Limit', String(maxPerMinute));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(Math.floor(bucket.tokens), 0)));

  return true;
}

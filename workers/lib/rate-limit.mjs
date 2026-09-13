export class RateLimiter {
  constructor(maxEntries = 5000) {
    this.map = new Map();
    this.maxEntries = maxEntries;
  }

  check(ip, opts, now = Date.now()) {
    const windowMs = Number(opts.windowMs) || 60000;
    const maxRequests = Number(opts.maxRequests) || 100;
    const blockDuration = Number(opts.blockDuration) || 300000;
    let entry = this.map.get(ip);
    if (entry) {
      if (entry.blockedUntil && now < entry.blockedUntil) return 'blocked';
      entry.hits = entry.hits.filter((t) => now - t < windowMs);
      if (entry.hits.length >= maxRequests) {
        entry.blockedUntil = now + blockDuration;
        return 'limited';
      }
      entry.hits.push(now);
    } else {
      this.map.set(ip, { hits: [now] });
    }
    if (this.map.size > this.maxEntries) this.evict(now, windowMs);
    return 'ok';
  }

  evict(now, windowMs) {
    for (const [ip, data] of this.map) {
      if (data.blockedUntil) {
        if (data.blockedUntil <= now) this.map.delete(ip);
        continue;
      }
      const hits = data.hits.filter((t) => now - t < windowMs);
      if (hits.length === 0) this.map.delete(ip);
      else data.hits = hits;
    }
  }

  get size() {
    return this.map.size;
  }
}

export function isStaticAsset(pathname, prefixes) {
  if (!Array.isArray(prefixes) || prefixes.length === 0) return false;
  const p = String(pathname || '').toLowerCase();
  return prefixes.some((prefix) => p.startsWith(String(prefix).toLowerCase()));
}

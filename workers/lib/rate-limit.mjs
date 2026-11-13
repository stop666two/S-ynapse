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
    if (this.map.size <= this.maxEntries) return;
    // 硬上限（审查 R-08）：同一窗口内涌来大量不同源 IP 时，上面的清理一条都删不掉
    // （每个条目都在窗口内或仍在封禁中），map 会无界增长、每请求再全表扫描一次。
    // 因此仍超限时按「最早失效」批量淘汰到低水位：blockedUntil 作失效时刻，未封禁条目
    // 以最后一次命中时间参与排序。淘汰到低水位而非恰好到上限，避免每来一个新 IP 就全表排序。
    const lowWater = Math.max(1, Math.floor(this.maxEntries * 0.9));
    const ranked = [];
    for (const [ip, data] of this.map) {
      const lastHit = data.hits.length ? data.hits[data.hits.length - 1] : 0;
      ranked.push({ ip, rank: data.blockedUntil ? data.blockedUntil : lastHit });
    }
    ranked.sort((a, b) => a.rank - b.rank);
    const dropCount = ranked.length - lowWater;
    for (let i = 0; i < dropCount; i++) this.map.delete(ranked[i].ip);
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

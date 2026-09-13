export function stripIp(raw) {
  if (typeof raw !== 'string') return '';
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'));
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);
  if (ip.startsWith('::ffff:') && ip.includes('.')) ip = ip.slice(7);
  return ip;
}

function parseIpv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8) | n;
  }
  return { version: 4, value: BigInt(value >>> 0), bits: 32 };
}

function parseIpv6(ip) {
  const dc = ip.indexOf('::');
  if (dc !== -1 && ip.indexOf('::', dc + 2) !== -1) return null;
  const parseHexGroup = (part) => (/^[0-9a-f]{1,4}$/.test(part) ? parseInt(part, 16) : null);
  const parseLastV4 = (part) => {
    const v4 = parseIpv4(part);
    if (!v4) return null;
    return [Number(v4.value >> 16n), Number(v4.value & 0xffffn)];
  };
  let groups = [];
  if (dc === -1) {
    const parts = ip.split(':');
    if (parts.length !== 8) return null;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.indexOf('.') !== -1) {
        if (i !== parts.length - 1) return null;
        const pair = parseLastV4(part);
        if (!pair) return null;
        groups.push(...pair);
      } else {
        const g = parseHexGroup(part);
        if (g === null) return null;
        groups.push(g);
      }
    }
    if (groups.length !== 8) return null;
  } else {
    const headStr = ip.slice(0, dc);
    const tailStr = ip.slice(dc + 2);
    const headParts = headStr ? headStr.split(':') : [];
    const tailParts = tailStr ? tailStr.split(':') : [];
    const head = [];
    for (const part of headParts) {
      const g = parseHexGroup(part);
      if (g === null) return null;
      head.push(g);
    }
    const tail = [];
    for (let i = 0; i < tailParts.length; i++) {
      const part = tailParts[i];
      if (part.indexOf('.') !== -1) {
        if (i !== tailParts.length - 1) return null;
        const pair = parseLastV4(part);
        if (!pair) return null;
        tail.push(...pair);
      } else {
        const g = parseHexGroup(part);
        if (g === null) return null;
        tail.push(g);
      }
    }
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill(0), ...tail];
  }
  let value = 0n;
  for (const group of groups) value = (value << 16n) | BigInt(group);
  return { version: 6, value, bits: 128 };
}

export function parseIp(raw) {
  const ip = stripIp(raw);
  if (!ip) return null;
  return parseIpv4(ip) || parseIpv6(ip);
}

export function ipMatchesCidr(rawIp, entry) {
  const ip = parseIp(rawIp);
  if (!ip) return false;
  const source = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
  if (!source) return false;
  const slash = source.lastIndexOf('/');
  const addr = slash === -1 ? source : source.slice(0, slash);
  const target = parseIp(addr);
  if (!target) return false;
  if (slash === -1) return target.version === ip.version && target.value === ip.value;
  const prefix = parseInt(source.slice(slash + 1), 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > target.bits) return false;
  if (target.version !== ip.version) return false;
  const shift = BigInt(target.bits - prefix);
  return (ip.value >> shift) === (target.value >> shift);
}

export function ipMatchesAny(rawIp, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  return entries.some((entry) => ipMatchesCidr(rawIp, entry));
}

export function normalizePath(pathname) {
  let p = typeof pathname === 'string' ? pathname : '';
  try {
    p = decodeURIComponent(p);
  } catch (e) { /* 保留原值 */ }
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p.toLowerCase();
}

export function isPathBlocked(pathname, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const path = normalizePath(pathname);
  for (const rule of rules) {
    const entry = typeof rule === 'string' ? { path: rule } : rule;
    if (!entry || !entry.path) continue;
    const base = normalizePath(String(entry.path).replace(/\/\*$/, ''));
    if (!base || base === '/') continue;
    if (path === base || path.startsWith(base + '/')) return entry;
  }
  return null;
}

const rateLimitMap = new Map();

const CONFIG = {
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    blockDuration: 300000,
  },
  csp: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "object-src": ["'none'"],
      "frame-src": ["'none'"],
    }
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (url.pathname === '/csp-report' && request.method === 'POST') {
    try {
      const report = await request.json();
      console.log('CSP Violation:', JSON.stringify(report));
    } catch (e) {}
    return new Response('ok', { status: 200 });
  }

  if (CONFIG.rateLimiting) {
    const now = Date.now();
    const windowMs = CONFIG.rateLimiting.windowMs;
    const maxRequests = CONFIG.rateLimiting.maxRequests;
    const blockDuration = CONFIG.rateLimiting.blockDuration;

    let entry = rateLimitMap.get(clientIP);
    if (entry) {
      if (entry.blockedUntil && now < entry.blockedUntil) {
        return new Response('Too Many Requests', { status: 429 });
      }
      entry.hits = entry.hits.filter(t => now - t < windowMs);
      if (entry.hits.length >= maxRequests) {
        entry.blockedUntil = now + blockDuration;
        return new Response('Too Many Requests', { status: 429 });
      }
      entry.hits.push(now);
    } else {
      rateLimitMap.set(clientIP, { hits: [now] });
    }
    if (rateLimitMap.size > 10000) {
      const cutoff = now - windowMs;
      for (const [ip, data] of rateLimitMap) {
        if (data.blockedUntil && data.blockedUntil < now) {
          rateLimitMap.delete(ip);
        } else {
          data.hits = data.hits.filter(t => now - t < windowMs);
          if (data.hits.length === 0) rateLimitMap.delete(ip);
        }
      }
    }
  }

  if (url.pathname.startsWith('/admin/')) {
    return new Response('Forbidden', { status: 403 });
  }

  const response = await env.ASSETS.fetch(request);

  const headers = new Headers(response.headers);

  const cspDirectives = [];
  for (const [key, vals] of Object.entries(CONFIG.csp.directives)) {
    if (Array.isArray(vals) && vals.length > 0) {
      cspDirectives.push(`${key} ${vals.join(' ')}`);
    }
  }
  if (cspDirectives.length > 0) {
    headers.set('Content-Security-Policy', cspDirectives.join('; '));
  }

  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set('X-XSS-Protection', '1; mode=block');

  if (url.protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  fetch: handleRequest,
};

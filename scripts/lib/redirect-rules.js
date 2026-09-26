'use strict';
// 重定向规则归一化（纯函数）：把 site.json5 redirects 数组清洗为
// { from, to, status } 列表；非法规则按 features.redirects.invalidRule 策略分流。
// generateRedirects（scripts/build/security-files.js）与本模块共用同一实现，单测覆盖两种策略。
// 控制字符（含空白）混入 from/to 会造成规则解析歧义，必须剔除（与历史实现同源）。
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\s\u0000-\u001f\u007f]+/g;

function normalizeRedirectRule(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'missing from/to' };
  }
  if (!raw.from || !raw.to) {
    return { ok: false, reason: 'missing from/to' };
  }
  const from = String(raw.from).replace(CONTROL_CHARS, '');
  const to = String(raw.to).replace(CONTROL_CHARS, '');
  if (!from.startsWith('/') || !/^(?:\/|https?:\/\/)/i.test(to)) {
    return { ok: false, reason: 'from must start with "/", to must be a path or http(s) URL' };
  }
  return { ok: true, rule: { from, to, status: raw.permanent === false ? 302 : 301 }, cleaned: true };
}

// invalidRule='warn-only' 时非法规则仅告警跳过（历史行为）；其他取值（含默认 'abort'）
// 视为 abort：调用方应记录构建失败，构建结束时以非零退出。
function normalizeRedirectRules(list, invalidRule) {
  const valid = [];
  const invalid = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const res = normalizeRedirectRule(raw);
    if (res.ok) valid.push(res.rule);
    else invalid.push({ rule: raw, reason: res.reason });
  }
  return { valid, invalid, abortOnInvalid: invalidRule !== 'warn-only' };
}

module.exports = { normalizeRedirectRule, normalizeRedirectRules };

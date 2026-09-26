'use strict';

const zlib = require('node:zlib');

const DEFAULTS = { htmlKb: 28, htmlRawKb: 50, inlineConfigKb: 2, jsKb: 60, requests: 12 };

function toNumber(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function gzipSize(buffer) {
  return zlib.gzipSync(buffer).length;
}

function evaluatePerfBudget(stats, budget) {
  const raw = budget || {};
  const limits = {
    htmlKb: toNumber(raw.htmlKb, DEFAULTS.htmlKb),
    htmlRawKb: toNumber(raw.htmlRawKb, DEFAULTS.htmlRawKb),
    inlineConfigKb: toNumber(raw.inlineConfigKb, DEFAULTS.inlineConfigKb),
    jsKb: toNumber(raw.jsKb, DEFAULTS.jsKb),
    requests: toNumber(raw.requests, DEFAULTS.requests)
  };
  const defs = [
    { key: 'htmlKb', label: 'HTML(单页 gzip 最大)' },
    { key: 'htmlRawKb', label: 'HTML(页面 raw 中位)' },
    { key: 'inlineConfigKb', label: '内联关键配置' },
    { key: 'jsKb', label: 'JS(全站 gzip 合计)' },
    { key: 'requests', label: '单页静态请求(最大)' }
  ];
  const items = defs
    .filter(def => Number.isFinite(Number(stats[def.key])))
    .map(def => ({ key: def.key, label: def.label, value: Number(stats[def.key]), limit: limits[def.key] }))
    .map(item => Object.assign({}, item, { ok: item.value <= item.limit }));
  return { ok: items.every(item => item.ok), items };
}

function formatPerfBudget(report, warnOnly) {
  const lines = ['[budget] 性能预算检查:'];
  for (const item of report.items) {
    const valueText = item.key === 'requests' ? String(Math.round(item.value)) : item.value.toFixed(1) + 'KB';
    const limitText = item.key === 'requests' ? String(Math.round(item.limit)) : item.limit.toFixed(1) + 'KB';
    lines.push('  ' + (item.ok ? 'OK  ' : 'OVER') + ' ' + item.label + ': ' + valueText + ' / ' + limitText);
  }
  if (!report.ok) {
    lines.push(warnOnly
      ? '  [warn] 存在超出预算项(warnOnly=true,仅提醒不阻断;可将 features.perfBudget.warnOnly 设为 false 改为阻断构建)'
      : '  [error] 存在超出预算项,构建终止(features.perfBudget.warnOnly=false)');
  }
  return lines.join('\n');
}

module.exports = { evaluatePerfBudget, gzipSize, formatPerfBudget, DEFAULTS };

const fs = require('fs');
const path = require('path');
const json5 = require('json5');
const ROOT = path.resolve(__dirname, '..');
const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
const schema = require('./lib/features-schema.js');
const defaults = schema.DEFAULT_FEATURES;
if (!defaults || typeof defaults !== 'object') {
  console.error('[verify:config] DEFAULT_FEATURES not found in scripts/lib/features-schema.js');
  process.exit(1);
}
const diffs = [];
function walk(cfg, def, p) {
  if (cfg === null || typeof cfg !== 'object') {
    if (def === undefined) { diffs.push(p + ' 仅存在于 features.json5（schema 缺失默认值）'); return; }
    if (JSON.stringify(cfg) !== JSON.stringify(def)) {
      diffs.push(p + ' 配置=' + JSON.stringify(cfg) + ' ≠ 默认=' + JSON.stringify(def));
    }
    return;
  }
  if (Array.isArray(cfg)) {
    if (def !== undefined && !Array.isArray(def)) { diffs.push(p + ' 类型不一致：配置为数组、默认非数组'); return; }
    if (Array.isArray(def) && def.length === 0) return;
    cfg.forEach((v, i) => walk(v, (def || [])[i], p + '[' + i + ']'));
    return;
  }
  for (const k of Object.keys(cfg)) {
    const d = def ? def[k] : undefined;
    walk(cfg[k], d, p + '.' + k);
  }
}
walk(features, defaults, 'features');
console.log('[verify:config] features.json5 ↔ DEFAULT_FEATURES 比对完成');
if (diffs.length) {
  console.error('[verify:config] 发现 ' + diffs.length + ' 处不一致（前 30 条）：');
  diffs.slice(0, 30).forEach(d => console.error('  - ' + d));
  console.error('[verify:config] FAIL：请同步 features.json5 与 scripts/lib/features-schema.js 的默认值');
  process.exit(1);
}
console.log('[verify:config] PASS：' + Object.keys(features).length + ' 个模块全部一致（schema 额外键允许存在）');

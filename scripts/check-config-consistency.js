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
const { compareFeatures } = require('./lib/config-consistency.js');
const { errors: featureErrors, overrides: featureOverrides } = compareFeatures(features, defaults);
const diffs = featureErrors.slice();
console.log('[verify:config] features.json5 ↔ DEFAULT_FEATURES 比对完成' +
  (featureOverrides.length ? '（用户覆盖 ' + featureOverrides.length + ' 处，值差异不影响通过）' : ''));
featureOverrides.slice(0, 10).forEach(o => console.log('  · 覆盖 ' + o));

// ---------- 第二部分：site/navigation/sidebar/footer 等配置文件结构监守 ----------
// 目的：配置键必须存在于默认值注册表（lib/site-defaults.js），防止
// “配置有键、代码无消费”的死键重现。值允许不同（用户覆盖），只比结构与类型。
// 自由映射（默认值为 {}）跳过递归，如 social.items / pwa.manifest。
// 豁免：theme.json5（preset 预设接管 colors/darkMode）、security.json5（注册表为部分
// 默认值，hardening/rateLimiting 细项由 security.json5 全量提供）。
// tuning.json5 与 guard.json5 的结构注册表在 lib/tuning-defaults.js / lib/guard-defaults.js。
const { DEFAULT_CONFIG } = require('./lib/site-defaults.js');
const { DEFAULT_TUNING } = require('./lib/tuning-defaults.js');
const { DEFAULT_GUARD } = require('./lib/guard-defaults.js');
const STRUCT_FILES = [
  ['site.json5', 'site'],
  ['navigation.json5', 'navigation'],
  ['sidebar.json5', 'sidebar'],
  ['footer.json5', 'footer'],
  ['content-policy.json5', 'contentPolicy'],
  ['tag-aliases.json5', 'tagAliases'],
  ['friends.json5', 'friends'],
  ['tuning.json5', 'tuning'],
  ['guard.json5', 'guard']
];
const STRUCT_REGISTRY = Object.assign({}, DEFAULT_CONFIG, { tuning: DEFAULT_TUNING, guard: DEFAULT_GUARD });
const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
function checkStructure(user, def, p, out) {
  if (Array.isArray(user)) {
    if (def !== undefined && !Array.isArray(def)) { out.push(p + ' 类型不一致：配置为数组、默认非数组'); return; }
    return;
  }
  if (user !== null && typeof user === 'object') {
    if (def !== undefined && (def === null || typeof def !== 'object' || Array.isArray(def))) { out.push(p + ' 类型不一致：配置为对象、默认非对象'); return; }
    if (def && typeof def === 'object' && !Array.isArray(def) && Object.keys(def).length === 0) return;
    for (const k of Object.keys(user)) {
      if (def === undefined || def === null || typeof def !== 'object' || !(k in def)) { out.push(p + '.' + k + ' 仅存在于配置（默认注册表缺失，疑似死键）'); continue; }
      checkStructure(user[k], def[k], p + '.' + k, out);
    }
    return;
  }
  if (def === undefined) { out.push(p + ' 仅存在于配置（默认注册表缺失，疑似死键）'); return; }
  if (typeOf(user) !== typeOf(def)) out.push(p + ' 类型不一致：配置=' + typeOf(user) + '、默认=' + typeOf(def));
}
let structChecked = 0;
for (const [file, section] of STRUCT_FILES) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  let parsed;
  try { parsed = json5.parse(fs.readFileSync(abs, 'utf-8')); } catch (e) { diffs.push(file + ' 解析失败：' + e.message); continue; }
  // 仅当文件是“单键包装”（如 { navigation: {...} }）时解包该键；否则整文件即区块本体。
  // 避免 filename 与内部键同名（如 friends.json5 内的 friends 数组）被误当作解包。
  const wrapped = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 1 && parsed[section] !== undefined;
  const userBlock = wrapped ? parsed[section] : parsed;
  checkStructure(userBlock, STRUCT_REGISTRY[section], section, diffs);
  structChecked++;
}
console.log('[verify:config] 结构监守完成：' + structChecked + ' 个配置文件（theme/security 按豁免策略跳过）');
if (diffs.length) {
  console.error('[verify:config] 发现 ' + diffs.length + ' 处不一致（前 30 条）：');
  diffs.slice(0, 30).forEach(d => console.error('  - ' + d));
  console.error('[verify:config] FAIL：请同步配置与默认值注册表（features → lib/features-schema.js；其余 → lib/site-defaults.js）');
  process.exit(1);
}
console.log('[verify:config] PASS：' + Object.keys(features).length + ' 个模块全部一致（schema 额外键允许存在）');

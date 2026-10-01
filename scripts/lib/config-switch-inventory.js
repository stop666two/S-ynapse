'use strict';

// 配置开关盘点与测试覆盖矩阵（单一实现）：
//   - 开关全集 = features/tuning/site/internals 注册表中的布尔、枚举与数值叶子；
//   - 消费位置 = 按「叶子键 + 最近父段」评分定位的首个源码引用（file:line）；
//   - 覆盖证据 = 测试文件中的 `// switch: <键路径>` 标记 > 既有测试键名引用 > 豁免登记。
// scripts/gen-config-switch-matrix.js 生成文档，scripts/check-config-single-source.js 校验。

const fs = require('fs');
const path = require('path');
const { DEFAULT_FEATURES, ENUM_FIELDS } = require('./features-schema.js');
const { DEFAULT_TUNING } = require('./tuning-defaults.js');
const { DEFAULT_CONFIG } = require('./site-defaults.js');
const { DEFAULTS: INTERNAL_DEFAULTS } = require('./internals-defaults.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['js', 'templates', 'scripts', 'workers'];
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'real-site', '.tmp-scripts', '.cache', 'build-artifacts']);
const SOURCE_EXCLUDE_FILES = new Set([
  'features-schema.js', 'site-defaults.js', 'tuning-defaults.js', 'guard-defaults.js',
  'internals-defaults.js', 'check-config-refs.js'
]);

const SWITCH_MARKER_RE = /\/\/\s*switch:\s*([A-Za-z0-9_.-]+(?:\s*,\s*[A-Za-z0-9_.-]+)*)/g;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { return out; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(js|mjs|ejs|cjs)$/i.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function walkLeaves(obj, prefix, out) {
  if (!isPlainObject(obj)) { out.push([prefix, obj]); return; }
  for (const key of Object.keys(obj)) walkLeaves(obj[key], prefix ? prefix + '.' + key : key, out);
}

function enumPathsFor(moduleName) {
  const spec = ENUM_FIELDS[moduleName];
  return spec ? new Set(Object.keys(spec)) : new Set();
}

function collectRows() {
  const rows = [];
  const featureLeaves = [];
  walkLeaves(DEFAULT_FEATURES, '', featureLeaves);
  for (const [leafPath, value] of featureLeaves) {
    const segments = leafPath.split('.');
    const relative = segments.slice(1).join('.');
    const isEnum = enumPathsFor(segments[0]).has(relative);
    const type = typeof value === 'boolean' ? 'bool' : (isEnum ? 'enum' : (typeof value === 'number' ? 'number' : null));
    if (!type) continue;
    rows.push({ keyPath: 'features.' + leafPath, kind: 'features', type, def: value });
  }
  const tuningLeaves = [];
  walkLeaves(DEFAULT_TUNING, '', tuningLeaves);
  for (const [leafPath, value] of tuningLeaves) {
    const type = typeof value === 'boolean' ? 'bool' : (typeof value === 'number' ? 'number' : null);
    if (!type) continue;
    rows.push({ keyPath: 'tuning.' + leafPath, kind: 'tuning', type, def: value });
  }
  for (const section of Object.keys(DEFAULT_CONFIG)) {
    if (section === 'features') continue;
    const leaves = [];
    walkLeaves(DEFAULT_CONFIG[section], '', leaves);
    for (const [leafPath, value] of leaves) {
      const type = typeof value === 'boolean' ? 'bool' : (typeof value === 'number' ? 'number' : null);
      if (!type) continue;
      rows.push({ keyPath: section + '.' + leafPath, kind: section, type, def: value });
    }
  }
  const internalLeaves = [];
  walkLeaves(INTERNAL_DEFAULTS, '', internalLeaves);
  for (const [leafPath, value] of internalLeaves) {
    const type = typeof value === 'boolean' ? 'bool' : (typeof value === 'number' ? 'number' : null);
    if (!type) continue;
    rows.push({ keyPath: 'internals.' + leafPath, kind: 'internals', type, def: value });
  }
  rows.sort((a, b) => a.keyPath.localeCompare(b.keyPath));
  return rows;
}

function collectRegistryPaths() {
  const paths = new Set();
  const registries = [['features', DEFAULT_FEATURES], ['tuning', DEFAULT_TUNING], ['internals', INTERNAL_DEFAULTS]];
  for (const section of Object.keys(DEFAULT_CONFIG)) {
    if (section !== 'features') registries.push([section, DEFAULT_CONFIG[section]]);
  }
  for (const [prefix, root] of registries) {
    const leaves = [];
    walkLeaves(root, '', leaves);
    for (const [leafPath] of leaves) paths.add(prefix + '.' + leafPath);
  }
  return paths;
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function buildIndex(files, { skipTests }) {
  const index = new Map();
  for (const file of files) {
    const rel = relativePath(file);
    const isTest = rel.endsWith('.test.js');
    if (skipTests === isTest) continue;
    let text;
    try { text = fs.readFileSync(file, 'utf-8'); } catch (error) { continue; }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 400000) continue;
      const tokens = line.match(/[A-Za-z_$][\w$-]*/g);
      if (!tokens) continue;
      const ctx = line.slice(0, 240);
      const seen = new Set(tokens);
      for (const token of seen) {
        if (!index.has(token)) index.set(token, []);
        index.get(token).push({ file: rel, line: i + 1, ctx });
      }
    }
  }
  return index;
}

function locate(index, keyPath, maxHits) {
  const segments = keyPath.split('.');
  const leaf = segments[segments.length - 1];
  const parents = segments.slice(1, -1).slice(-2);
  const hits = [];
  const seen = new Set();
  for (const hit of index.get(leaf) || []) {
    const lineKey = hit.file + ':' + hit.line;
    if (seen.has(lineKey)) continue;
    seen.add(lineKey);
    let score = 1;
    for (const parent of parents) if (hit.ctx.includes(parent)) score += 3;
    if (hit.ctx.includes(segments[0])) score += 1;
    hits.push({ file: hit.file, line: hit.line, score });
    if (hits.length >= (maxHits || 3) * 8) break;
  }
  hits.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
  return hits.slice(0, maxHits || 3).map((hit) => hit.file + ':' + hit.line);
}

function collectSwitchMarkers(testFiles) {
  const markers = new Map();
  for (const file of testFiles) {
    const rel = relativePath(file);
    const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      SWITCH_MARKER_RE.lastIndex = 0;
      let match;
      while ((match = SWITCH_MARKER_RE.exec(lines[i])) !== null) {
        for (const key of match[1].split(',').map((part) => part.trim()).filter(Boolean)) {
          if (!markers.has(key)) markers.set(key, []);
          markers.get(key).push(rel + ':' + (i + 1));
        }
      }
    }
  }
  return markers;
}

function collectAllMarkers() {
  const files = [];
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir), files);
  return collectSwitchMarkers(files.filter((file) => file.endsWith('.test.js')));
}

function loadExemptions(file) {
  const target = file || path.join(ROOT, 'scripts', 'config-switch-exemptions.json');
  const parsed = JSON.parse(fs.readFileSync(target, 'utf-8'));
  return { categories: parsed.categories || {}, keys: parsed.keys || {} };
}

function exemptionReason(exemptions, keyPath) {
  const value = exemptions.keys[keyPath];
  if (!value) return null;
  if (typeof value === 'string') return exemptions.categories[value] || value;
  return value.reason || '';
}

function collectInventory(options) {
  const opts = options || {};
  const files = [];
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir), files);
  const sourceFiles = files.filter((file) => !file.endsWith('.test.js') && !SOURCE_EXCLUDE_FILES.has(path.basename(file)));
  const testFiles = files.filter((file) => file.endsWith('.test.js'));
  const sourceIndex = buildIndex(sourceFiles, { skipTests: true });
  const testIndex = buildIndex(testFiles, { skipTests: false });
  const markers = collectSwitchMarkers(testFiles);
  const exemptions = loadExemptions(opts.exemptionsPath);
  const rows = collectRows();
  return rows.map((row) => {
    const tested = markers.get(row.keyPath) || [];
    const existing = locate(testIndex, row.keyPath, 2);
    const exemptReason = exemptionReason(exemptions, row.keyPath);
    let status = 'MISSING';
    if (tested.length) status = 'tested';
    else if (exemptReason) status = 'exempt';
    else if (existing.length) status = 'existing';
    return {
      ...row,
      consumers: locate(sourceIndex, row.keyPath, 3),
      tested,
      existing,
      exemptReason,
      status
    };
  });
}

function statusLabel(status) {
  if (status === 'tested') return '已测（marker）';
  if (status === 'existing') return '既有引用';
  if (status === 'exempt') return '豁免';
  return '缺失';
}

function formatDef(value) {
  if (typeof value === 'string') return value === '' ? '（空串）' : '`' + value + '`';
  if (typeof value === 'number') return String(value);
  return value ? 'true' : 'false';
}

function buildMatrix(inventory) {
  const rows = inventory || collectInventory();
  const counts = { tested: 0, existing: 0, exempt: 0, MISSING: 0, total: rows.length };
  for (const row of rows) counts[row.status] += 1;
  const lines = [];
  lines.push('# 配置开关矩阵（行为开关 → 消费位置 → 覆盖证据）');
  lines.push('');
  lines.push('> 本文件由 `node scripts/gen-config-switch-matrix.js` 生成，禁止手改；');
  lines.push('> 键全集来自 `features-schema.js` / `tuning-defaults.js` / `site-defaults.js`（site/navigation/sidebar/footer/theme/security/friends/tagAliases/contentPolicy 全段）/ `internals-defaults.js` 注册表；');
  lines.push('> `guard.json5` 细节键由 `guard-defaults.js` 与 guard 测试覆盖，不在本矩阵。');
  lines.push('> 覆盖证据优先级：测试内 `// switch: <键路径>` 标记 > 既有测试键名引用 > `scripts/config-switch-exemptions.json` 豁免理由。');
  lines.push('> 消费位置按「叶子键名 + 父段」评分定位首个源码引用，供人工复核；存在同名字段的模块以类型与默认值判别。');
  lines.push('> 回退字面量必须与注册表默认一致，由 `scripts/config-fallback-bindings.json` + `verify:config-single-source` 锁定。');
  lines.push('');
  lines.push('统计：开关共 ' + counts.total + '（已测 ' + counts.tested + '，既有引用 ' + counts.existing +
    '，豁免 ' + counts.exempt + '，缺失 ' + counts.MISSING + '）；缺失必须为 0 才能通过 `verify:config-single-source`。');
  lines.push('');
  lines.push('| 键路径 | 类型 | 默认 | 消费位置 | 测试证据 | 覆盖状态 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of rows) {
    const evidence = row.status === 'tested'
      ? row.tested.slice(0, 2).join('<br>')
      : (row.status === 'existing' ? row.existing.join('<br>') : (row.status === 'exempt' ? '豁免理由见 `scripts/config-switch-exemptions.json`' : '—'));
    lines.push('| `' + row.keyPath + '` | ' + row.type + ' | ' + formatDef(row.def) + ' | ' +
      (row.consumers.join('<br>') || '—') + ' | ' + evidence + ' | ' + statusLabel(row.status) + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  ROOT,
  SWITCH_MARKER_RE,
  collectRows,
  collectRegistryPaths,
  collectInventory,
  collectSwitchMarkers,
  collectAllMarkers,
  loadExemptions,
  exemptionReason,
  buildMatrix,
  statusLabel
};

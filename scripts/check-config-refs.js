#!/usr/bin/env node
'use strict';
// 配置引用扫描（verify:config-refs）：从 JSON5 配置文件提取叶子键名，扫描
// js/、templates/、scripts/、workers/ 源码中的引用，报出「零引用」键。
// 目的：防止「配置有键、代码无消费」的预留键重新出现。
//
// 判定口径：
//   - 叶子键 = 对象递归到非对象/数组值；
//   - 引用 = 键名在源码中以独立标识符出现（前后非 [A-Za-z0-9_$-]）；
//   - 排除：注册表（features-schema/site-defaults/tuning-defaults/guard-defaults）、
//     测试文件、本脚本与允许名单文件；
//   - 通用短键名（enabled/title/url 等）不参与判定（无法可靠区分，属已知盲区）。
// 允许名单：scripts/config-refs-allowlist.json（逐项写明理由；支持结尾 * 的通配）。
// 零未引用键时退出码 0，否则 1。
const fs = require('fs');
const path = require('path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILES = [
  'features.json5', 'site.json5', 'theme.json5', 'navigation.json5', 'sidebar.json5',
  'footer.json5', 'security.json5', 'tuning.json5', 'guard.json5', 'ui-strings.json5',
  'tag-aliases.json5', 'friends.json5', 'content-policy.json5', 'compression.json5',
  'internals.json5'
];
const SCAN_DIRS = ['js', 'templates', 'scripts', 'workers'];
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'real-site', '.tmp-scripts', '.cache', 'build-artifacts', '.playwright-mcp']);
const EXCLUDE_FILES = new Set([
  'check-config-refs.js',
  'features-schema.js', 'site-defaults.js', 'tuning-defaults.js', 'guard-defaults.js', 'config-refs-allowlist.json',
  'internals-defaults.js', 'config-switch-exemptions.json', 'config-fallback-bindings.json',
  // workers/security-config.js 是构建产物（.gitignore，由 build 生成），内容基本是把配置原样回显：
  // 把它当「引用证据」等于自证，且会让结果取决于「本次是否构建过」——CI 的 compat 任务
  // （build 之前跑 test）因此恒红、本地（build 过）恒绿。引用判定只看手写源码。
  'security-config.js'
]);
// 通用短键名/数据键名：无法可靠按名判定（模板与运行时经整体对象消费）。
const GENERIC_KEYS = new Set([
  'enabled', 'disabled', 'title', 'titleEn', 'subtitle', 'subtitleEn', 'description', 'descriptionEn',
  'name', 'nameEn', 'url', 'urls', 'path', 'href', 'text', 'textEn', 'label', 'labelEn', 'value', 'values',
  'icon', 'order', 'items', 'item', 'count', 'size', 'width', 'height', 'color', 'colors', 'type', 'mode',
  'class', 'classes', 'html', 'htmlEn', 'css', 'content', 'date', 'lang', 'slug', 'tags', 'categories',
  'email', 'author', 'keywords', 'meta', 'index', 'id', 'key', 'keys', 'list', 'map', 'data', 'node',
  'format', 'target', 'style', 'styles', 'theme', 'preset', 'version', 'status', 'level', 'levels'
]);

function collectLeaves(obj, prefix, out) {
  if (obj === null || typeof obj !== 'object') {
    if (prefix) out.push(prefix);
    return;
  }
  if (Array.isArray(obj)) return;
  for (const key of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + key : key;
    const v = obj[key];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) collectLeaves(v, p, out);
    else out.push(p);
  }
}

function readJson5(file) {
  let raw = fs.readFileSync(file, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return json5.parse(raw);
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(js|mjs|ejs|json5?|toml)$/i.test(entry.name) && !EXCLUDE_FILES.has(entry.name) && !entry.name.endsWith('.test.js')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function loadAllowlist() {
  const file = path.join(ROOT, 'scripts', 'config-refs-allowlist.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    // 审查 R-33：段落前缀通配（prefixes）已废弃——它让整段配置脱离审查；
    // 现在必须逐键登记，且每条都要写明理由（消费路径或「零消费候选」）。
    if (Array.isArray(parsed.prefixes) && parsed.prefixes.length) {
      console.error('[verify:config-refs] 允许名单仍含段落前缀通配 prefixes（' + parsed.prefixes.join(', ') +
        '）：审查 R-33 起必须逐键登记理由。');
      process.exit(1);
    }
    const allow = new Map();
    for (const [key, reason] of Object.entries(parsed.allow || {})) {
      if (typeof reason !== 'string' || reason.trim().length < 8) {
        console.error('[verify:config-refs] 允许名单条目缺少理由：' + key + '（值必须是非空理由字符串）');
        process.exit(1);
      }
      allow.set(key, reason.trim());
    }
    return allow;
  } catch (e) {
    console.error('[verify:config-refs] 无法读取允许名单 scripts/config-refs-allowlist.json: ' + e.message);
    process.exit(1);
  }
}

function isAllowed(leaf, allow) {
  return allow.has(leaf);
}

function main() {
  const leaves = [];
  for (const file of CONFIG_FILES) {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    const section = path.basename(file, '.json5');
    collectLeaves(readJson5(abs), section, leaves);
  }
  const sources = [];
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir), sources);
  const allow = loadAllowlist();

  // 审查 R-33：逐键登记的代价是必须保真——登记了不存在的键、或键已被接线（登记冗余）
  // 都属于名单腐化，直接失败，避免「名单只增不减」再次变成实质豁免。
  const leafSet = new Set(leaves);
  const stale = [];
  const redundant = [];
  const reported = [];
  for (const key of allow.keys()) {
    if (!leafSet.has(key)) stale.push(key + '（配置中不存在）');
  }
  for (const leaf of leaves) {
    const key = leaf.split('.').pop();
    if (!key || GENERIC_KEYS.has(key) || key.length < 4) continue;
    const re = new RegExp('(?<![A-Za-z0-9_$-])' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_$-])');
    let found = false;
    for (const src of sources) {
      if (re.test(fs.readFileSync(src, 'utf-8'))) { found = true; break; }
    }
    if (allow.has(leaf)) {
      if (found) redundant.push(leaf + '（源码已出现标识符引用）');
      continue;
    }
    if (!found) reported.push(leaf);
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ scanned: leaves.length, unreferenced: reported, stale, redundant }, null, 2));
  } else {
    console.log('[verify:config-refs] 扫描 ' + leaves.length + ' 个叶子键（' + sources.length + ' 个源码文件；通用短键名已排除；允许名单 ' + allow.size + ' 条逐键登记）');
    if (stale.length) {
      console.error('[verify:config-refs] 允许名单含配置中不存在的键：');
      for (const item of stale) console.error('  - ' + item);
    }
    if (redundant.length) {
      console.error('[verify:config-refs] 冗余登记（源码已引用该键名，请从允许名单删除）：');
      for (const item of redundant) console.error('  - ' + item);
    }
    if (reported.length) {
      console.error('[verify:config-refs] 发现 ' + reported.length + ' 个零引用键：');
      for (const leaf of reported) console.error('  - ' + leaf);
      console.error('[verify:config-refs] FAIL：请接线、删除，或在 scripts/config-refs-allowlist.json 中逐键登记理由。');
    }
    if (stale.length || redundant.length || reported.length) process.exit(1);
    console.log('[verify:config-refs] PASS：零未接线键，允许名单逐键登记且无冗余');
  }
}

// 纯函数导出：供属性测试与其它脚本复用；CLI 直跑时才执行 main()，
// 被 require 时不产生扫描副作用。
if (require.main === module) main();

module.exports = { collectLeaves, isAllowed, GENERIC_KEYS, main };

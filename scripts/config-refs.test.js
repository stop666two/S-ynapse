'use strict';

// verify:config-refs 自检（审查 R-33）：允许名单必须逐键登记理由，段落前缀通配已废弃。
// 旧实现支持 prefixes（整段配置脱离审查），这里把「只认精确键路径 + 理由非空 + 无冗余」
// 固化成不变式；真实仓库的完整扫描由 npm run verify:config-refs 执行（CI 门禁）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const json5 = require('json5');
const { isAllowed, collectLeaves } = require('./check-config-refs.js');

const ROOT = path.resolve(__dirname, '..');
const ALLOW_FILE = path.join(ROOT, 'scripts', 'config-refs-allowlist.json');
const CONFIG_FILES = [
  'features', 'site', 'theme', 'navigation', 'sidebar', 'footer', 'security', 'tuning',
  'guard', 'ui-strings', 'tag-aliases', 'friends', 'content-policy', 'compression', 'internals'
];

function loadAllowlist() {
  return JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf-8'));
}

function configLeaves() {
  const leaves = [];
  for (const file of CONFIG_FILES) {
    const abs = path.join(ROOT, file + '.json5');
    if (!fs.existsSync(abs)) continue;
    collectLeaves(json5.parse(fs.readFileSync(abs, 'utf-8').replace(/^\uFEFF/, '')), file, leaves);
  }
  return new Set(leaves);
}

test('允许名单：无段落前缀通配（审查 R-33）', () => {
  const parsed = loadAllowlist();
  assert.strictEqual(parsed.prefixes, undefined, 'prefixes 整段豁免已废弃，必须逐键登记');
  assert.ok(parsed.allow && typeof parsed.allow === 'object', '缺少 allow 映射');
  assert.ok(Object.keys(parsed.allow).length > 0, 'allow 不应为空');
});

test('允许名单：每条理由非空且指向现存配置键', () => {
  const parsed = loadAllowlist();
  const leaves = configLeaves();
  for (const [key, reason] of Object.entries(parsed.allow)) {
    assert.strictEqual(typeof reason, 'string', '条目缺少理由字符串：' + key);
    assert.ok(reason.trim().length >= 8, '理由过短：' + key);
    assert.ok(leaves.has(key), '登记了配置中不存在的键：' + key);
  }
});

test('isAllowed：只认精确键路径，前缀通配不再匹配子键', () => {
  const allow = new Map([['tuning.typography.bodySize', '构建期生成 CSS 变量']]);
  assert.strictEqual(isAllowed('tuning.typography.bodySize', allow), true);
  // 旧实现 allow.prefixes 含 'tuning' 时下面两条都会返回 true（整段豁免）
  assert.strictEqual(isAllowed('tuning.typography.h1Size', allow), false);
  assert.strictEqual(isAllowed('tuning', allow), false);
});

test('CLI：退出码 0（零未接线键、名单无冗余）', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'check-config-refs.js')], { encoding: 'utf-8' });
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS：零未接线键/);
  assert.match(result.stdout, /允许名单 \d+ 条逐键登记/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  auditConfigText,
  keysOnLine,
  scanLine,
  BLOCK_POLICY_FILES,
} = require('./lib/config-comment-audit');

function audit(lines, options) {
  return auditConfigText(lines.join('\n'), options);
}

test('合规最小配置：文件头 + 键注释 + 嵌套注释 → 0 违规', () => {
  const { violations } = audit([
    '// 文件用途说明第一行',
    '// 文件用途说明第二行',
    '{',
    '  // 总开关',
    '  enabled: true,',
    '  // 子分组',
    '  section: {',
    '    // 字段说明',
    '    key: 1,',
    '    // 字段说明',
    '    other: 2,',
    '  },',
    '}',
  ]);
  assert.deepStrictEqual(violations, []);
});

test('缺文件头块注释 → 报 (file-header)', () => {
  const { violations } = audit([
    '{',
    '  // 单行注释不构成块',
    '  enabled: true,',
    '}',
  ]);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].key, '(file-header)');
  assert.strictEqual(violations[0].line, 3);
});

test('顶层键无注释 → 报 no-comment', () => {
  const { violations } = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  enabled: true,',
    '}',
  ]);
  assert.deepStrictEqual(violations, [{ line: 4, key: 'enabled', reason: 'no-comment' }]);
});

test('嵌套键无注释且未被同缩进分组覆盖 → 报 no-comment', () => {
  const { violations } = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  // 分组',
    '  section: {',
    '    key: 1,',
    '  },',
    '}',
  ]);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].key, 'key');
});

test('同行行尾注释覆盖该行全部键（含同一行内联键）', () => {
  const { violations } = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  // 内联组',
    '  pair: { a: 1, b: 2 }, // 行尾注释',
    '}',
  ]);
  assert.deepStrictEqual(violations, []);
});

test('同缩进分组注释可覆盖多个兄弟键（允许跨空白行）', () => {
  const { violations } = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  // 分组注释',
    '  a: 1,',
    '',
    '  b: 2,',
    '  c: 3,',
    '}',
  ]);
  assert.deepStrictEqual(violations, []);
});

test('不同缩进的键打断分组覆盖', () => {
  const { violations } = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  // 分组注释',
    '  a: {',
    '    x: 1,',
    '  },',
    '  b: 2,',
    '}',
  ]);
  const keys = violations.map((v) => v.key);
  assert.ok(keys.includes('b'));
  assert.ok(keys.includes('x'));
});

test('字符串中的 // 不构成行尾注释', () => {
  const { violations } = audit([
    '// 头部一',
    '// 头部二',
    '{',
    "  url: 'https://example.com',",
    '}',
  ]);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].key, 'url');
  const { trailing } = keysOnLine("  url: 'https://example.com', // 说明");
  assert.strictEqual(trailing, true);
  const no = keysOnLine("  url: 'https://example.com',");
  assert.strictEqual(no.trailing, false);
});

test('引号键名同样参与检查', () => {
  const { violations } = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  "enabled": true,',
    '}',
  ]);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].key, 'enabled');
});

test('数组元素键按数据行跳过，数组宿主键仍受检查', () => {
  const ok = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  // 列表说明（含元素字段说明）',
    '  items: [',
    '    { name: 1, url: 2 },',
    '  ],',
    '}',
  ]);
  assert.deepStrictEqual(ok.violations, []);
  const bad = audit([
    '// 头部一',
    '// 头部二',
    '{',
    '  items: [',
    '    { name: 1 },',
    '  ],',
    '}',
  ]);
  assert.strictEqual(bad.violations.length, 1);
  assert.strictEqual(bad.violations[0].key, 'items');
});

test('区块策略：仅检查根级键，模块内部键由模块注释承担', () => {
  const lines = [
    '// 头部一',
    '// 头部二',
    '{',
    '  // 模块一',
    '  mod: {',
    '    a: 1,',
    '    b: 2,',
    '  },',
    '  mod2: { c: 3 },',
    '}',
  ];
  const full = audit(lines);
  assert.strictEqual(full.violations.length, 3);
  const block = audit(lines, { blockPolicy: true });
  assert.deepStrictEqual(block.violations, [{ line: 9, key: 'mod2', reason: 'no-comment' }]);
});

test('scanLine：引号定界符不计入字符串内容，转义引号不结束字符串', () => {
  const s = scanLine("  key: 'a\\'b' // c");
  assert.strictEqual(s.commentAt, 14);
  assert.strictEqual(s.inString[8], true);
  assert.strictEqual(s.inString[7], false);
});

test('真实 14 个配置文件全部零违规', () => {
  const root = path.resolve(__dirname, '..');
  const files = [
    'compression.json5', 'content-policy.json5', 'features.json5', 'footer.json5',
    'friends.json5', 'guard.json5', 'navigation.json5', 'security.json5', 'sidebar.json5',
    'site.json5', 'tag-aliases.json5', 'theme.json5', 'tuning.json5', 'ui-strings.json5',
  ];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(root, file), 'utf-8').replace(/^\uFEFF/, '');
    const { violations } = auditConfigText(raw, { blockPolicy: BLOCK_POLICY_FILES.includes(file) });
    assert.deepStrictEqual(violations, [], `${file} 存在未注释键：` + JSON.stringify(violations));
  }
});

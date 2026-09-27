'use strict';
// 主题调色板单测：
//   1. 纯函数（js/domains/features/theme-lab-core.js）：token 白名单校验、颜色校验、
//      覆盖合并/净化、JSON5 片段序列化、导出名净化；并与 scripts/lib/feature-wiring.js
//      的 themeLabConfig 同值对拍（浏览器端就地实现与构建期 canonical 语义一致）；
//   2. 配置契约：features-schema 与 features.json5 的 themeLab 同步、默认 token 均可在
//      theme.json5 与 site-css.ejs 找到对应变量；
//   3. 构建/运行时接线：模板页签、首屏早置脚本（颜色正则与纯函数逐字一致）、
//      deferred 注册、样式与 i18n 键（防键与实现脱节）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const CORE_PATH = path.join(ROOT, 'js', 'domains', 'features', 'theme-lab-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}

const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { themeLabConfig } = require('./lib/feature-wiring.js');

test('resolveTokenIds：默认 12 项；未知项剔除、去重保序；不足 8 项回退默认', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.resolveTokenIds(undefined), c.DEFAULT_TOKEN_IDS);
  assert.deepStrictEqual(c.resolveTokenIds([]), c.DEFAULT_TOKEN_IDS, '空数组回退默认');
  assert.deepStrictEqual(c.resolveTokenIds(['--nope', '--color-p']), c.DEFAULT_TOKEN_IDS, '过滤后不足 8 项回退');
  const eight = c.DEFAULT_TOKEN_IDS.slice(0, 8);
  assert.deepStrictEqual(c.resolveTokenIds(eight), eight, '恰好 8 项保留');
  assert.deepStrictEqual(
    c.resolveTokenIds(['--color-t', '--color-t', 42, '--color-s']),
    c.DEFAULT_TOKEN_IDS,
    '重复项去重后不足 8 项仍回退'
  );
  const custom = c.resolveTokenIds(['--color-s', '--color-p', '--color-a', '--color-bg', '--color-surface', '--color-t', '--color-ts', '--color-tl', '--color-border', '--color-hover']);
  assert.deepStrictEqual(custom, ['--color-s', '--color-p', '--color-a', '--color-bg', '--color-surface', '--color-t', '--color-ts', '--color-tl', '--color-border', '--color-hover'], '保持声明顺序且封顶 12');
  assert.ok(custom.length <= c.MAX_TOKENS);
});

test('颜色校验：接受 3/4/6/8 位 #hex（小写归一），拒绝关键字/rgb()/非法长度', async () => {
  const c = await loadCore();
  for (const ok of ['#abc', '#ABCD', '#aabbcc', '#aabbccdd', ' #AABBCC ']) {
    assert.strictEqual(c.isValidColor(ok), true, ok + ' 应合法');
  }
  assert.strictEqual(c.normalizeColor('#AABBCC'), '#aabbcc');
  assert.strictEqual(c.normalizeColor('#AbCd'), '#abcd');
  for (const bad of ['red', 'rgb(1,2,3)', 'rgba(0,0,0,.1)', '#12', '#12345', '#1234567', '#gggggg', '', null, 42, {}]) {
    assert.strictEqual(c.isValidColor(bad), false, String(bad) + ' 应非法');
    assert.strictEqual(c.normalizeColor(bad), '');
  }
});

test('mergeOverrides：patch 覆盖合法值、null/空串删除、非法值拒绝；sanitize 净化未知键', async () => {
  const c = await loadCore();
  const ids = ['--color-p', '--color-s', '--color-t'];
  assert.deepStrictEqual(c.mergeOverrides({}, {}, ids), {});
  const merged = c.mergeOverrides({ '--color-p': '#111111' }, { '--color-p': '#222222', '--color-s': '#ABC' }, ids);
  assert.deepStrictEqual(merged, { '--color-p': '#222222', '--color-s': '#abc' });
  const deleted = c.mergeOverrides(merged, { '--color-p': null, '--color-s': '' }, ids);
  assert.deepStrictEqual(deleted, {});
  const rejected = c.mergeOverrides({}, { '--color-p': 'red', '--color-s': '#12345', '--evil': '#000000' }, ids);
  assert.deepStrictEqual(rejected, {}, '非法/未知键不得写入');
  const sanitized = c.sanitizeOverrides(
    { light: { '--color-p': '#111111', '--color-z': '#222222', '--color-s': 'red' }, dark: 'oops' },
    ids
  );
  assert.deepStrictEqual(sanitized, { light: { '--color-p': '#111111' }, dark: {} });
  assert.deepStrictEqual(c.sanitizeOverrides(null, ids), { light: {}, dark: {} });
});

test('safeExportName：剔除路径分隔符/保留字符，空结果回退默认名', async () => {
  const c = await loadCore();
  assert.strictEqual(c.safeExportName(undefined), c.DEFAULT_EXPORT_NAME);
  assert.strictEqual(c.safeExportName(''), c.DEFAULT_EXPORT_NAME);
  assert.strictEqual(c.safeExportName('  '), c.DEFAULT_EXPORT_NAME);
  assert.strictEqual(c.safeExportName('../a/b:c?d*.json5'), '..abcd.json5', '剔除路径分隔符与保留字符');
  assert.strictEqual(c.safeExportName('a\\b'), 'ab');
  assert.strictEqual(c.safeExportName('theme.json5'), 'theme.json5');
});

test('serializeThemeLabExport：输出为合法 JSON5、结构/顺序/注释正确、非法值不进入', async () => {
  const c = await loadCore();
  const ids = ['--color-p', '--color-s', '--color-bg'];
  const text = c.serializeThemeLabExport(
    { light: { '--color-s': '#2563EB', '--color-p': '#111111', '--color-x': '#222222' }, dark: { '--color-bg': 'red' } },
    ids
  );
  const parsed = json5.parse(text);
  assert.deepStrictEqual(parsed, {
    presetOverrides: {
      colors: { primary: '#111111', secondary: '#2563eb' },
      darkMode: { colors: {} }
    }
  }, '未知键剔除、小写归一、非法值拒绝、暗色空对象');
  assert.ok(text.startsWith('// ='), '含注释头');
  assert.ok(text.includes('// 主色（--color-p）'), '逐项中文注释');
  assert.ok(text.indexOf('primary') < text.indexOf('secondary'), '按白名单顺序序列化');
  const empty = json5.parse(c.serializeThemeLabExport({}, ids));
  assert.deepStrictEqual(empty, { presetOverrides: { colors: {}, darkMode: { colors: {} } } });
  assert.ok(text.includes('// 覆盖：明亮模式 2 项；暗色模式 0 项'), '注释头声明逐模式覆盖计数');
  const again = c.serializeThemeLabExport(
    { light: { '--color-p': '#111111', '--color-s': '#2563eb' }, dark: {} },
    ids
  );
  assert.strictEqual(again, text, '同状态输出逐字确定（与输入键顺序无关）');
});

test('resolveThemeLabConfig：默认/覆盖；与 themeLabConfig 同值对拍', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.resolveThemeLabConfig({}), {
    enabled: true,
    storageKey: 'ss-theme-lab',
    tokens: c.DEFAULT_TOKEN_IDS,
    exportName: 'theme-overrides.json5'
  });
  assert.deepStrictEqual(c.resolveThemeLabConfig(null), c.resolveThemeLabConfig({}));
  const cases = [
    {},
    null,
    { enabled: false },
    { storageKey: '' },
    { storageKey: '  custom-key  ' },
    { exportName: '../../evil.json5' },
    { tokens: ['--color-t', '--color-t'] },
    { tokens: ['--color-p', '--color-s', '--color-a', '--color-bg'] },
    { tokens: 'oops' },
    { tokens: c.DEFAULT_TOKEN_IDS.concat(['--color-x']) }
  ];
  for (const raw of cases) {
    assert.deepStrictEqual(themeLabConfig({ themeLab: raw || undefined }), c.resolveThemeLabConfig(raw), '对拍失败: ' + JSON.stringify(raw));
  }
});

test('配置契约：features.json5 ↔ DEFAULT_FEATURES.themeLab 同步；默认 token 均有消费点', async () => {
  const c = await loadCore();
  const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
  assert.deepStrictEqual(features.themeLab, DEFAULT_FEATURES.themeLab, 'features.json5 与 schema 默认值必须一致');
  assert.strictEqual(features.themeLab.enabled, true);
  assert.ok(features.themeLab.tokens.length >= c.MIN_TOKENS && features.themeLab.tokens.length <= c.MAX_TOKENS, 'tokens 8–12 项');
  assert.deepStrictEqual(features.themeLab.tokens, c.DEFAULT_TOKEN_IDS, '默认白名单与纯函数规格一致');

  const theme = json5.parse(fs.readFileSync(path.join(ROOT, 'theme.json5'), 'utf-8'));
  const css = fs.readFileSync(path.join(ROOT, 'templates', 'site-css.ejs'), 'utf-8');
  for (const spec of c.TOKEN_SPECS) {
    assert.ok(Object.prototype.hasOwnProperty.call(theme.colors, spec.key), 'theme.json5 colors 缺少 ' + spec.key);
    assert.ok(css.includes(spec.id), 'site-css.ejs 缺少变量 ' + spec.id);
  }
});

test('首屏早置脚本：包含配置键、token 注入与 COLOR_PATTERN 逐字一致的校验', async () => {
  const c = await loadCore();
  const layout = fs.readFileSync(path.join(ROOT, 'templates', 'layout.ejs'), 'utf-8');
  assert.ok(layout.includes('features.themeLab.storageKey'), '早置脚本读取 storageKey');
  assert.ok(layout.includes('features.themeLab.tokens'), '早置脚本注入 tokens 白名单');
  assert.ok(layout.includes('setProperty'), '早置脚本写 CSS 变量');
  assert.ok(layout.includes(c.COLOR_PATTERN), '颜色校验正则与纯函数逐字一致（防漂移）');
});

test('接线：面板页签/运行时模块/样式/i18n/deferred 注册均在位', () => {
  const post = fs.readFileSync(path.join(ROOT, 'templates', 'post.ejs'), 'utf-8');
  assert.ok(post.includes('id="rtabRead"') && post.includes('id="rtabTheme"'), '页签按钮');
  assert.ok(post.includes('role="tablist"') && post.includes('role="tabpanel"'), 'ARIA 角色');
  assert.ok(post.includes('id="themeLabBody"') && post.includes('id="themeLabStatus"'), '运行时容器');
  const panel = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'reading-panel.js'), 'utf-8');
  assert.ok(panel.includes('__SOFTNAV_HOOKS__') && panel.includes('selectTab'), '页签键盘/软导航重绑');
  const runtime = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'theme-lab.js'), 'utf-8');
  assert.ok(runtime.includes('setProperty') && runtime.includes('serializeThemeLabExport'), '实时预览与导出');
  const main = fs.readFileSync(path.join(ROOT, 'js', 'core', 'main.js'), 'utf-8');
  const deferred = fs.readFileSync(path.join(ROOT, 'js', 'core', 'deferred.js'), 'utf-8');
  assert.ok(main.includes("dyn('theme-lab'"), 'idle 队列注册');
  assert.ok(deferred.includes("'theme-lab': themeLabInit"), 'deferred registry 注册');
  const css = fs.readFileSync(path.join(ROOT, 'templates', 'site-css.ejs'), 'utf-8');
  assert.ok(css.includes('.reader-tab') && css.includes('.theme-lab-row'), '面板样式');
  const ui = json5.parse(fs.readFileSync(path.join(ROOT, 'ui-strings.json5'), 'utf-8'));
  for (const key of ['tabRead', 'tabTheme', 'themeLabPreset', 'themeLabSave', 'themeLabResetAll', 'themeLabCopy', 'themeLabDownload']) {
    assert.ok(ui.post[key], 'ui-strings.post.' + key + ' 缺失');
    assert.ok(ui.en.post[key], 'ui-strings.en.post.' + key + ' 缺失');
    assert.notStrictEqual(ui.post[key], ui.en.post[key], key + ' 中英不得相同');
  }
  const docs = fs.readFileSync(path.join(ROOT, 'docs', 'config-reference.md'), 'utf-8');
  assert.ok(docs.includes('### 3.101 themeLab'), 'config-reference 小节');
});

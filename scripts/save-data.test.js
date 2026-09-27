'use strict';
// 省流模式单测：
//   1. 纯函数（js/domains/core/save-data-core.js）：配置归一化、手动偏好解析/序列化、
//      自动/手动决策矩阵、图片变体宽度推断与最小候选选择；并与 scripts/lib/feature-wiring.js
//      的 saveDataModeConfig 同值对拍（浏览器端与构建期 canonical 语义一致）；
//   2. 配置契约：features-schema 与 features.json5 的 saveDataMode 同步、默认值形态；
//   3. 构建/运行时接线：首屏早置脚本（存储键/决策分支/类名）、CSS 降级块（动画停用与
//      系统字体栈与纯函数常量逐字一致）、面板开关、critical 注册、图片/粒子/过渡/平滑滚动消费点、
//      i18n 键与 config-reference 小节（防键与实现脱节）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const CORE_PATH = path.join(ROOT, 'js', 'domains', 'core', 'save-data-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}

const { DEFAULT_FEATURES, FEATURE_MODULES } = require('./lib/features-schema.js');
const { saveDataModeConfig } = require('./lib/feature-wiring.js');

test('resolveSaveDataConfig：默认/覆盖/storageKey 回退/degrade 显式 false', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.resolveSaveDataConfig({}), {
    enabled: true,
    auto: true,
    manual: true,
    storageKey: 'ss-save-data',
    degrade: {
      animations: true, particles: true, lowResImages: true, lazyAggressive: true, systemFontsOnly: true
    }
  });
  assert.deepStrictEqual(c.resolveSaveDataConfig(null), c.resolveSaveDataConfig({}));
  assert.strictEqual(c.resolveSaveDataConfig({ storageKey: '  my-key  ' }).storageKey, 'my-key');
  assert.strictEqual(c.resolveSaveDataConfig({ storageKey: '' }).storageKey, 'ss-save-data');
  assert.strictEqual(c.resolveSaveDataConfig({ storageKey: 42 }).storageKey, '42');
  assert.strictEqual(c.resolveSaveDataConfig({ enabled: false }).enabled, false);
  const off = c.resolveSaveDataConfig({ degrade: { animations: false, particles: false, lowResImages: false, lazyAggressive: false, systemFontsOnly: false } });
  assert.deepStrictEqual(off.degrade, { animations: false, particles: false, lowResImages: false, lazyAggressive: false, systemFontsOnly: false }, '唯一关闭方式为显式 false');
  assert.strictEqual(c.resolveSaveDataConfig({ degrade: 'oops' }).degrade.animations, true, 'degrade 非对象回退默认全开');
});

test('resolveSaveDataConfig 与 saveDataModeConfig 同值对拍（防两端语义漂移）', async () => {
  const c = await loadCore();
  const cases = [
    {}, null, undefined,
    { enabled: false },
    { auto: false },
    { manual: false },
    { storageKey: '' },
    { storageKey: '  x  ' },
    { degrade: { animations: false } },
    { degrade: { particles: false, systemFontsOnly: false } },
    { degrade: null },
    { enabled: false, auto: false, manual: false, storageKey: 'k', degrade: { lazyAggressive: false } }
  ];
  for (const raw of cases) {
    assert.deepStrictEqual(
      saveDataModeConfig({ saveDataMode: raw || undefined }),
      c.resolveSaveDataConfig(raw),
      '对拍失败: ' + JSON.stringify(raw)
    );
  }
});

test('手动偏好解析/序列化：1/0 与非规范形态；无法识别回退 null', async () => {
  const c = await loadCore();
  assert.strictEqual(c.parseManualPreference('1'), true);
  assert.strictEqual(c.parseManualPreference('0'), false);
  assert.strictEqual(c.parseManualPreference(true), true);
  assert.strictEqual(c.parseManualPreference(false), false);
  assert.strictEqual(c.parseManualPreference('on'), true);
  assert.strictEqual(c.parseManualPreference('off'), false);
  for (const bad of [null, undefined, '', 'yes', '00', 0, 1, {}, 'TRUE']) {
    assert.strictEqual(c.parseManualPreference(bad), null, String(bad) + ' 应回退 null');
  }
  assert.strictEqual(c.serializeManualPreference(true), c.PREF_ON);
  assert.strictEqual(c.serializeManualPreference(false), c.PREF_OFF);
});

test('decideSaveData 决策矩阵：自动/手动/显式关闭/禁用', async () => {
  const c = await loadCore();
  const base = c.resolveSaveDataConfig({});
  // 禁用：任何输入都不激活
  assert.deepStrictEqual(c.decideSaveData(c.resolveSaveDataConfig({ enabled: false }), true, '1'), { active: false, source: 'disabled' });
  // 自动
  assert.deepStrictEqual(c.decideSaveData(base, true, null), { active: true, source: 'auto' });
  assert.deepStrictEqual(c.decideSaveData(base, false, null), { active: false, source: 'default' });
  // 手动开：无系统省流也激活
  assert.deepStrictEqual(c.decideSaveData(base, false, '1'), { active: true, source: 'manual' });
  // 手动关：显式选择覆盖自动
  assert.deepStrictEqual(c.decideSaveData(base, true, '0'), { active: false, source: 'manual' });
  // manual=false：忽略存储偏好，回退自动路径
  const noManual = c.resolveSaveDataConfig({ manual: false });
  assert.deepStrictEqual(c.decideSaveData(noManual, true, '1'), { active: true, source: 'auto' });
  assert.deepStrictEqual(c.decideSaveData(noManual, false, '1'), { active: false, source: 'default' });
  // auto=false：系统偏好不触发，手动仍可用
  const noAuto = c.resolveSaveDataConfig({ auto: false });
  assert.deepStrictEqual(c.decideSaveData(noAuto, true, null), { active: false, source: 'default' });
  assert.deepStrictEqual(c.decideSaveData(noAuto, true, '1'), { active: true, source: 'manual' });
  // 损坏偏好：按未选择处理
  assert.deepStrictEqual(c.decideSaveData(base, true, 'garbage'), { active: true, source: 'auto' });
});

test('inferVariantWidth：宽度令牌与 cache-bust 哈希形态；原图/外链回退 null', async () => {
  const c = await loadCore();
  assert.strictEqual(c.inferVariantWidth('/media/test-photo-1-640.jpg'), 640);
  assert.strictEqual(c.inferVariantWidth('/media/test-photo-1-1024.53b36a7a57.jpg'), 1024);
  assert.strictEqual(c.inferVariantWidth('/media/a-1920.abcdef1234.webp'), 1920);
  assert.strictEqual(c.inferVariantWidth('/media/a-320.0123456789.avif'), 320);
  assert.strictEqual(c.inferVariantWidth('/media/test-photo-1.e6d80b0b99.jpg'), null, '原图（名字含 -1 但无宽度令牌）');
  assert.strictEqual(c.inferVariantWidth('/media/test-photo-12.e6d80b0b99.jpg'), 12, '≥2 位数字视为宽度令牌（启发式口径）');
  assert.strictEqual(c.inferVariantWidth('https://cdn.example.com/pic.png'), null);
  assert.strictEqual(c.inferVariantWidth(''), null);
  assert.strictEqual(c.inferVariantWidth(null), null);
});

test('parseSrcset：w 描述符/裸 URL/2x；忽略空段', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.parseSrcset('/a-640.jpg 640w, /a-1024.jpg 1024w'), [
    { url: '/a-640.jpg', width: 640 },
    { url: '/a-1024.jpg', width: 1024 }
  ]);
  assert.deepStrictEqual(c.parseSrcset('/a.jpg'), [{ url: '/a.jpg', width: null }]);
  assert.deepStrictEqual(c.parseSrcset('/a.jpg 2x'), [{ url: '/a.jpg', width: null }]);
  assert.deepStrictEqual(c.parseSrcset('  ,  /a.jpg  , '), [{ url: '/a.jpg', width: null }]);
  assert.deepStrictEqual(c.parseSrcset(''), []);
  assert.deepStrictEqual(c.parseSrcset(null), []);
});

test('pickSmallestVariant/smallestSrcsetUrl/smallestImageUrl：最小分辨率选择', async () => {
  const c = await loadCore();
  // 令牌推断：选最小
  assert.strictEqual(c.pickSmallestVariant(['/a-1024.jpg', '/a-640.jpg', '/a-1920.jpg']), '/a-640.jpg');
  // 描述符优先于令牌
  assert.strictEqual(
    c.pickSmallestVariant([{ url: '/a-640.jpg', width: 1024 }, { url: '/a-1920.jpg', width: 480 }]),
    '/a-1920.jpg'
  );
  // 无令牌候选按已知原图宽度，可选中有令牌的小变体
  assert.strictEqual(c.pickSmallestVariant(['/a-640.jpg', '/a.jpg'], 1600), '/a-640.jpg');
  // 全部无令牌且无原图宽度：保持首个
  assert.strictEqual(c.pickSmallestVariant(['/a.jpg', '/b.jpg']), '/a.jpg');
  // 空集
  assert.strictEqual(c.pickSmallestVariant([], 100), '');
  assert.strictEqual(c.pickSmallestVariant(null, 100), '');
  // srcset 集成
  assert.strictEqual(c.smallestSrcsetUrl('/a-1024.jpg 1024w, /a-640.jpg 640w, /a-1920.jpg 1920w', 1920), '/a-640.jpg');
  assert.strictEqual(c.smallestSrcsetUrl('/a-1024.jpg, /a-640.jpg', 0), '/a-640.jpg');
  assert.strictEqual(c.smallestSrcsetUrl('', 0), '');
  // 单图：无 srcset 保持原 src
  assert.strictEqual(c.smallestImageUrl('/orig.jpg', '', 1600), '/orig.jpg');
  assert.strictEqual(c.smallestImageUrl('/orig.jpg', '/orig-640.jpg 640w, /orig.jpg 1600w', 1600), '/orig-640.jpg');
  assert.strictEqual(c.smallestImageUrl('/orig.jpg', '   ', 0), '/orig.jpg', '空白 srcset 保持原值');
  assert.strictEqual(c.smallestImageUrl('/orig.jpg', '/only.jpg', 0), '/only.jpg', '单 URL srcset 是合法候选（无宽度信息时取该值）');
});

test('系统字体栈常量：非空且不含网页字体名', async () => {
  const c = await loadCore();
  assert.ok(c.SYSTEM_FONT_STACK.includes('-apple-system') && c.SYSTEM_FONT_STACK.includes('sans-serif'));
  assert.ok(c.SYSTEM_MONO_STACK.includes('monospace'));
  assert.ok(!/Inter|Fira|Manrope|Sora/.test(c.SYSTEM_FONT_STACK + c.SYSTEM_MONO_STACK), '不得保留网页字体');
});

test('配置契约：features.json5 ↔ DEFAULT_FEATURES.saveDataMode 同步；模块注册', async () => {
  const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
  assert.deepStrictEqual(features.saveDataMode, DEFAULT_FEATURES.saveDataMode, 'features.json5 与 schema 默认值必须一致');
  assert.strictEqual(features.saveDataMode.enabled, true);
  assert.strictEqual(features.saveDataMode.auto, true);
  assert.strictEqual(features.saveDataMode.manual, true);
  assert.strictEqual(features.saveDataMode.storageKey, 'ss-save-data');
  assert.deepStrictEqual(features.saveDataMode.degrade, {
    animations: true, particles: true, lowResImages: true, lazyAggressive: true, systemFontsOnly: true
  });
  assert.ok(FEATURE_MODULES.includes('saveDataMode'), 'schema 模块清单包含 saveDataMode');
});

test('首屏早置脚本：存储键/自动/手动分支/类名与纯函数决策同语义', async () => {
  const c = await loadCore();
  const layout = fs.readFileSync(path.join(ROOT, 'templates', 'layout.ejs'), 'utf-8');
  assert.ok(layout.includes('features.saveDataMode.storageKey'), '早置脚本读取 storageKey');
  assert.ok(layout.includes("classList.add('save-data')"), '早置脚本同步置类');
  assert.ok(layout.includes("r==='1'"), '手动开分支');
  assert.ok(layout.includes("r==='0'"), '手动关分支');
  assert.ok(layout.includes('navigator.connection&&navigator.connection.saveData'), '自动跟随系统偏好');
  assert.ok(layout.includes("features.saveDataMode.auto!==false") && layout.includes("features.saveDataMode.manual!==false"), 'auto/manual 门控注入');
  assert.strictEqual(c.DEFAULT_STORAGE_KEY, 'ss-save-data');
});

test('CSS 降级块：动画停用与系统字体栈（与纯函数常量逐字一致；按 degrade 门控）', async () => {
  const c = await loadCore();
  const css = fs.readFileSync(path.join(ROOT, 'templates', 'site-css.ejs'), 'utf-8');
  assert.ok(css.includes('features.saveDataMode'), 'CSS 按配置门控');
  assert.ok(css.includes('html.save-data') && css.includes('animation-duration:1ms'), '动画/过渡停用规则（1ms：低于一帧且保留 animationend 语义）');
  assert.ok(css.includes('html.save-data{scroll-behavior:auto'), '平滑滚动强制 auto');
  assert.ok(css.includes('html.save-data .motion-reveal'), '滚动入场元素强制可见');
  assert.ok(css.includes(c.SYSTEM_FONT_STACK), '系统字体栈与纯函数常量逐字一致（--ff）');
  assert.ok(css.includes(c.SYSTEM_MONO_STACK), '系统等宽栈与纯函数常量逐字一致（--ff-mono）');
  assert.ok(css.includes('_sdDeg.animations!==false') && css.includes('_sdDeg.systemFontsOnly!==false'), '逐项 degrade 门控');
});

test('接线：面板开关/运行时模块/消费点/i18n/文档均在位', () => {
  const post = fs.readFileSync(path.join(ROOT, 'templates', 'post.ejs'), 'utf-8');
  assert.ok(post.includes('id="saveDataToggle"') && post.includes('role="switch"'), '面板开关（role=switch）');
  assert.ok(post.includes('aria-describedby="saveDataHint"') && post.includes('id="saveDataHint"'), '开关说明具备可访问关联');
  const runtime = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'save-data.js'), 'utf-8');
  assert.ok(runtime.includes('__SOFTNAV_HOOKS__'), '软导航重绑');
  assert.ok(runtime.includes('ss:save-data'), '粒子事件派发');
  assert.ok(runtime.includes('__imageLazySaveData'), '图片降级委托');
  const main = fs.readFileSync(path.join(ROOT, 'js', 'core', 'main.js'), 'utf-8');
  assert.ok(main.includes('saveDataInit') && main.includes('() => saveDataInit()'), 'critical 队列注册');
  const images = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'image-lazy.js'), 'utf-8');
  assert.ok(images.includes('smallestImageUrl') && images.includes('__imageLazySaveData') && images.includes('data-sd-src'), '图片最小变体改写/还原');
  const bg = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'background.js'), 'utf-8');
  assert.ok(bg.includes('ss:save-data') && bg.includes('SGD.particles'), '粒子停止/恢复与 degrade 门控');
  const pt = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'page-transition.js'), 'utf-8');
  assert.ok(pt.includes("classList.contains('save-data')"), '页面过渡瞬时化');
  const softNav = fs.readFileSync(path.join(ROOT, 'js', 'core', 'soft-nav.js'), 'utf-8');
  assert.ok(softNav.includes("classList.contains('save-data')"), '视图过渡跳过');
  const runtimeJs = fs.readFileSync(path.join(ROOT, 'js', 'core', 'runtime.js'), 'utf-8');
  assert.ok(runtimeJs.includes("classList.contains('save-data')"), '平滑滚动降级');
  const ui = json5.parse(fs.readFileSync(path.join(ROOT, 'ui-strings.json5'), 'utf-8'));
  for (const key of ['saveData', 'saveDataHint']) {
    assert.ok(ui.post[key], 'ui-strings.post.' + key + ' 缺失');
    assert.ok(ui.en.post[key], 'ui-strings.en.post.' + key + ' 缺失');
    assert.notStrictEqual(ui.post[key], ui.en.post[key], key + ' 中英不得相同');
  }
  const docs = fs.readFileSync(path.join(ROOT, 'docs', 'config-reference.md'), 'utf-8');
  assert.ok(docs.includes('### 3.102 saveDataMode'), 'config-reference 小节');
});

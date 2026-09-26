'use strict';
// --theme-override / --features-override 隔离覆盖单测：深合并语义、与 schema 校验联动、
// 异常路径（缺失/解析错误）与 CLI 参数解析。覆盖不写回仓库配置文件。
// 运行：node --test scripts/theme-override.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const json5 = require('json5');
const deepmerge = require('deepmerge');

const { createConfigModule } = require('./build/config.js');
const { createBuildContext } = require('./build/context.js');

const BASE_CONFIG_FILES = {
  'site.json5': "{ title: 'Fixture', url: 'https://example.com', language: 'zh-CN', postsPerPage: 10 }",
  'theme.json5': "{ preset: null, darkMode: { enabled: true, default: 'system', iconStyle: 'sun-moon', rememberChoice: true } }",
  'navigation.json5': '{ menu: [] }',
  'sidebar.json5': '{ enabled: false, widgets: [] }',
  'footer.json5': '{}',
  'security.json5': '{}'
};

function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-override-'));
  for (const [name, content] of Object.entries(BASE_CONFIG_FILES)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8');
  }
  return dir;
}

function writeJson5(dir, name, content) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

// watchMode=true：abortBuild 抛错（isBuildAbort）而非 process.exit，便于断言异常路径。
function makeConfigModule(rootDir, opts) {
  return createConfigModule({
    rootDir,
    watchMode: true,
    featuresOverridePath: (opts && opts.featuresOverridePath) || '',
    themeOverridePath: (opts && opts.themeOverridePath) || '',
    getJson5: () => json5,
    getDeepmerge: () => deepmerge,
    getVendorFonts: () => ({}),
    buildCspTrimContext: () => ({})
  });
}

function capture(fn) {
  const logs = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  try {
    return { value: fn(), logs: logs.join('\n') };
  } finally {
    Object.assign(console, orig);
  }
}

test('--theme-override：深合并到 theme 且未覆盖键保留，不写回仓库配置', () => {
  const dir = makeRoot();
  try {
    const themePath = path.join(dir, 'theme.json5');
    const before = fs.readFileSync(themePath, 'utf8');
    const override = writeJson5(dir, 'theme-override.json5', "{ darkMode: { iconStyle: 'single' } }");
    const mod = makeConfigModule(dir, { themeOverridePath: override });
    const { value: config } = capture(() => mod.loadConfig());
    assert.strictEqual(config.theme.darkMode.iconStyle, 'single', '覆盖键生效');
    assert.strictEqual(config.theme.darkMode.default, 'system', '未覆盖键保留');
    assert.strictEqual(config.theme.darkMode.rememberChoice, true, '未覆盖键保留');
    assert.strictEqual(config.theme.darkMode.enabled, true, '未覆盖键保留');
    assert.strictEqual(fs.readFileSync(themePath, 'utf8'), before, 'override 不得写回仓库配置文件');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--theme-override 与 --features-override 组合：各自深合并、互不干扰', () => {
  const dir = makeRoot();
  try {
    const themeOverride = writeJson5(dir, 'theme-override.json5', "{ darkMode: { default: 'dark' } }");
    const featuresOverride = writeJson5(dir, 'features-override.json5', "{ share: { order: ['x', 'copy'] }, search: { maxResults: 7 } }");
    const mod = makeConfigModule(dir, { themeOverridePath: themeOverride, featuresOverridePath: featuresOverride });
    const { value: config } = capture(() => mod.loadConfig());
    assert.strictEqual(config.theme.darkMode.default, 'dark', 'theme 覆盖生效');
    assert.strictEqual(config.theme.darkMode.iconStyle, 'sun-moon', 'theme 其余键保留');
    assert.deepStrictEqual(config.features.share.order, ['x', 'copy'], 'features 数组替换语义');
    assert.strictEqual(config.features.search.maxResults, 7, 'features 深合并生效');
    assert.strictEqual(config.features.search.minChars, 1, 'features 未覆盖键保留默认');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--theme-override：非法枚举由 validateConfig 拦截', () => {
  const dir = makeRoot();
  try {
    const override = writeJson5(dir, 'theme-override.json5', "{ darkMode: { iconStyle: 'bogus' } }");
    const mod = makeConfigModule(dir, { themeOverridePath: override });
    const { value: config } = capture(() => mod.loadConfig());
    assert.strictEqual(config.theme.darkMode.iconStyle, 'bogus', '覆盖先写入合并结果');
    const { value: ok, logs } = capture(() => mod.validateConfig(config));
    assert.strictEqual(ok, false, '非法 iconStyle 必须被拦截');
    assert.ok(logs.includes('theme.darkMode.iconStyle'), '错误信息应指向 iconStyle：' + logs);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--theme-override：文件缺失与解析错误中止（watch 模式抛错）', () => {
  const dir = makeRoot();
  try {
    const missing = makeConfigModule(dir, { themeOverridePath: path.join(dir, 'not-exists.json5') });
    assert.throws(() => capture(() => missing.loadConfig()), /--theme-override file not found/);
    const bad = writeJson5(dir, 'theme-bad.json5', "{ darkMode: { iconStyle: 'single' }");
    const broken = makeConfigModule(dir, { themeOverridePath: bad });
    assert.throws(() => capture(() => broken.loadConfig()), /--theme-override parse error/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--theme-override：CLI 参数经 createBuildContext 解析并生效', () => {
  const dir = makeRoot();
  try {
    const override = writeJson5(dir, 'theme-cli.json5', "{ darkMode: { iconStyle: 'single' } }");
    const argv = ['node', 'build.js', '--theme-override', override];
    const ctx = createBuildContext({
      rootDir: dir,
      argv,
      getBuildErrors: () => null,
      getMediaManifest: () => null,
      getAutoCovers: () => null,
      getInlineConfigKb: () => 0,
      setInlineConfigKb: () => {},
      getIncrementalContext: () => null
    });
    const { value: config } = capture(() => ctx.loadConfig());
    assert.strictEqual(config.theme.darkMode.iconStyle, 'single', 'CLI 参数应解析并应用覆盖');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

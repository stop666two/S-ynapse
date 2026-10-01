'use strict';
// 文章导出单测（features.exportArticle）：
//   1. 纯函数 scripts/lib/md-export.js：产物路径组装 / 目录穿越防护 / 开关判定 /
//      源文件按字节原样复制（保留原始 frontmatter）；
//   2. 配置契约：schema（DEFAULT_FEATURES）与 features.json5 键值同步、exportArticleConfig 归一化；
//   3. 构建/运行时接线：post.ejs 按钮与来源脚注、site-css 打印块、deferred/main 注册、
//      ui-strings sourceUrl 双语与静态服务 MIME（防键与消费点脱节）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { exportArticleConfig } = require('./lib/feature-wiring.js');
const { mdExportEnabled, mdExportRelPath, writeArticleMarkdown } = require('./lib/md-export.js');
const { MIME_TYPES } = require('./lib/static-server.js');

test('mdExportRelPath：/md/<lang>/<slug>.md 组装（含中文 slug 原样保留）', () => {
  assert.strictEqual(mdExportRelPath('zh', 'hello-world'), 'md/zh/hello-world.md');
  assert.strictEqual(mdExportRelPath('en', 'site-building-notes'), 'md/en/site-building-notes.md');
  assert.strictEqual(mdExportRelPath('zh', '建站手记'), 'md/zh/建站手记.md');
});

test('mdExportRelPath：路径穿越/非法 lang/空值一律拒绝（返回 null）', () => {
  assert.strictEqual(mdExportRelPath('zh', '../evil'), null);
  assert.strictEqual(mdExportRelPath('zh', 'a/b'), null);
  assert.strictEqual(mdExportRelPath('zh', 'a\\b'), null);
  assert.strictEqual(mdExportRelPath('zh', 'a..b'), null);
  assert.strictEqual(mdExportRelPath('zh', ''), null);
  assert.strictEqual(mdExportRelPath('zh', null), null);
  assert.strictEqual(mdExportRelPath('../zh', 'ok-slug'), null);
  assert.strictEqual(mdExportRelPath('z h', 'ok-slug'), null);
  assert.strictEqual(mdExportRelPath('', 'ok-slug'), null);
  assert.strictEqual(mdExportRelPath('a'.repeat(21), 'ok-slug'), null);
});

test('mdExportEnabled：总开关与 markdown 子开关（缺省开、总开关优先）', () => {
  assert.strictEqual(mdExportEnabled({}), true);
  assert.strictEqual(mdExportEnabled({ exportArticle: { enabled: true, markdown: true } }), true);
  assert.strictEqual(mdExportEnabled({ exportArticle: { markdown: false } }), false);
  assert.strictEqual(mdExportEnabled({ exportArticle: { enabled: false } }), false);
  assert.strictEqual(mdExportEnabled({ exportArticle: { enabled: false, markdown: true } }), false);
});

test('writeArticleMarkdown：源文件按字节原样复制（frontmatter 保留）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-md-export-'));
  try {
    const src = path.join(dir, 'source.md');
    const sourceText = '---\ntitle: 测试文章\nslug: test-post\ntags: [a, b]\n---\n\n# 标题\n\n正文 with **markdown**.\n';
    fs.writeFileSync(src, sourceText, 'utf-8');
    const dist = path.join(dir, 'dist');
    const rel = writeArticleMarkdown({ lang: 'zh', slug: 'test-post', sourceFile: src, distDir: dist });
    assert.strictEqual(rel, 'md/zh/test-post.md');
    const dest = path.join(dist, 'md', 'zh', 'test-post.md');
    assert.ok(fs.existsSync(dest), '产物文件必须存在');
    assert.deepStrictEqual(fs.readFileSync(dest), Buffer.from(sourceText, 'utf-8'), '字节与原文件一致');
    assert.match(fs.readFileSync(dest, 'utf-8'), /^---\ntitle: 测试文章/, 'frontmatter 保留在文件头部');
    assert.strictEqual(writeArticleMarkdown({ lang: 'zh', slug: '../evil', sourceFile: src, distDir: dist }), null, '非法 slug 不写文件');
    assert.ok(!fs.existsSync(path.join(dist, 'md', 'zh', '..', 'evil.md')), '非法路径不落盘');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test('exportArticleConfig：默认值/覆盖/总开关联锁/文案回退链', () => {
  // switch: features.exportArticle.enabled, features.exportArticle.print, features.exportArticle.markdown, features.exportArticle.sourceFootnote
  const dflt = exportArticleConfig({});
  assert.strictEqual(dflt.enabled, true);
  assert.strictEqual(dflt.print, true);
  assert.strictEqual(dflt.markdown, true);
  assert.strictEqual(dflt.sourceFootnote, true);
  assert.strictEqual(dflt.printLabel, '打印 / 另存 PDF');
  assert.strictEqual(dflt.markdownLabel, '复制 Markdown');
  assert.strictEqual(dflt.printLabelEn, '', '未配置 En 文案为空，模板按语言回退中文');
  const off = exportArticleConfig({ exportArticle: { enabled: false } });
  assert.strictEqual(off.print, false);
  assert.strictEqual(off.markdown, false);
  assert.strictEqual(off.sourceFootnote, false, '总开关关闭时来源脚注同步关闭');
  const sub = exportArticleConfig({ exportArticle: { print: false, markdown: false, sourceFootnote: false } });
  assert.strictEqual(sub.enabled, true);
  assert.strictEqual(sub.print, false);
  assert.strictEqual(sub.markdown, false);
  assert.strictEqual(sub.sourceFootnote, false);
  const custom = exportArticleConfig({ exportArticle: { printLabel: '  打印  ', printLabelEn: ' Print ', markdownLabel: '' } });
  assert.strictEqual(custom.printLabel, '打印', 'zh 文案去首尾空白');
  assert.strictEqual(custom.printLabelEn, 'Print');
  assert.strictEqual(custom.markdownLabel, '复制 Markdown', '显式空串回退内置文案');
});

test('配置契约：schema 与 features.json5 的 exportArticle 键值同步', () => {
  const schema = DEFAULT_FEATURES.exportArticle;
  const raw = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8')).exportArticle;
  assert.ok(schema, 'schema 必须含 exportArticle 模块');
  assert.ok(raw, 'features.json5 必须含 exportArticle 模块');
  for (const key of Object.keys(schema)) {
    assert.ok(Object.prototype.hasOwnProperty.call(raw, key), 'features.json5 缺少键 ' + key);
  }
  assert.strictEqual(raw.enabled, true, '默认开启');
  assert.strictEqual(raw.print, true, '打印默认开');
  assert.strictEqual(raw.markdown, true, '复制 Markdown 默认开');
  assert.strictEqual(raw.sourceFootnote, true, '来源脚注默认开');
});

test('构建接线：模板/样式/注册表/ui-strings/MIME 与构建输出消费点', () => {
  const post = fs.readFileSync(path.join(ROOT, 'templates', 'post.ejs'), 'utf-8');
  for (const marker of ['data-export-print', 'data-export-markdown', 'data-md-url', 'post-source-url', 'exportCfg']) {
    assert.ok(post.includes(marker), 'post.ejs 缺少 ' + marker);
  }
  const css = fs.readFileSync(path.join(ROOT, 'templates', 'site-css.ejs'), 'utf-8');
  assert.ok(css.includes('features.exportArticle&&features.exportArticle.enabled!==false&&features.exportArticle.print!==false'), 'site-css 打印块未按 exportArticle.print 门控');
  assert.ok(css.includes('.post-source-url{display:none}'), '来源脚注屏幕隐藏规则缺失');
  assert.ok(css.includes('.post-actions,.cover-strip'), '打印隐藏清单未覆盖工具栏/封面控件');
  const runtime = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'export-article.js'), 'utf-8');
  for (const marker of ['window.print', 'navigator.clipboard', 'execCommand', 'data-md-url', 'credentials']) {
    assert.ok(runtime.includes(marker), 'export-article.js 缺少 ' + marker);
  }
  const deferred = fs.readFileSync(path.join(ROOT, 'js', 'core', 'deferred.js'), 'utf-8');
  assert.ok(deferred.includes("'export-article': exportArticleInit"), 'deferred 注册表未登记 export-article');
  const main = fs.readFileSync(path.join(ROOT, 'js', 'core', 'main.js'), 'utf-8');
  assert.ok(main.includes("dyn('export-article'"), 'main.js 空闲队列未登记 export-article（须走按需加载）');
  const pages = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'pages.js'), 'utf-8');
  assert.ok(pages.includes('writeArticleMarkdown'), 'pages.js 未接入构建期 md 导出');
  assert.ok(pages.includes('article.mdExportUrl'), 'pages.js 未把导出 URL 挂到文章数据（按钮缺失时隐藏）');
  const ui = json5.parse(fs.readFileSync(path.join(ROOT, 'ui-strings.json5'), 'utf-8'));
  assert.strictEqual(ui.post.sourceUrl, '原文链接');
  assert.strictEqual(ui.en.post.sourceUrl, 'Source');
  assert.notStrictEqual(ui.post.sourceUrl, ui.en.post.sourceUrl, '来源脚注文案中英不得相同');
  assert.strictEqual(MIME_TYPES['.md'], 'text/markdown', '静态服务需以 text/markdown 提供 .md 原文');
});

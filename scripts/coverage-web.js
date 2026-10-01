#!/usr/bin/env node
'use strict';
// 无头 Web 覆盖率汇总（test:cov-web）：
//   ① 以 --no-bundle + --no-minify-js + 压缩关闭构建到独立目录（build-artifacts/web-coverage/site）——
//      no-bundle 使产物 URL 与 js/** 源文件一一对应，--no-minify-js 关闭功能模块的 Terser 压缩
//      （仅覆盖率隔离构建使用），使 CDP 偏移可精确映射回源码行；
//   ② 自起静态服务 + 系统 Chrome 无头访问代表页集合（首页/文章/搜索/标签/归档/双语并排/主题实验室/省流/404）；
//   ③ 经 CDP Profiler 精确覆盖（callCount + detailed）逐页 take 并累加：ranges 的第一个区间即函数范围
//      （count 为调用次数），其余区间为块；函数覆盖 = 出现过的函数中 count>0 的比例，
//      行覆盖 = count>0 区间的行并集，行文本直接读 js/** 源文件；
//   ④ 交互动作 DSL（actions/actions legacy clicks+type）驱动真实用户路径，每个异步场景配 check 断言：
//      check 经 waitForFunction 轮询求值，失败计入报告并导致未达标（断言不是摆设）；
//   ⑤ 按 URL 聚合 js/**（排除 vendor），coverage.json 附未覆盖函数明细（file/行号/行文本），
//      输出 build-artifacts/web-coverage/{summary.txt,coverage.json}；
//   ⑥ 阈值来自 scripts/lib/web-coverage-thresholds.js，未达标或断言失败 exit 1；无 Chrome 跳过（exit 0）。
// 运行：npm run test:cov-web [-- --build --no-build --chrome <path> --json]

const fs = require('node:fs');
const path = require('node:path');
const {
  PROJECT_ROOT,
  resolveChrome,
  runBuild,
  startStaticServer,
  stopStaticServer,
  launchChrome,
  closeChrome,
  checkPortReleased,
  settleRuntimePage,
  sleep
} = require('./lib/web-harness');
const { discoverArticlePath, pageExists } = require('./lib/compression-verify');
const { writeFileAtomicSync } = require('./lib/atomic-write');
const thresholds = require('./lib/web-coverage-thresholds');

const OUT_DIR = path.join(PROJECT_ROOT, 'build-artifacts', 'web-coverage', 'site');
const REPORT_DIR = path.join(PROJECT_ROOT, 'build-artifacts', 'web-coverage');
const COMPRESSION_OFF_FILE = path.join(REPORT_DIR, 'compression-off.json5');
const COV_BUILD_STAMP = '.cov-build-stamp.json';
const COV_BUILD_MODE = 'no-bundle+no-minify-js+compression-off';
const JS_ASSET_PREFIX = '/assets/js/';
const CHECK_TIMEOUT_MS = 6000;
const MAX_ASSERTION_ITEMS = 300;
const MAX_SNIPPET_CHARS = 140;

function parseArgs(argv) {
  const out = { outDir: OUT_DIR, chrome: '', build: false, noBuild: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--out' && value) { out.outDir = path.resolve(value); i++; }
    else if (key === '--chrome' && value) { out.chrome = value; i++; }
    else if (key === '--build') out.build = true;
    else if (key === '--no-build') out.noBuild = true;
    else if (key === '--json') out.json = true;
  }
  return out;
}

function newestMtime(dir) {
  let newest = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return 0; }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = newestMtime(abs);
      if (nested > newest) newest = nested;
    } else {
      try {
        const m = fs.statSync(abs).mtimeMs;
        if (m > newest) newest = m;
      } catch (err) { /* 单文件不可读时忽略 */ }
    }
  }
  return newest;
}

// 产物新鲜度：构建成功后写戳文件（记录模式与产物目录）；戳缺失、来源更新或模式不符即重建。
// 不依赖产物文本形态做启发式判断（js/core/main.js 等源文件本身可能只有一行 import 链）。
function needsBuild(outDir, args) {
  if (args.noBuild) return false;
  if (args.build) return true;
  const marker = path.join(outDir, 'zh', 'index.html');
  const stampFile = path.join(outDir, COV_BUILD_STAMP);
  if (!fs.existsSync(marker) || !fs.existsSync(stampFile)) return true;
  try {
    const stamp = JSON.parse(fs.readFileSync(stampFile, 'utf-8'));
    if (stamp.mode !== COV_BUILD_MODE || path.resolve(stamp.outDir) !== path.resolve(outDir)) return true;
  } catch (err) {
    return true;
  }
  const builtAt = fs.statSync(marker).mtimeMs;
  for (const source of ['js', 'templates', path.join('scripts', 'build'), path.join('scripts', 'lib')]) {
    if (newestMtime(path.join(PROJECT_ROOT, source)) > builtAt) return true;
  }
  return false;
}

// 从首页卡片链接发现 ≤max 篇文章（目录存在且页面含 post-content 语义词），
// 供「继续阅读（需 ≥2 条历史）」「灯箱」「双语并排」等场景复用；不做固定 slug 假设。
function discoverArticles(outDir, max) {
  const found = [];
  let html;
  try { html = fs.readFileSync(path.join(outDir, 'zh', 'index.html'), 'utf-8'); } catch (err) { return found; }
  const re = /href="\/zh\/([a-z0-9][a-z0-9-]*)\/?"/g;
  let match;
  while ((match = re.exec(html)) && found.length < max) {
    const slug = match[1];
    const url = '/zh/' + slug + '/';
    if (found.indexOf(url) !== -1) continue;
    try {
      const page = fs.readFileSync(path.join(outDir, 'zh', slug, 'index.html'), 'utf-8');
      if (page.indexOf('article:published_time') === -1) continue;
      found.push(url);
    } catch (err) { /* 非文章目录跳过 */ }
  }
  return found;
}

// 选择存在另一语言对照的文章：双语并排/切换场景需要 data-bilingual-alt。
function pickBilingualArticle(outDir, articles) {
  for (const url of articles) {
    const slug = url.split('/')[2] || '';
    if (slug && pageExists(outDir, '/en/' + slug + '/')) return url;
  }
  return articles[0] || '';
}

// 代表页步骤：覆盖全部交互功能域（交互选择器缺失时仅告警，断言失败才阻断）。
// 顺序约束：
//   - 语言偏好先写入 s-ss-lang，再验证根 404 的存储语言分支；
//   - 省流/主题场景结束后保持存储干净（'0'/清除），避免污染后续页；
//   - 文章页历史需覆盖 zh+en 两条，继续阅读才能同时验证「单条移除」与「一键清空」。
function collectSteps(outDir) {
  const home = '/zh/';
  const homeChecks = [
    { label: '首页 eager 首图策略生效', expr: 'document.querySelectorAll(\'img[loading="eager"]\').length >= 1 || document.querySelectorAll("img").length === 0' },
    { label: '首页继续阅读容器存在', expr: '!!document.getElementById("continueReading")' }
  ];
  const steps = [
    { url: home, waitMs: 500, label: '首页', checks: homeChecks },
    { url: '/en/', waitMs: 500, label: '英文首页', checks: [
      { label: '英文页 data-lang=en', expr: 'document.documentElement.getAttribute("data-lang") === "en"' },
      { label: 'langOf 返回 en', expr: 'window.langOf() === "en"' }
    ] },
    { url: home, label: '语言切换（软导航到 en）', actions: [
      { type: 'click', selector: '#langBtn', waitMs: 300 },
      { type: 'check', label: '软导航到 /en/', expr: 'location.pathname === "/en/"', timeoutMs: 8000 },
      { type: 'check', label: 'document data-lang=en', expr: 'document.documentElement.getAttribute("data-lang") === "en"' },
      { type: 'check', label: '语言偏好写入 storageKey', expr: 'localStorage.getItem("s-ss-lang") === "en"' },
      { type: 'check', label: 'hreflang 随软导航同步', expr: '(function(){var l=document.querySelector(\'link[rel="alternate"][hreflang="en"]\');return !!l && l.getAttribute("href").indexOf("/en/") > -1})()' }
    ] }
  ];

  steps.push({ url: '/404.html', label: '根 404（存储语言分支）', actions: [
    { type: 'check', label: '无语言段页面沿用存储语言且不重定向', expr: 'location.pathname === "/404.html" && document.documentElement.getAttribute("data-lang") === "en"', timeoutMs: 8000 },
    { type: 'click', selector: '#langBtn', waitMs: 300 },
    { type: 'check', label: '点击语言键切到 /zh/404.html', expr: 'location.pathname === "/zh/404.html" && document.documentElement.getAttribute("data-lang") === "zh"', timeoutMs: 8000 }
  ] });

  if (pageExists(outDir, '/zh/404.html')) {
    steps.push({ url: '/zh/404.html', label: '404 推荐位与站内搜索', actions: [
      { type: 'check', label: '推荐位渲染 recentPosts', expr: 'document.querySelectorAll(".error-suggest-item").length >= 1' },
      { type: 'check', label: '插图 aria-label 来自 errorPage 配置', expr: '(function(){var s=document.querySelector(".error-svg");return !!s && s.getAttribute("aria-label") === "404 illustration"})()' },
      { type: 'click', selector: '#errSearchBtn', waitMs: 500 },
      { type: 'check', label: '404 搜索按钮打开搜索浮层', expr: '(function(){var o=document.getElementById("searchOverlay");return !!o && o.classList.contains("open")})()', timeoutMs: 8000 },
      { type: 'press', key: 'Escape' },
      { type: 'check', label: 'Esc 关闭搜索浮层', expr: '(function(){var o=document.getElementById("searchOverlay");return !!o && !o.classList.contains("open")})()' }
    ] });
  }

  steps.push({ url: home, label: '软导航往返 + 前进后退', actions: [
    { type: 'click', selector: '#langBtn', waitMs: 300 },
    { type: 'check', label: '软导航到 /en/', expr: 'location.pathname === "/en/"', timeoutMs: 8000 },
    { type: 'eval', code: 'history.back()' },
    { type: 'check', label: 'popstate 软导航回 /zh/', expr: 'location.pathname === "/zh/" && document.documentElement.getAttribute("data-lang") === "zh"', timeoutMs: 8000 }
  ] });

  steps.push({ url: home, label: '主题预设切换与持久化', actions: [
    { type: 'check', label: '预设模块完成绑定', expr: 'typeof window.applyPreset === "function" && typeof window.togglePresetPop === "function"', timeoutMs: 8000 },
    { type: 'click', selector: '#presetBtn', waitMs: 300 },
    { type: 'check', label: '预设弹层打开', expr: '(function(){var p=document.getElementById("presetPop");return !!p && p.classList.contains("open")})()', timeoutMs: 5000 },
    { type: 'click', selector: '.preset-item[data-preset="night-jet"]', waitMs: 400 },
    { type: 'check', label: '预设写入 storageKey', expr: 'localStorage.getItem("ss-preset") === "night-jet"' },
    { type: 'check', label: '预设样式表已注入', expr: '(function(){var s=document.getElementById("ssPreset");return !!s && s.textContent.indexOf("--color-p") > -1})()' },
    { type: 'check', label: '预设项进入激活态', expr: '(function(){var i=document.querySelector(\'.preset-item[data-preset="night-jet"]\');return !!i && i.classList.contains("active")})()' }
  ] });
  steps.push({ url: home, waitMs: 800, label: '主题预设持久化再访问', checks: [
    { label: '再次访问仍应用已存预设', expr: '(function(){var i=document.querySelector(\'.preset-item[data-preset="night-jet"]\');return !!i && i.classList.contains("active") && !!document.getElementById("ssPreset")})()', timeoutMs: 8000 }
  ] });

  steps.push({ url: home, waitMs: 600, label: '省流自动（connection.saveData）',
    preload: 'Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });',
    actions: [
      { type: 'check', label: '系统省流自动置类', expr: 'document.documentElement.classList.contains("save-data") && document.documentElement.getAttribute("data-save-data-source") === "auto"', timeoutMs: 8000 },
      { type: 'check', label: '图片激进懒加载生效', expr: '(function(){var imgs=document.querySelectorAll("img");if(!imgs.length)return true;return document.querySelectorAll("img[data-sd-lazy]").length >= 1})()' },
      { type: 'eval', code: 'window.__saveData.setManual(false)' },
      { type: 'check', label: '手动偏好覆盖自动（关闭）', expr: '!document.documentElement.classList.contains("save-data") && document.documentElement.getAttribute("data-save-data-source") === "manual" && localStorage.getItem("ss-save-data") === "0"' },
      { type: 'eval', code: 'window.__saveData.clearManual()' },
      { type: 'check', label: '清除手动偏好后回到自动', expr: 'document.documentElement.classList.contains("save-data") && document.documentElement.getAttribute("data-save-data-source") === "auto" && localStorage.getItem("ss-save-data") === null' }
    ] });

  steps.push({ url: home, label: '搜索浮层（真实内容查询）', actions: [
    { type: 'click', selector: '.hero-search', waitMs: 400 },
    { type: 'check', label: '搜索浮层打开', expr: '(function(){var o=document.getElementById("searchOverlay");return !!o && o.classList.contains("open")})()', timeoutMs: 8000 },
    { type: 'eval', code: 'var t=document.querySelector(".post-card-title a");var s=(t?t.textContent:"").trim();var cjk=s.match(/[一-鿿]{2,4}/);var word=s.match(/[A-Za-z0-9]{2,}/);var q=cjk?cjk[0]:(word?word[0]:"a");var i=document.getElementById("searchInput");i.value=q;window.__covQuery=q;i.dispatchEvent(new Event("input",{bubbles:true}))' },
    { type: 'check', label: '查询命中结果项', expr: 'document.querySelectorAll(".search-result-item").length >= 1', timeoutMs: 8000 },
    { type: 'check', label: '命中关键词高亮 <mark>', expr: '!!document.querySelector("#searchResults mark")' },
    { type: 'check', label: '结果计数显示', expr: '(function(){var c=document.getElementById("searchCount");return !!c && c.textContent.trim().length > 0})()' },
    { type: 'press', key: 'ArrowDown' },
    { type: 'press', key: 'Escape' },
    { type: 'check', label: 'Esc 关闭搜索浮层', expr: '(function(){var o=document.getElementById("searchOverlay");return !!o && !o.classList.contains("open")})()' }
  ] });

  const articles = discoverArticles(outDir, 2);
  if (articles.length === 0) {
    const fallback = discoverArticlePath(outDir);
    if (fallback) articles.push(fallback);
  }
  const bilingualArticle = pickBilingualArticle(outDir, articles);
  const article = articles[0] || '';

  if (article) {
    steps.push({ url: article, waitMs: 500, label: '文章页', checks: [
      { label: '文章正文渲染', expr: '!!document.querySelector(".post-content")' }
    ] });
    steps.push({ url: article, label: '文章页交互（双语切换/省流/主题页签）', actions: [
      { type: 'click', selector: '#bilingualSwitch', waitMs: 1200, optional: true },
      { type: 'check', label: '双语切换软导航到对照文章', expr: 'location.pathname.indexOf("/en/") === 0 && !!document.querySelector(".post-content")', timeoutMs: 8000 },
      { type: 'click', selector: '#readerGear', waitMs: 400, optional: true },
      { type: 'click', selector: '#saveDataToggle', waitMs: 600, optional: true },
      { type: 'check', label: '省流开启：类与持久化', expr: 'document.documentElement.classList.contains("save-data") && localStorage.getItem("ss-save-data") === "1"' },
      { type: 'click', selector: '#saveDataToggle', waitMs: 600, optional: true },
      { type: 'check', label: '省流还原：类移除且存储置 0', expr: '!document.documentElement.classList.contains("save-data") && localStorage.getItem("ss-save-data") === "0"' },
      { type: 'click', selector: '#rtabTheme', waitMs: 500, optional: true },
      { type: 'check', label: '主题页签激活', expr: '(function(){var p=document.getElementById("rpageTheme");return !!p && !p.hidden})()' }
    ] });
    steps.push({ url: article, label: '灯箱（打开/翻页/缩放/关闭）', actions: [
      { type: 'click', selector: '.post-content img:not(a img)', waitMs: 600, optional: true },
      { type: 'check', label: '点击正文图片打开灯箱（无图时跳过）', expr: '(function(){var imgs=Array.prototype.filter.call(document.querySelectorAll(".post-content img"),function(i){return !i.closest("a")});if(!imgs.length)return true;var lb=document.getElementById("lightbox");return !!lb && lb.classList.contains("open")})()', timeoutMs: 8000 },
      { type: 'click', selector: '#lbNext', waitMs: 300, optional: true },
      { type: 'click', selector: '#lbZoomIn', waitMs: 250, optional: true },
      { type: 'click', selector: '#lbRotateR', waitMs: 250, optional: true },
      { type: 'click', selector: '#lbReset', waitMs: 250, optional: true },
      { type: 'click', selector: '#lbSlideshow', waitMs: 250, optional: true },
      { type: 'click', selector: '#lbClose', waitMs: 400, optional: true },
      { type: 'check', label: '灯箱关闭还原', expr: '(function(){var lb=document.getElementById("lightbox");return !lb || !lb.classList.contains("open")})()' }
    ] });
    if (bilingualArticle) {
      steps.push({ url: bilingualArticle, label: '双语并排（宽屏）', actions: [
        { type: 'viewport', width: 1440, height: 900 },
        { type: 'check', label: '宽屏显示并排开关', expr: '(function(){var b=document.getElementById("bilingualSide");return !!b && b.hidden === false})()', timeoutMs: 8000 },
        { type: 'click', selector: '#bilingualSide', waitMs: 500, optional: true },
        { type: 'check', label: '右栏渲染对方正文', expr: '(function(){var b=document.getElementById("bilingualPaneBody");return !!b && b.children.length > 0})()', timeoutMs: 10000 },
        { type: 'check', label: '右栏标题取 paneTitleEn', expr: '(function(){var t=document.querySelector(".bilingual-pane-title");return !!t && t.textContent.trim() === "English"})()' },
        { type: 'check', label: '并排态 aria-pressed=true', expr: '(function(){var b=document.getElementById("bilingualSide");return !!b && b.getAttribute("aria-pressed") === "true"})()' },
        { type: 'click', selector: '#bilingualSide', waitMs: 400, optional: true },
        { type: 'check', label: '再次点击关闭并排', expr: '(function(){var b=document.getElementById("bilingualSide");return !!b && b.getAttribute("aria-pressed") === "false"})()' },
        { type: 'viewport', width: 800, height: 600 }
      ] });
    }
    steps.push({ url: article, label: '主题实验室（编辑/预设/保存/导出/重置）', actions: [
      { type: 'click', selector: '#readerGear', waitMs: 400, optional: true },
      { type: 'click', selector: '#rtabTheme', waitMs: 500, optional: true },
      { type: 'check', label: '调色行按白名单构建', expr: '!!document.querySelector("#themeLabBody input[type=color][data-token]")', timeoutMs: 8000 },
      { type: 'eval', code: 'var el=document.querySelector(\'#themeLabBody input[data-token="--color-p"]\');el.value="#123456";el.dispatchEvent(new Event("input",{bubbles:true}))' },
      { type: 'check', label: '取色实时预览写 CSS 变量', expr: 'document.documentElement.style.getPropertyValue("--color-p") === "#123456"' },
      { type: 'click', selector: '#themeLabSave', waitMs: 300, optional: true },
      { type: 'check', label: '保存写入 storageKey', expr: '(function(){try{var v=JSON.parse(localStorage.getItem("ss-theme-lab")||"null");return !!v && v.light && v.light["--color-p"] === "#123456"}catch(e){return false}})()' },
      { type: 'check', label: '预设下拉可用', expr: '(function(){var p=document.getElementById("themeLabPreset");return !!p && p.options.length > 1})()' },
      { type: 'select', selector: '#themeLabPreset', value: 'classic-blue', waitMs: 400 },
      { type: 'check', label: '载入预设写入编辑态', expr: '(function(){var s=window.__themeLab?window.__themeLab.getState():null;return !!s && Object.keys(s.light).length > 0})()' },
      { type: 'click', selector: '#themeLabCopy', waitMs: 300, optional: true },
      { type: 'click', selector: '#themeLabDownload', waitMs: 300, optional: true },
      { type: 'check', label: '导出下载被记录', expr: '(function(){var s=window.__themeLab?window.__themeLab.getLastDownload():null;return !!s && s.size > 0})()' },
      { type: 'click', selector: '#themeLabResetAll', waitMs: 300, optional: true },
      { type: 'check', label: '全部重置删除存储', expr: 'localStorage.getItem("ss-theme-lab") === null' }
    ] });
    steps.push({ url: home, label: '继续阅读（移除/清空）', actions: [
      { type: 'check', label: '继续阅读渲染 ≥2 条历史', expr: '(function(){var h=document.getElementById("continueReading");return !!h && !h.hidden && h.querySelectorAll(".cr-item").length >= 2})()', timeoutMs: 8000 },
      { type: 'eval', code: 'window.__covCrBefore=document.querySelectorAll(".cr-item").length' },
      { type: 'click', selector: '.cr-remove', waitMs: 800, optional: true },
      { type: 'check', label: '单条移除后条目减一', expr: 'document.querySelectorAll(".cr-item").length === window.__covCrBefore - 1' },
      { type: 'click', selector: '.cr-clear', waitMs: 300, optional: true },
      { type: 'check', label: '清空进入二次确认态', expr: '(function(){var b=document.querySelector(".cr-clear");return !!b && b.getAttribute("aria-pressed") === "true"})()' },
      { type: 'click', selector: '.cr-clear', waitMs: 300, optional: true },
      { type: 'check', label: '确认后清空并隐藏', expr: '(function(){var h=document.getElementById("continueReading");return !!h && h.hidden === true && localStorage.getItem("s-history") === "[]"})()' }
    ] });
  }

  if (pageExists(outDir, '/zh/search/')) {
    steps.push({ url: '/zh/search/', type: { selector: '#searchPageInput', text: 'hello' }, waitMs: 900, label: '搜索页', checks: [
      { label: '搜索页结果区已渲染', expr: '(function(){var r=document.getElementById("searchPageResults");return !!r && r.innerHTML.length > 0})()' }
    ] });
  }
  if (pageExists(outDir, '/zh/tags/')) steps.push({ url: '/zh/tags/', waitMs: 400, label: '标签页' });
  if (pageExists(outDir, '/zh/archive/')) steps.push({ url: '/zh/archive/', waitMs: 400, label: '归档页' });
  return steps;
}

// 兼容旧字段 clicks/type 并支持有序 actions：viewport → preload → storage → goto → 旧字段 → actions。
function normalizeActions(step) {
  const actions = [];
  if (step.viewport) actions.push({ type: 'viewport', width: step.viewport.width, height: step.viewport.height });
  if (step.preload) actions.push({ type: 'preload', code: step.preload });
  if (step.storage) actions.push({ type: 'storage', data: step.storage });
  actions.push({ type: 'goto', url: step.url });
  for (const click of step.clicks || []) actions.push(Object.assign({ type: 'click' }, click));
  if (step.type) actions.push(Object.assign({ type: 'type' }, step.type));
  for (const key of step.press || []) actions.push({ type: 'press', key: key });
  for (const item of step.eval || []) actions.push(Object.assign({ type: 'eval' }, item));
  for (const check of step.checks || []) actions.push(Object.assign({ type: 'check' }, check));
  for (const action of step.actions || []) actions.push(action);
  return actions;
}

function checkCountOf(step) {
  return normalizeActions(step).filter((a) => a.type === 'check').length;
}

function lineStartsOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineForOffset(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// 非空白行标记（行覆盖分母只算有代码字符的行，避免缩进/空行稀释指标）。
function codeLineFlags(text, starts) {
  const flags = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    flags.push(text.slice(start, end).trim().length > 0);
  }
  return flags;
}

function snippetAtLine(starts, text, line) {
  const start = starts[line];
  if (start === undefined) return '';
  const end = line + 1 < starts.length ? starts[line + 1] : text.length;
  const raw = text.slice(start, end).trim();
  return raw.length > MAX_SNIPPET_CHARS ? raw.slice(0, MAX_SNIPPET_CHARS) + '…' : raw;
}

function createFileEntry(rel) {
  const sourceFile = path.join(PROJECT_ROOT, 'js', rel.split('/').join(path.sep));
  const text = fs.readFileSync(sourceFile, 'utf-8');
  const starts = lineStartsOf(text);
  return {
    file: 'js/' + rel,
    text,
    starts,
    lineHits: new Array(starts.length).fill(false),
    codeFlags: codeLineFlags(text, starts),
    functions: new Map()
  };
}

function relFromUrl(url, baseUrl) {
  if (!url.startsWith(baseUrl + JS_ASSET_PREFIX)) return '';
  let rel;
  try {
    rel = decodeURIComponent(url.slice(baseUrl.length + JS_ASSET_PREFIX.length).split('?')[0].split('#')[0]);
  } catch (err) {
    return '';
  }
  if (!rel || rel.startsWith('vendor/') || rel.split('/').includes('..')) return '';
  if (!fs.existsSync(path.join(PROJECT_ROOT, 'js', rel.split('/').join(path.sep)))) return '';
  return rel;
}

// 把一次 takePreciseCoverage 的结果累加进 files：
// 函数分母按「ranges[0] 区间」去重（同一函数跨多次导航/多个 scriptId 只计一次），计数取最大值；
// 每个函数记录起始行与源码文本（未覆盖明细诊断用）；行覆盖对所有 count>0 的区间做行并集。
function mergeCoverage(files, result, baseUrl) {
  for (const script of result) {
    const rel = relFromUrl(String(script.url || ''), baseUrl);
    if (!rel) continue;
    let entry = files.get(rel);
    if (!entry) {
      entry = createFileEntry(rel);
      files.set(rel, entry);
    }
    // 本次 take 的局部行命中：V8 的 detailed 区间为前序嵌套（父区间在前、子区间随后）。
    // 父区间 count>0 会把整段行标为覆盖（尤其模块顶层区间覆盖整文件），必须以 count=0 的
    // 子区间反标（未执行分支/未调用函数体），否则行覆盖恒等于「模块是否加载」。
    // 局部结果再与历史 OR 合并：同一步骤/跨步骤反复加载同一脚本时，后一次的反标
    // 不得抹掉先前已覆盖的行。
    const takeHits = new Map();
    for (const fn of script.functions || []) {
      const ranges = Array.isArray(fn.ranges) ? fn.ranges : [];
      if (!ranges.length) continue;
      const head = ranges[0];
      const key = head.startOffset + ':' + head.endOffset;
      const count = head.count || 0;
      const prev = entry.functions.get(key);
      if (prev) {
        if (count > prev.count) prev.count = count;
      } else {
        const line = lineForOffset(entry.starts, head.startOffset);
        entry.functions.set(key, { count: count, line: line, text: snippetAtLine(entry.starts, entry.text, line) });
      }
      for (const range of ranges) {
        const covered = (range.count || 0) > 0;
        const first = lineForOffset(entry.starts, range.startOffset);
        const last = lineForOffset(entry.starts, Math.max(range.startOffset, range.endOffset - 1));
        for (let line = first; line <= last; line++) takeHits.set(line, covered);
      }
    }
    for (const [line, covered] of takeHits) {
      if (covered) entry.lineHits[line] = true;
    }
  }
}

const OPTIONAL_CLICK_WARN = '（optional，忽略）';

async function runClick(page, action, warnings, stepLabel) {
  const selector = action.selector || '';
  try {
    if (action.nth != null) {
      const handles = await page.$$(selector);
      if (!handles[action.nth]) throw new Error('未找到第 ' + action.nth + ' 个元素');
      await handles[action.nth].click({ button: action.button || 'left' });
    } else {
      await page.click(selector, { button: action.button || 'left' });
    }
    await sleep(action.waitMs || 600);
  } catch (err) {
    const detail = '点击 ' + selector + '（' + stepLabel + '）失败: ' + String((err && err.message) || err);
    if (!action.optional) warnings.push(detail);
    else warnings.push(detail + OPTIONAL_CLICK_WARN);
  }
}

async function runCheck(page, action, report, stepLabel) {
  const label = action.label || action.expr;
  report.assertions.total += 1;
  try {
    await page.waitForFunction(action.expr, { timeout: action.timeoutMs || CHECK_TIMEOUT_MS, polling: 100 });
    report.assertions.passed += 1;
    if (report.assertions.items.length < MAX_ASSERTION_ITEMS) {
      report.assertions.items.push({ step: stepLabel, label: label, ok: true });
    }
  } catch (err) {
    report.assertions.failed += 1;
    const error = String((err && err.message) || err).slice(0, 300);
    if (report.assertions.items.length < MAX_ASSERTION_ITEMS) {
      report.assertions.items.push({ step: stepLabel, label: label, ok: false, error: error });
    }
    report.warnings.push('断言失败 [' + stepLabel + '] ' + label + ': ' + error);
  }
}

async function runAction(page, action, ctx) {
  const { report, warnings, stepLabel } = ctx;
  if (action.type === 'viewport') {
    await page.setViewport({ width: action.width, height: action.height });
    return;
  }
  if (action.type === 'preload') {
    ctx.preloadIds.push((await page.evaluateOnNewDocument(action.code)).identifier);
    return;
  }
  if (action.type === 'storage') {
    await page.evaluate((data) => {
      for (const key of Object.keys(data || {})) {
        try {
          if (data[key] == null) localStorage.removeItem(key);
          else localStorage.setItem(key, String(data[key]));
        } catch (err) { /* 存储不可用时保持默认 */ }
      }
    }, action.data);
    return;
  }
  if (action.type === 'goto') {
    await page.goto(ctx.baseUrl + action.url, { waitUntil: 'load', timeout: 30000 });
    await settleRuntimePage(page);
    return;
  }
  if (action.type === 'click') {
    await runClick(page, action, warnings, stepLabel);
    return;
  }
  if (action.type === 'type') {
    try {
      await page.type(action.selector, action.text, { delay: action.delay || 20 });
      await sleep(action.waitMs || 600);
    } catch (err) {
      warnings.push('输入 ' + action.selector + '（' + stepLabel + '）失败: ' + String((err && err.message) || err));
    }
    return;
  }
  if (action.type === 'press') {
    await page.keyboard.press(action.key);
    await sleep(action.waitMs || 200);
    return;
  }
  if (action.type === 'select') {
    try {
      await page.select(action.selector, action.value);
      await sleep(action.waitMs || 400);
    } catch (err) {
      warnings.push('下拉选择 ' + action.selector + '（' + stepLabel + '）失败: ' + String((err && err.message) || err));
    }
    return;
  }
  if (action.type === 'eval') {
    try {
      await page.evaluate('(function(){' + action.code + '})()');
      await sleep(action.waitMs || 100);
    } catch (err) {
      warnings.push('页面脚本执行（' + stepLabel + '）失败: ' + String((err && err.message) || err));
    }
    return;
  }
  if (action.type === 'check') {
    await runCheck(page, action, report, stepLabel);
    return;
  }
  warnings.push('未知动作类型 ' + action.type + '（' + stepLabel + '）');
}

async function collectCoverage(page, session, baseUrl, steps, warnings, files, report) {
  await session.send('Profiler.enable');
  await session.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  for (const step of steps) {
    const stepLabel = step.label || step.url;
    const ctx = { baseUrl, report, warnings, stepLabel, preloadIds: [] };
    let navigated = false;
    for (const action of normalizeActions(step)) {
      try {
        await runAction(page, action, ctx);
        if (action.type === 'goto') navigated = true;
      } catch (err) {
        if (action.type === 'goto') {
          warnings.push('导航失败 ' + action.url + ': ' + String((err && err.message) || err));
          break;
        }
        warnings.push('动作 ' + action.type + '（' + stepLabel + '）异常: ' + String((err && err.message) || err));
      }
    }
    for (const identifier of ctx.preloadIds) {
      try { await page.removeScriptToEvaluateOnNewDocument(identifier); } catch (err) { /* 已随上下文清理 */ }
    }
    if (!navigated) continue;
    try {
      const { result } = await session.send('Profiler.takePreciseCoverage');
      mergeCoverage(files, result, baseUrl);
    } catch (err) {
      warnings.push('覆盖率采集失败（' + stepLabel + '）: ' + String((err && err.message) || err));
    }
  }
  await session.send('Profiler.stopPreciseCoverage').catch(() => {});
}

function fileStats(entry) {
  let total = 0;
  let covered = 0;
  for (let i = 0; i < entry.codeFlags.length; i++) {
    if (!entry.codeFlags[i]) continue;
    total += 1;
    if (entry.lineHits[i]) covered += 1;
  }
  let rangesTotal = entry.functions.size;
  let rangesCovered = 0;
  for (const fn of entry.functions.values()) {
    if (fn.count > 0) rangesCovered += 1;
  }
  return { total, covered, rangesTotal, rangesCovered };
}

function pct(covered, total) {
  return total > 0 ? Math.round((covered / total) * 1000) / 10 : 0;
}

function buildReportRows(files) {
  const rows = [];
  const totals = { codeLines: 0, coveredLines: 0, ranges: 0, coveredRanges: 0, uncovered: 0 };
  for (const entry of files.values()) {
    const stats = fileStats(entry);
    totals.codeLines += stats.total;
    totals.coveredLines += stats.covered;
    totals.ranges += stats.rangesTotal;
    totals.coveredRanges += stats.rangesCovered;
    const uncovered = [];
    for (const fn of entry.functions.values()) {
      if (fn.count > 0) continue;
      uncovered.push({ line: fn.line + 1, text: fn.text });
    }
    uncovered.sort((a, b) => a.line - b.line);
    totals.uncovered += uncovered.length;
    rows.push({
      file: entry.file,
      lines: stats.total,
      coveredLines: stats.covered,
      linePct: pct(stats.covered, stats.total),
      ranges: stats.rangesTotal,
      coveredRanges: stats.rangesCovered,
      functionPct: pct(stats.rangesCovered, stats.rangesTotal),
      uncovered: uncovered
    });
  }
  rows.sort((a, b) => a.linePct - b.linePct || a.file.localeCompare(b.file));
  return {
    files: rows,
    totals: {
      codeLines: totals.codeLines,
      coveredLines: totals.coveredLines,
      linePct: pct(totals.coveredLines, totals.codeLines),
      ranges: totals.ranges,
      coveredRanges: totals.coveredRanges,
      functionPct: pct(totals.coveredRanges, totals.ranges),
      uncoveredFunctions: totals.uncovered
    }
  };
}

function renderSummary(report) {
  const lines = [
    'S-YNAPSE Web 覆盖率摘要',
    '时间: ' + report.generatedAt,
    '产物: ' + report.outDir,
    'Chrome: ' + (report.chrome || '(未使用)'),
    '阈值: 行 >= ' + report.threshold.lines + '%  函数 >= ' + report.threshold.functions + '%',
    '',
    '代表页:'
  ];
  for (const step of report.steps) {
    lines.push('  ' + step.url + (step.label ? ' [' + step.label + ']' : '') + (step.checks ? '  断言 ' + step.checks : ''));
  }
  if (report.assertions && report.assertions.total > 0) {
    lines.push('', '断言: ' + report.assertions.passed + '/' + report.assertions.total + ' 通过' +
      (report.assertions.failed ? '（失败 ' + report.assertions.failed + '）' : ''));
    for (const item of report.assertions.items.filter((x) => !x.ok).slice(0, 10)) {
      lines.push('  x [' + item.step + '] ' + item.label + ' — ' + (item.error || ''));
    }
  }
  lines.push('', '文件（js/**，排除 vendor；按行覆盖升序）:');
  for (const row of report.files) {
    lines.push('  ' + row.file.padEnd(48) + ' 行 ' + row.coveredLines + '/' + row.lines + ' (' + row.linePct + '%)' +
      '  函数 ' + row.coveredRanges + '/' + row.ranges + ' (' + row.functionPct + '%)' +
      '  未覆盖函数 ' + row.uncovered.length);
  }
  lines.push('', '合计: ' + (report.totals
    ? '行 ' + report.totals.coveredLines + '/' + report.totals.codeLines + ' (' + report.totals.linePct + '%)' +
      '  函数 ' + report.totals.coveredRanges + '/' + report.totals.ranges + ' (' + report.totals.functionPct + '%)' +
      '  未覆盖函数 ' + report.totals.uncoveredFunctions
    : '（未采集到数据）'));
  lines.push('结果: ' + (report.passed ? '通过' : '未达标') + '；端口释放: ' + report.portsReleased);
  if (report.warnings.length) {
    lines.push('', '告警:');
    for (const warning of report.warnings.slice(0, 20)) lines.push('  - ' + warning);
  }
  return lines.join('\n') + '\n';
}

function writeReports(report, args) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  writeFileAtomicSync(path.join(REPORT_DIR, 'coverage.json'), JSON.stringify(report, null, 2));
  writeFileAtomicSync(path.join(REPORT_DIR, 'summary.txt'), renderSummary(report));
  if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const report = {
    generatedAt: new Date().toISOString(),
    outDir: args.outDir,
    chrome: '',
    skipped: '',
    threshold: { lines: thresholds.LINES_PCT, functions: thresholds.FUNCTIONS_PCT },
    steps: [],
    assertions: { total: 0, passed: 0, failed: 0, items: [] },
    files: [],
    totals: null,
    warnings: [],
    portsReleased: null,
    passed: false,
    durationMs: 0
  };
  const startedAt = Date.now();

  if (needsBuild(args.outDir, args)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    if (!fs.existsSync(COMPRESSION_OFF_FILE)) fs.writeFileSync(COMPRESSION_OFF_FILE, '{ enabled: false }\n', 'utf-8');
    process.stdout.write('[cov-web] 构建（--no-bundle + --no-minify-js + 压缩关闭）到 ' + args.outDir + ' …\n');
    const build = runBuild(args.outDir, { noBundle: true, extraArgs: ['--no-minify-js', '--compression-override', COMPRESSION_OFF_FILE] });
    if (!build.ok) {
      report.warnings.push('构建失败 status=' + build.status + '；' + build.stdout.slice(-1500) + build.stderr.slice(-1500));
      writeReports(report, args);
      process.stderr.write('[cov-web] 构建失败，无法采集覆盖率\n');
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(
      path.join(args.outDir, COV_BUILD_STAMP),
      JSON.stringify({ mode: COV_BUILD_MODE, outDir: args.outDir, builtAt: new Date().toISOString() }, null, 2) + '\n',
      'utf-8'
    );
  }

  const chromePath = args.chrome || resolveChrome();
  if (!chromePath) {
    report.skipped = 'chrome-not-found';
    process.stdout.write('[SKIP] 未检测到系统 Chrome（CHROME_PATH/google-chrome/chromium），跳过 Web 覆盖率采集\n');
    writeReports(report, args);
    return;
  }
  report.chrome = chromePath;

  const steps = collectSteps(args.outDir);
  report.steps = steps.map((step) => ({ url: step.url, label: step.label || '', checks: checkCountOf(step) }));
  const server = startStaticServer(args.outDir);
  const files = new Map();
  let browser = null;
  let port = 0;
  try {
    port = await server.ready;
    process.stdout.write('[cov-web] serve 127.0.0.1:' + port + '\n');
    browser = await launchChrome(chromePath, { allowedPorts: [port] });
    const page = await browser.newPage();
    const session = await page.target().createCDPSession();
    const baseUrl = 'http://127.0.0.1:' + port;
    await collectCoverage(page, session, baseUrl, steps, report.warnings, files, report);
    process.stdout.write('[cov-web] 覆盖采集完成（' + files.size + ' 个源文件，断言 ' +
      report.assertions.passed + '/' + report.assertions.total + '）\n');
    if (files.size === 0) report.warnings.push('未匹配到任何 js/** 源文件（检查产物形态与 URL 映射）');
    const aggregated = buildReportRows(files);
    report.files = aggregated.files;
    report.totals = aggregated.totals;
  } catch (err) {
    report.warnings.push('采集异常: ' + String((err && err.stack) || err));
  } finally {
    if (browser) await closeChrome(browser);
    await stopStaticServer(server);
    if (port > 0) {
      report.portsReleased = await checkPortReleased(port);
      if (!report.portsReleased) report.warnings.push('端口未释放 ' + port);
    }
  }

  if (report.totals === null) {
    writeReports(report, args);
    process.stderr.write('[cov-web] 未采集到覆盖率数据，失败\n');
    process.exitCode = 1;
    return;
  }
  report.durationMs = Date.now() - startedAt;
  report.passed = report.totals.linePct >= thresholds.LINES_PCT &&
    report.totals.functionPct >= thresholds.FUNCTIONS_PCT &&
    report.assertions.failed === 0 &&
    report.portsReleased !== false;
  writeReports(report, args);
  process.stdout.write('[cov-web] 行 ' + report.totals.linePct + '%（阈值 ' + thresholds.LINES_PCT + '%）' +
    '；函数 ' + report.totals.functionPct + '%（阈值 ' + thresholds.FUNCTIONS_PCT + '%）' +
    '；断言 ' + report.assertions.passed + '/' + report.assertions.total +
    '；' + (report.passed ? '通过' : '未达标') +
    '；端口' + (report.portsReleased ? '已释放' : '未释放') + '\n');
  if (report.warnings.length) {
    for (const warning of report.warnings.slice(0, 10)) process.stderr.write('[cov-web] 告警: ' + warning + '\n');
  }
  if (!report.passed) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write('[cov-web] 未捕获错误: ' + String((err && err.stack) || err) + '\n');
  process.exitCode = 1;
});

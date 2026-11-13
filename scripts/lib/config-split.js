'use strict';

// 运行时配置分层拆分（优化 Task 1.1）：
//   把原先逐页内联的全量运行时配置（features/tuning/guard/... ≈40KB）拆成
//   ① external：内容寻址的 /assets/config.<hash>.json，全站一份、可 immutable 缓存；
//   ② critical：必须内联的降级最小子集（guard 开关 + PWA 注册信息），强制 ≤2048 字节，
//      弱网/离线时 fetch 失败也能保持页面可用（fail-open）。
// 逐页/逐语言变化的小项（__SITE_TITLE__/__ART_TITLE__/__SEARCH_PROVIDER__）继续内联，不进入 external。
//
// 2G 性能（引语载荷外置）：`quotes` 是内容数据（默认 100 条 ≈28 KiB raw / 9.4 KiB gzip），
// 不是配置。它随启动配置同步下载时占了 config 载荷约 30%，而每日一言挂件只在页面初始化后
// 才渲染。因此这里把引语数组单独写成 /assets/quotes.<hash>.json（与 config 同为内容寻址：
// 文件名由内容哈希派生，cacheBust 与 JSON 压缩步骤均跳过它），external 里只保留字符串字段
// quotesUrl；浏览器侧由 js/domains/features/daily-quote.js 在挂件初始化时按需 fetch
//（见该文件 loadQuotes），首次访问后由 SW 的 assetCacheFirst 运行时缓存。
// 这样首屏关键路径少 9.4 KiB gzip，引语请求与首屏渲染并行发生而非阻塞启动。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { writeFileAtomicSync } = require('./atomic-write');

// critical 序列化字节上限。超出即视为配置缺陷，直接抛错阻断构建，
// 防止「降级子集」随功能膨胀悄悄退回大内联。
const CRITICAL_MAX_BYTES = 2048;

// 内容寻址文件名：SHA-1 前 10 位（与 asset-cache 指纹长度一致）。
function contentUrlName(dirName, baseName, jsonText) {
  if (typeof jsonText !== 'string') {
    throw new TypeError('contentUrlName 需要字符串入参（JSON 文本）');
  }
  const hash = crypto.createHash('sha1').update(jsonText, 'utf8').digest('hex').slice(0, 10);
  return '/' + dirName + '/' + baseName + '.' + hash + '.json';
}

/**
 * 拆分运行时配置。
 *
 * @param {object} [sources] 来源配置集合，字段均可缺省：
 *   - features: 功能总控（features.json5 合并结果，必填项，承载全量外置）
 *   - tuning: 视觉/行为微调（tuning.json5）
 *   - guard: 防护细节（guard.json5）；仅当 features.guards.enabled !== false 且提供时外置
 *   - morphIcons: 图标变形配置（features.morphIcons）
 *   - presets: 主题预设数组（构建期由 lib/theme-presets 生成，全局一致）
 *   - quotes: 每日引语数组（resolveDailyQuotes 结果，全局一致）。**不进入 external**，
 *     改为独立内容寻址文件，external 只带 quotesUrl（2G 性能，见文件头）。
 *   - uiStrings: 界面文案字典（ui-strings.json5）
 *   - linkWarning: 外链警告配置（site.externalLinkWarning）
 *   - pwa: PWA 配置（site.pwa）；critical 仅取 enabled/serviceWorker
 *   - theme: 主题运行时子集（theme.darkMode 的 default/rememberChoice/iconStyle/transitionAll）
 *   - siteTitle: 站点标题。**故意不进入 external**（逐语言变化，继续随页面内联）
 * @returns {{ critical: object, external: object, quoteFile: ?{ url: string, json: string } }}
 *   critical = { features: { guards }, pwa: { enabled, serviceWorker } }，JSON ≤ 2048 字节；
 *   external = { features, tuning, guard?, morphIcons, presets, i18n, linkWarning, pwa, theme, quotesUrl? }；
 *   quoteFile = 引语文件 { url: /assets/quotes.<hash>.json, json }，无引语时为 null。
 * @throws {Error} critical 序列化超过 CRITICAL_MAX_BYTES 时抛出（构建必须失败）。
 */
function buildRuntimeConfig(sources) {
  const src = sources || {};
  const features = src.features;
  const pwa = src.pwa || {};
  const quotes = Array.isArray(src.quotes) ? src.quotes : [];
  const external = {
    features: features,
    tuning: src.tuning || {},
    morphIcons: src.morphIcons || {},
    presets: Array.isArray(src.presets) ? src.presets : [],
    i18n: src.uiStrings || {},
    linkWarning: src.linkWarning || {},
    pwa: src.pwa || { enabled: false, serviceWorker: '' },
    theme: src.theme || {}
  };
  // 2G 性能：引语是内容数据，从启动配置移到独立文件；只留 quotesUrl 供运行时按需拉取。
  const quoteJson = quotes.length ? JSON.stringify(quotes) : '';
  const quoteFile = quoteJson ? { url: quoteUrlName(quoteJson), json: quoteJson } : null;
  if (quoteFile) external.quotesUrl = quoteFile.url;
  const guards = features && features.guards;
  if (guards && guards.enabled !== false && src.guard) {
    external.guard = src.guard;
  }
  const critical = {
    features: { guards: guards || {} },
    pwa: {
      enabled: pwa.enabled === true,
      serviceWorker: typeof pwa.serviceWorker === 'string' ? pwa.serviceWorker : ''
    }
  };
  const serialized = JSON.stringify(critical);
  const bytes = Buffer.byteLength(serialized, 'utf8');
  if (bytes > CRITICAL_MAX_BYTES) {
    throw new Error(
      'critical 内联配置 ' + bytes + ' 字节，超过 ' + CRITICAL_MAX_BYTES +
      ' 字节上限；请精简 features.guards，或调整内联子集（scripts/lib/config-split.js）'
    );
  }
  return { critical, external, quoteFile };
}

/**
 * 内容寻址的配置文件名：SHA-1 前 10 位十六进制（与 asset-cache 指纹长度一致）。
 * 内容不变则名称稳定，可配 long-term immutable 缓存；内容变化自动换名。
 *
 * @param {string} jsonText external 的 JSON.stringify 结果（字节必须与实际写入文件一致）
 * @returns {string} 形如 /assets/config.a1b2c3d4e5.json
 * @throws {TypeError} jsonText 非字符串时抛出
 */
function configUrlName(jsonText) {
  return contentUrlName('assets', 'config', jsonText);
}

/**
 * 内容寻址的引语文件名：/assets/quotes.<sha1 前 10 位>.json（与 configUrlName 同格式）。
 *
 * @param {string} jsonText 引语数组的 JSON.stringify 结果
 * @returns {string}
 * @throws {TypeError} jsonText 非字符串时抛出
 */
function quoteUrlName(jsonText) {
  return contentUrlName('assets', 'quotes', jsonText);
}

/**
 * 把引语载荷写入产物目录（assets 目录由 cacheBust 排除，不会被二次改名）。
 *
 * @param {string} distDir 产物根目录
 * @param {{url: string, json: string}} quoteFile buildRuntimeConfig 的 quoteFile
 * @returns {string} 写入的绝对路径；无载荷时返回空串
 */
function writeQuotePayload(distDir, quoteFile) {
  if (!quoteFile || typeof quoteFile.url !== 'string' || typeof quoteFile.json !== 'string') return '';
  const file = path.join(distDir, quoteFile.url.replace(/^\//, ''));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomicSync(file, quoteFile.json, 'utf-8');
  return file;
}

module.exports = { buildRuntimeConfig, configUrlName, quoteUrlName, writeQuotePayload, CRITICAL_MAX_BYTES };

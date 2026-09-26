// robots.js — sitemap/robots 相关纯函数（无 IO，便于单测与 build.js 复用）。
// 职责：
//   1. buildSitemapUrls() — 依站点的语言配置生成 sitemap 的完整 URL 列表。
//      多语言站点每个语言一份 sitemap（/zh/sitemap.xml、/en/sitemap.xml），
//      robots.txt 的 Sitemap 行与 pingSearchEngines 均消费本函数，避免各自拼路径。
//   2. encodeLoc() — sitemap <loc> 的 RFC 3986 编码：中文/空格等非 ASCII 字符
//      经 WHATWG URL 规范化转为 percent-encoding，斜杠与协议保持不变。
//   3. toSitemapLastmod() — 将文章日期转为 ISO 8601（RFC 3339）UTC 字符串；
//      无法解析的值返回 null，调用方应省略该行（sitemap 允许缺省 lastmod）。
'use strict';

// 生成 sitemap 完整 URL 列表。
// 参数（对象）：
//   baseUrl        站点根地址（如 https://synapse.dev，自动去除尾部斜杠；为空返回 []）
//   sitemapPath    sitemap 路径（如 /sitemap.xml，自动规范为单个前导斜杠）
//   languages      语言代码数组（如 ['zh','en']）；长度 <=1 或缺失时输出根路径
//   defaultLanguage 语言列表缺失时的兜底语言（仅用于语义表达；单语言输出根路径，
//                 因为站点语言前缀仅在多语言模式下存在）
// 返回：去重后的 URL 字符串数组（保持出现顺序）。
// 边界：baseUrl 为空 → []（调用方负责告警）；重复语言 → 去重。
function buildSitemapUrls(opts) {
  const o = opts || {};
  const base = String(o.baseUrl || '').replace(/\/+$/, '');
  if (!base) return [];
  const sitemapPath = '/' + String(o.sitemapPath || 'sitemap.xml').replace(/^\/+/, '');
  const languages = Array.isArray(o.languages) && o.languages.length
    ? o.languages
    : (o.defaultLanguage ? [o.defaultLanguage] : []);
  if (languages.length <= 1) return [base + sitemapPath];
  const out = [];
  for (const lang of languages) {
    const url = `${base}/${lang}${sitemapPath}`;
    if (!out.includes(url)) out.push(url);
  }
  return out;
}

// sitemap <loc> 编码：用 WHATWG URL 规范化（非 ASCII → percent-encoding）。
// 已是合法 URL 的 ASCII 路径保持原样；解析失败（非法 URL）原样返回，不抛错。
function encodeLoc(fullUrl) {
  const value = String(fullUrl || '');
  if (!value) return value;
  try {
    return new URL(value).toString();
  } catch (err) {
    return value;
  }
}

// 将文章日期转为 ISO 8601 UTC（RFC 3339）。
// 可接受：Date 对象、可被 Date 解析的日期字符串（如 'YYYY-MM-DD'）。
// 返回：ISO 8601 UTC 字符串（如 'YYYY-MM-DDT00:00:00.000Z'）；无效/空值 → null（调用方省略 <lastmod>）。
function toSitemapLastmod(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

module.exports = { buildSitemapUrls, encodeLoc, toSitemapLastmod };

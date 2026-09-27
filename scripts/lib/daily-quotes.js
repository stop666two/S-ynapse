'use strict';
// 每日一言数据层（构建期与单测共用的纯函数）。
//
// 职责：
//   1. 固定标签枚举 QUOTE_TAGS（站点数据文件的标签白名单）。
//   2. normalizeQuoteEntry / normalizeQuoteList：把「字符串 | {text,author} 旧格式 | 完整格式」
//      统一为运行时对象 { text, textEn, author, authorEn, source, sourceEn, tags }。
//   3. applyCount：注入池大小语义（0/缺省 = 全部；>0 = 按稳定顺序取前 N）。
//   4. validateQuotes：对仓库数据文件做结构与质量校验（单测调用；构建期不因外部数据不合法而中止）。
//
// 运行时选择函数（日期索引、换一句、语言回退）位于浏览器模块 js/domains/features/daily-quote.js，
// 经 data URL 导入复用同一份源码进行单测（见 scripts/daily-quote.test.js 与 guard-bypass 先例）。

// 标签枚举：数据文件 tags 字段只允许下列取值（中英对照见 data/quotes.json5 头部注释）。
const QUOTE_TAGS = Object.freeze([
  '哲思',
  '励志',
  '自然',
  '时间',
  '读书',
  '自由',
  '智慧',
  '幽默',
  '情感'
]);

const TAG_SET = new Set(QUOTE_TAGS);

/**
 * 归一化单条引语。字符串形式视为仅含 text；旧对象形式兼容 { text, author }。
 * text 缺失（空串/非字符串）时返回 null（该条被丢弃）。
 *
 * @param {unknown} raw 原始条目
 * @returns {{ text: string, textEn: string, author: string, authorEn: string, source: string, sourceEn: string, tags: string[] } | null}
 */
function normalizeQuoteEntry(raw) {
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? { text, textEn: '', author: '', authorEn: '', source: '', sourceEn: '', tags: [] } : null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const q = /** @type {{ [key: string]: unknown }} */ (raw);
  const text = typeof q.text === 'string' ? q.text.trim() : '';
  if (!text) return null;
  const str = function (value) { return typeof value === 'string' ? value.trim() : ''; };
  const tags = Array.isArray(q.tags)
    ? q.tags.filter(function (tag) { return typeof tag === 'string' && tag.trim() !== ''; }).map(function (tag) { return tag.trim(); })
    : [];
  return {
    text,
    textEn: str(q.textEn),
    author: str(q.author),
    authorEn: str(q.authorEn),
    source: str(q.source),
    sourceEn: str(q.sourceEn),
    tags
  };
}

/**
 * 归一化引语列表；丢弃空条目。
 *
 * @param {unknown} list 原始数组
 * @returns {Array<ReturnType<typeof normalizeQuoteEntry>>} 归一化后的非空条目
 */
function normalizeQuoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const entry = normalizeQuoteEntry(raw);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * 注入池大小语义：
 *   - count 缺省 / 0 / 非法值 → 全部条目（历史 count:7 的默认已改为 0=全部）；
 *   - count > 0 的整数 → 按数据顺序取前 N（稳定顺序，向后兼容旧配置）。
 *
 * @param {Array<unknown>} list 归一化后的引语列表
 * @param {unknown} count 配置值
 * @returns {Array<unknown>} 注入池
 */
function applyCount(list, count) {
  const items = Array.isArray(list) ? list : [];
  const n = Number(count);
  if (!isFinite(n) || n <= 0) return items.slice();
  return items.slice(0, Math.floor(n));
}

/**
 * 校验数据文件（仓库 canonical 数据用；外部自定义文件仅需通过 normalize 即可）。
 * 返回问题清单与统计信息，不抛错、不修改入参。
 *
 * @param {unknown} list 原始数组（未经归一化，内部自行归一化）
 * @returns {{ issues: string[], stats: { total: number, tagCounts: Record<string, number>, zhCount: number, enCount: number, taggedCount: number } }}
 */
function validateQuotes(list) {
  const entries = normalizeQuoteList(list);
  const issues = [];
  /** @type {Record<string, number>} */
  const tagCounts = {};
  for (const tag of QUOTE_TAGS) tagCounts[tag] = 0;
  const seen = new Map();
  let zhCount = 0;
  let enCount = 0;
  let taggedCount = 0;
  for (const entry of entries) {
    const hasCjk = /[\u3400-\u9fff]/.test(entry.text);
    if (hasCjk) zhCount += 1; else enCount += 1;
    if (!entry.textEn) issues.push('缺少 textEn: ' + entry.text.slice(0, 20));
    if (!entry.source) issues.push('缺少 source: ' + entry.text.slice(0, 20));
    if (!entry.sourceEn) issues.push('缺少 sourceEn: ' + entry.text.slice(0, 20));
    if (entry.author && !entry.authorEn) issues.push('有 author 但缺 authorEn: ' + entry.text.slice(0, 20));
    if (!entry.author && entry.authorEn) issues.push('有 authorEn 但缺 author: ' + entry.text.slice(0, 20));
    if (!entry.tags.length) issues.push('缺少 tags: ' + entry.text.slice(0, 20));
    taggedCount += entry.tags.length;
    for (const tag of entry.tags) {
      if (!TAG_SET.has(tag)) issues.push('未知标签 "' + tag + '": ' + entry.text.slice(0, 20));
      else tagCounts[tag] += 1;
    }
    if (seen.has(entry.text)) issues.push('text 重复: ' + entry.text.slice(0, 20));
    else seen.set(entry.text, true);
  }
  return { issues, stats: { total: entries.length, tagCounts, zhCount, enCount, taggedCount } };
}

module.exports = { QUOTE_TAGS, normalizeQuoteEntry, normalizeQuoteList, applyCount, validateQuotes };

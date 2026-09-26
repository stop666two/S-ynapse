'use strict';

// 压缩增强步骤的纯装配逻辑（scripts/build/minify.js 消费，单测 scripts/compression-pipeline.test.js 覆盖）。
// 基线选项与增强选项分离：默认配置下 buildHtmlMinifyOptions 的装配结果与既有硬编码选项逐字段一致，
// 保证「默认态产物字节不变」；仅显式开启 aggressive 时才叠加实验性选项。
// 增强计划（compressionEnhancementPlan）同时作为 C3（CSS 合并去重）与 C4（JS 混淆）的配置接口。

const { isExcluded, normalizePath } = require('./compression-config');

// minify-html 基线选项：与引入压缩配置前 scripts/build/minify.js 的硬编码值保持一致，
// 默认配置下不得改变产物字节（以构建冒烟的双态对照与哈希等价门禁证明）。
const HTML_MINIFY_BASELINE_OPTIONS = Object.freeze({
  keep_comments: false,
  minify_js: true,
  minify_css: true,
  minify_doctype: false,
  keep_html_and_head_opening_tags: true,
  keep_closing_tags: true,
  preserve_brace_template_syntax: true
});

// minify-html 激进选项（html.aggressive=true）：全部来自 @minify-html/node 0.18.1 的真实配置项。
// keep_closing_tags=false 省略可选闭合标签；keep_html_and_head_opening_tags=false 省略无属性开标签；
// allow_noncompliant_unquoted_attribute_values / allow_removing_spaces_between_attributes 折叠属性引号与间隔；
// 其余为 DOCTYPE / bang / 处理指令移除。需经无头门禁（C5）裁决后长期开启。
const HTML_MINIFY_AGGRESSIVE_OPTIONS = Object.freeze({
  minify_doctype: true,
  keep_html_and_head_opening_tags: false,
  keep_closing_tags: false,
  allow_optimal_entities: true,
  allow_noncompliant_unquoted_attribute_values: true,
  allow_removing_spaces_between_attributes: true,
  remove_bangs: true,
  remove_processing_instructions: true
});

/**
 * 装配 minify-html 选项对象。
 * @param {{ aggressive?: boolean, removeComments?: boolean }} [options]
 *   aggressive=true 叠加 HTML_MINIFY_AGGRESSIVE_OPTIONS；
 *   removeComments=false 时保留 HTML 注释（默认 true，与基线 keep_comments=false 一致）。
 * @returns {object} 新的选项对象（不修改基线常量）
 */
function buildHtmlMinifyOptions(options) {
  const opts = options || {};
  const aggressive = opts.aggressive === true;
  const removeComments = opts.removeComments !== false;
  return Object.assign({}, HTML_MINIFY_BASELINE_OPTIONS, { keep_comments: !removeComments },
    aggressive ? HTML_MINIFY_AGGRESSIVE_OPTIONS : null);
}

/**
 * 判断 JSON 文本是否需要去空白：仅「含换行/缩进」的文件进入重写流程，
 * 已是紧凑单行的文件原样跳过（不解析、不重排）。
 * @param {string} text
 * @returns {boolean}
 */
function needsJsonCompaction(text) {
  return /[\r\n]/.test(String(text == null ? '' : text));
}

/**
 * JSON 去空白：JSON.parse → JSON.stringify。
 * 输出始终是合法 JSON；非数值键保持插入顺序；Unicode 内容原样保留（不做 \uXXXX 转义）。
 * 已是紧凑单行时直接返回原文（changed=false）；非法 JSON 抛出 SyntaxError，由调用方保留原文件。
 * @param {string} text
 * @returns {{ text: string, changed: boolean }}
 * @throws {TypeError} 入参非字符串
 * @throws {SyntaxError} 需要压缩但内容不是合法 JSON
 */
function compactJsonText(text) {
  if (typeof text !== 'string') throw new TypeError('compactJsonText 需要字符串入参');
  if (!needsJsonCompaction(text)) return { text, changed: false };
  const output = JSON.stringify(JSON.parse(text));
  return { text: output, changed: output !== text };
}

// 内容寻址的运行时配置：assets/config.<hash>.json，文件名由 JSON 内容哈希派生
// （scripts/lib/config-split.js configUrlName），HTML 以该名称引用；任何重写都会破坏引用一致性。
// 该文件写入时即为 JSON.stringify 紧凑单行，本就无需去空白。
const CONTENT_ADDRESSED_JSON = /^assets\/config\.[^/]+\.json$/;

/**
 * 判断 dist 产物中的 JSON 是否跳过压缩，返回原因（空串 = 需要处理）。
 * 顺序：豁免名单（含 vendor / media / 报告等）→ 内容寻址的 assets/config.*.json。
 * @param {string} relPath 相对 dist 根的路径（可用 \ 或 / 分隔）
 * @param {string[]} [patterns] 豁免 glob 列表（compression.exclude）
 * @returns {'' | 'excluded' | 'content-addressed'}
 */
function jsonSkipReason(relPath, patterns) {
  const normalized = normalizePath(relPath);
  if (isExcluded(normalized, patterns)) return 'excluded';
  if (CONTENT_ADDRESSED_JSON.test(normalized)) return 'content-addressed';
  return '';
}

/**
 * 计算本次构建的增强计划：只有压缩阶段启用（非 serve/watch 且总开关开启）时各步骤才为 true。
 * CSS / JS 字段为后续实现（C3/C4）的配置接口，装配与消费分离。
 * @param {object} compression compression.json5 的合并配置
 * @param {boolean} active compressionActive() 的结果（serve/watch 强制 false）
 * @returns {object} 计划对象；exclude 为透传的豁免名单
 */
function compressionEnhancementPlan(compression, active) {
  const cfg = compression && typeof compression === 'object' ? compression : {};
  const html = cfg.html || {};
  const css = cfg.css || {};
  const jsCfg = cfg.js || {};
  const obfuscate = jsCfg.obfuscate || {};
  const json = cfg.json || {};
  const verify = cfg.verify || {};
  const on = active === true && cfg.enabled !== false;
  return {
    active: on,
    htmlAggressive: on && html.enabled !== false && html.aggressive === true,
    htmlRemoveComments: html.enabled === false ? true : html.removeComments !== false,
    cssMergeInlineStyles: on && css.enabled !== false && css.mergeInlineStyles !== false,
    cssDedupe: on && css.enabled !== false && css.dedupe !== false,
    jsObfuscate: on && jsCfg.enabled !== false && jsCfg.minify !== false && obfuscate.enabled === true,
    jsObfuscatePreset: obfuscate.preset || 'medium',
    jsObfuscateSeed: Number.isInteger(obfuscate.seed) && obfuscate.seed > 0 ? obfuscate.seed : 0,
    jsonCompact: on && json.enabled !== false,
    verifyHeadless: verify.headless !== false,
    fallbackOnFailure: verify.fallbackOnFailure !== false,
    exclude: Array.isArray(cfg.exclude) ? cfg.exclude : []
  };
}

module.exports = {
  HTML_MINIFY_BASELINE_OPTIONS,
  HTML_MINIFY_AGGRESSIVE_OPTIONS,
  buildHtmlMinifyOptions,
  needsJsonCompaction,
  compactJsonText,
  jsonSkipReason,
  compressionEnhancementPlan
};

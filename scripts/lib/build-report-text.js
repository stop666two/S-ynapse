'use strict';

// dist/report.txt（构建摘要）的纯文本渲染：输入为构建期收集的结构化数据，输出固定段落的
// 纯文本。本模块不触碰文件系统；所有字段缺失一律按「未记录 / 未运行 /（无）」容错。
// 构建接线见 scripts/build.js 报告阶段（写入 dist/report.txt；位于压缩与 cacheBust 之后，
// 天然豁免 compression.exclude；预算数据来自 scripts/build/report.js 的 checkPerfBudget）。

const { summarizeFailures } = require('./compression-verify');

// 压缩阶段失败（进入 [压缩统计] 的失败清单）；其余阶段的阻断失败归入 [告警] 段并以 [阻断] 前缀标注。
const COMPRESSION_FAILURE_STAGES = ['minify', 'compression', 'compression-verify', 'cachebust'];

const PHASE_LABELS = {
  config: '配置加载与校验',
  preflight: '内容预校验',
  pages: '页面生成',
  media: '媒体处理',
  og: 'OG 图生成',
  compression: '压缩增强（含无头验证）',
  cacheBust: '缓存指纹（cacheBust）',
  pwa: 'PWA 生成',
  report: '报告生成',
  other: '其它构建步骤（打包/索引/头等）'
};

const CATEGORY_LABELS = { html: 'HTML', css: 'CSS', js: 'JS', json: 'JSON' };

const NOT_RECORDED = '未记录';

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return NOT_RECORDED;
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return NOT_RECORDED;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(2) + 'MB';
}

// 体积变化：before/after 均为字节数；返回「节省 X%（或 增加 X%）」，before 不可用时返回「未记录」。
function reductionValue(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return null;
  return ((before - after) / before) * 100;
}

function formatReduction(before, after) {
  const pct = reductionValue(before, after);
  if (pct === null) return NOT_RECORDED;
  return pct >= 0 ? '节省 ' + pct.toFixed(2) + '%' : '增加 ' + Math.abs(pct).toFixed(2) + '%';
}

function formatTarget(before, after, targetPct) {
  const pct = reductionValue(before, after);
  if (pct === null) return NOT_RECORDED + '（目标 ≥ ' + targetPct.toFixed(2) + '%）';
  return formatReduction(before, after) + '（目标 ≥ ' + targetPct.toFixed(2) + '%，'
    + (pct >= targetPct ? '达标' : '未达') + '）';
}

function formatCategoryLine(key, category) {
  const label = CATEGORY_LABELS[key] || key;
  if (!category || !Number.isFinite(category.filesAfter)) return label + ': ' + NOT_RECORDED;
  const counts = '文件 ' + category.filesAfter
    + '（变更 ' + category.changed + ' / 新增 ' + category.added + ' / 移除 ' + category.removed + '）';
  const raw = 'raw ' + formatBytes(category.rawBefore) + ' → ' + formatBytes(category.rawAfter)
    + '（' + formatReduction(category.rawBefore, category.rawAfter) + '）';
  const gzip = 'gzip ' + formatBytes(category.gzipBefore) + ' → ' + formatBytes(category.gzipAfter)
    + '（' + formatReduction(category.gzipBefore, category.gzipAfter) + '）';
  const rest = '跳过 ' + category.skipped + '；豁免 ' + category.exempt;
  return label + ': ' + counts + '；' + raw + '；' + gzip + '；' + rest;
}

function renderPhaseSection(phases) {
  const list = Array.isArray(phases) ? phases.filter((p) => p && typeof p.key === 'string') : [];
  if (list.length === 0) return [NOT_RECORDED];
  return list.map((phase) => '  ' + (PHASE_LABELS[phase.key] || phase.key) + ': ' + formatDuration(phase.ms));
}

function renderVerifySection(verify) {
  const input = verify && typeof verify === 'object' ? verify : {};
  if (input.ran !== true) {
    return ['  状态: 本轮未运行（压缩增强未启用、verify.headless=false 或 serve/watch）'];
  }
  const report = input.report && typeof input.report === 'object' ? input.report : null;
  if (!report) {
    return ['  状态: 结果文件缺失（.cache/compression-verify/last.json 未产出）'];
  }
  if (report.status === 'passed') {
    const pages = Array.isArray(report.pages) ? report.pages.length : 0;
    const released = report.portsReleased === false ? '异常' : '正常';
    return ['  状态: 通过；断言页数 ' + pages + '；验证耗时 ' + formatDuration(report.durationsMs)
      + '；端口释放 ' + released + '；检查时间(UTC) ' + (report.checkedAt || NOT_RECORDED)];
  }
  if (report.status === 'skipped') {
    return ['  状态: 跳过（' + (report.reason || '原因未记录') + '）'];
  }
  const lines = ['  状态: 失败；失败摘要: ' + summarizeFailures(report.failures)];
  const fallback = report.fallback;
  if (fallback && fallback.applied === true) {
    lines.push('  回退: 已应用（恢复 ' + fallback.restored + ' / 移除 ' + fallback.removed
      + ' / 逐字节复核 ' + (fallback.bytesIdentical ? '一致' : '不一致') + '）');
  } else if (fallback && fallback.applied === false) {
    lines.push('  回退: 失败（' + (fallback.error || '原因未记录') + '）');
  } else {
    lines.push('  回退: 未触发（或压缩产物已保留）');
  }
  return lines;
}

function renderCompressionSection(compression, failures) {
  const stats = compression && typeof compression === 'object' ? compression : {};
  const lines = [];
  lines.push('  增强步骤: ' + (stats.active === true ? '启用' : stats.active === false ? '关闭' : NOT_RECORDED));
  for (const key of ['html', 'css', 'js', 'json']) {
    lines.push('  ' + formatCategoryLine(key, stats.categories && stats.categories[key]));
  }
  const compressionFailures = (Array.isArray(failures) ? failures : [])
    .filter((entry) => entry && COMPRESSION_FAILURE_STAGES.includes(entry.stage));
  if (compressionFailures.length === 0) {
    lines.push('  失败:（无）');
  } else {
    lines.push('  失败: ' + compressionFailures.length + ' 项');
    for (const entry of compressionFailures) lines.push('    - [' + entry.stage + '] ' + entry.message);
  }
  return lines;
}

function renderWarningsSection(warnings, failures) {
  const lines = [];
  const list = Array.isArray(warnings) ? warnings : [];
  if (list.length === 0) lines.push('  （无）');
  for (const entry of list) {
    lines.push('  - [' + (entry && entry.stage ? entry.stage : '?') + '] ' + (entry && entry.message ? entry.message : ''));
  }
  const otherFatal = (Array.isArray(failures) ? failures : [])
    .filter((entry) => entry && !COMPRESSION_FAILURE_STAGES.includes(entry.stage));
  for (const entry of otherFatal) {
    lines.push('  - [阻断][' + entry.stage + '] ' + entry.message);
  }
  return lines;
}

function renderBudgetSection(budget, compression, totalMs) {
  const lines = [];
  const perf = budget && typeof budget === 'object' ? budget : null;
  if (!perf || !Array.isArray(perf.items) || perf.items.length === 0) {
    lines.push('  perfBudget 门禁: ' + NOT_RECORDED + '（未启用或未收集）');
  } else {
    lines.push('  perfBudget 门禁（warnOnly=' + (perf.warnOnly === false ? 'false' : 'true') + '）:');
    for (const item of perf.items) {
      const text = (item.ok ? 'OK  ' : 'OVER') + ' ' + item.label + ': '
        + (item.key === 'requests' ? String(Math.round(item.value)) : item.value.toFixed(1) + 'KB')
        + ' / ' + (item.key === 'requests' ? String(Math.round(item.limit)) : item.limit.toFixed(1) + 'KB');
      lines.push('    ' + text);
    }
    lines.push('  结论: ' + (perf.ok ? '全部达标' : '存在超限项' + (perf.warnOnly === false ? '（阻断构建）' : '（仅提醒）')));
  }
  const htmlCat = compression && compression.categories ? compression.categories.html : null;
  const jsCat = compression && compression.categories ? compression.categories.js : null;
  lines.push('  压缩目标（现状值；最终口径待 C8 对照构建核定）:');
  lines.push('    HTML gzip: ' + (htmlCat ? formatTarget(htmlCat.gzipBefore, htmlCat.gzipAfter, 10) : NOT_RECORDED + '（目标 ≥ 10.00%）'));
  lines.push('    JS gzip（混淆关态）: ' + (jsCat ? formatTarget(jsCat.gzipBefore, jsCat.gzipAfter, 20) : NOT_RECORDED + '（目标 ≥ 20.00%）')
    + '；打包态由 esbuild 执行压缩，本阶段节省接近 0 属预期');
  lines.push('    构建总耗时: ' + formatDuration(totalMs) + '（目标 ≤ 8.00s）');
  return lines;
}

/**
 * 渲染 dist/report.txt 全文。
 * @param {object} [input]
 * @param {string} [input.generatedAt] 生成时间（UTC ISO 8601）
 * @param {number} [input.totalMs] 构建总耗时（毫秒）
 * @param {Array<{key: string, ms: number}>} [input.phases] 阶段耗时（顺序即渲染顺序）
 * @param {object} [input.compression] 压缩统计（scripts/build/minify.js minifyAll 的返回值）
 * @param {{ran: boolean, report: object|null}} [input.verify] 无头验证摘要
 * @param {Array<{stage: string, message: string}>} [input.warnings] 非阻断告警
 * @param {Array<{stage: string, message: string}>} [input.failures] 阻断失败（压缩阶段自动归入压缩统计）
 * @param {object} [input.budget] evaluatePerfBudget 的结果（追加 warnOnly 字段）
 * @returns {string} 以 \n 分隔的纯文本（末尾含换行）
 */
function renderBuildReportText(input) {
  const data = input && typeof input === 'object' ? input : {};
  const lines = [];
  lines.push('S-YNAPSE 构建摘要（report.txt）');
  lines.push('生成时间(UTC): ' + (data.generatedAt || NOT_RECORDED));
  lines.push('总耗时: ' + formatDuration(data.totalMs));
  lines.push('压缩增强: ' + (data.compression && data.compression.active === true ? '启用'
    : data.compression && data.compression.active === false ? '关闭' : NOT_RECORDED));
  lines.push('');
  lines.push('[阶段耗时]');
  lines.push(...renderPhaseSection(data.phases));
  lines.push('');
  lines.push('[压缩统计]');
  lines.push(...renderCompressionSection(data.compression, data.failures));
  lines.push('');
  lines.push('[无头验证]');
  lines.push(...renderVerifySection(data.verify));
  lines.push('');
  lines.push('[告警]');
  lines.push(...renderWarningsSection(data.warnings, data.failures));
  lines.push('');
  lines.push('[预算与目标]');
  lines.push(...renderBudgetSection(data.budget, data.compression, data.totalMs));
  lines.push('');
  return lines.join('\n');
}

module.exports = { renderBuildReportText, formatDuration, formatBytes, formatReduction, PHASE_LABELS };

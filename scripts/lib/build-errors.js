'use strict';

/**
 * 构建错误收集器：把构建过程中各阶段的失败集中记录，供构建尾部统一决定退出码。
 * 用法：const collector = createBuildErrorCollector(); collector.add('feed', 'xxx failed');
 * 非阻断记录：collector.add('compression-verify', 'xxx（已回退）', { fatal: false })——
 * 进入 entries 供报告与日志展示，但不影响 hasErrors / resolveExitCode（回退后构建仍算成功）。
 * 不可降级记录：collector.add('slug', 'xxx', { critical: true })——内容完整性问题（slug 身份类），
 * 即使 --allow-degraded 也必须阻断构建（hasCritical 参与 resolveExitCode）。
 * 尾部：process.exitCode = resolveExitCode(collector, { allowDegraded: ALLOW_DEGRADED });
 */
function createBuildErrorCollector() {
  const entries = [];
  return {
    add(stage, message, options) {
      entries.push({
        stage: String(stage),
        message: String(message),
        fatal: !(options && options.fatal === false),
        critical: !!(options && options.critical === true)
      });
    },
    get entries() {
      return entries.map((e) => ({ stage: e.stage, message: e.message, fatal: e.fatal, critical: e.critical }));
    },
    get fatalEntries() {
      return entries.filter((e) => e.fatal !== false).map((e) => ({ stage: e.stage, message: e.message, fatal: e.fatal, critical: e.critical }));
    },
    get warningEntries() {
      return entries.filter((e) => e.fatal === false).map((e) => ({ stage: e.stage, message: e.message, fatal: e.fatal, critical: e.critical }));
    },
    get criticalEntries() {
      return entries.filter((e) => e.critical === true).map((e) => ({ stage: e.stage, message: e.message, fatal: e.fatal, critical: e.critical }));
    },
    get hasErrors() {
      return entries.some((e) => e.fatal !== false);
    },
    get hasWarnings() {
      return entries.some((e) => e.fatal === false);
    },
    get hasCritical() {
      return entries.some((e) => e.critical === true && e.fatal !== false);
    }
  };
}

/**
 * 决定构建退出码：有失败且未开启降级模式时返回 1；降级模式只豁免非 critical 失败，
 * 内容完整性问题（critical）无论降级与否都返回 1。
 * @param {{hasErrors: boolean, hasCritical: boolean}} collector createBuildErrorCollector() 的返回值
 * @param {{allowDegraded?: boolean}} [options] --allow-degraded 时为 true（本地预览逃生）
 * @returns {0|1}
 */
function resolveExitCode(collector, options) {
  const opts = options || {};
  if (!collector || !collector.hasErrors) return 0;
  if (opts.allowDegraded && !collector.hasCritical) return 0;
  return 1;
}

/**
 * 将失败条目渲染为多行文本（供构建尾部打印）。
 * critical 条目以 [stage/critical] 前缀标注，解释其为何不受 --allow-degraded 影响。
 * @param {Array<{stage: string, message: string, critical?: boolean}>} entries
 * @returns {string} 空数组返回空字符串
 */
function formatFailures(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return '';
  const lines = list.map((e) => '  - [' + e.stage + (e.critical ? '/critical' : '') + '] ' + e.message);
  return '构建失败 ' + list.length + ' 项：\n' + lines.join('\n');
}

/**
 * 将非阻断告警条目渲染为多行文本（结构与 formatFailures 一致，仅标题语义不同）。
 * @param {Array<{stage: string, message: string}>} entries
 * @returns {string} 空数组返回空字符串
 */
function formatWarnings(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return '';
  const lines = list.map((e) => '  - [' + e.stage + '] ' + e.message);
  return '构建告警 ' + list.length + ' 项（不阻断）：\n' + lines.join('\n');
}

module.exports = { createBuildErrorCollector, resolveExitCode, formatFailures, formatWarnings };

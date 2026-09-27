'use strict';

/**
 * 构建错误收集器：把构建过程中各阶段的失败集中记录，供构建尾部统一决定退出码。
 * 用法：const collector = createBuildErrorCollector(); collector.add('feed', 'xxx failed');
 * 非阻断记录：collector.add('compression-verify', 'xxx（已回退）', { fatal: false })——
 * 进入 entries 供报告与日志展示，但不影响 hasErrors / resolveExitCode（回退后构建仍算成功）。
 * 尾部：process.exitCode = resolveExitCode(collector, { allowDegraded: ALLOW_DEGRADED });
 */
function createBuildErrorCollector() {
  const entries = [];
  return {
    add(stage, message, options) {
      entries.push({
        stage: String(stage),
        message: String(message),
        fatal: !(options && options.fatal === false)
      });
    },
    get entries() {
      return entries.map((e) => ({ stage: e.stage, message: e.message, fatal: e.fatal }));
    },
    get fatalEntries() {
      return entries.filter((e) => e.fatal !== false).map((e) => ({ stage: e.stage, message: e.message, fatal: e.fatal }));
    },
    get warningEntries() {
      return entries.filter((e) => e.fatal === false).map((e) => ({ stage: e.stage, message: e.message, fatal: e.fatal }));
    },
    get hasErrors() {
      return entries.some((e) => e.fatal !== false);
    },
    get hasWarnings() {
      return entries.some((e) => e.fatal === false);
    }
  };
}

/**
 * 决定构建退出码：有失败且未开启降级模式时返回 1，否则 0。
 * @param {{hasErrors: boolean}} collector createBuildErrorCollector() 的返回值
 * @param {{allowDegraded?: boolean}} [options] --allow-degraded 时为 true（本地预览逃生）
 * @returns {0|1}
 */
function resolveExitCode(collector, options) {
  const opts = options || {};
  if (!collector || !collector.hasErrors) return 0;
  return opts.allowDegraded ? 0 : 1;
}

/**
 * 将失败条目渲染为多行文本（供构建尾部打印）。
 * @param {Array<{stage: string, message: string}>} entries
 * @returns {string} 空数组返回空字符串
 */
function formatFailures(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return '';
  const lines = list.map((e) => '  - [' + e.stage + '] ' + e.message);
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

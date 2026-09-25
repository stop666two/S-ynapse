'use strict';

/**
 * 构建错误收集器：把构建过程中各阶段的失败集中记录，供构建尾部统一决定退出码。
 * 用法：const collector = createBuildErrorCollector(); collector.add('feed', 'xxx failed');
 * 尾部：process.exitCode = resolveExitCode(collector, { allowDegraded: ALLOW_DEGRADED });
 */
function createBuildErrorCollector() {
  const entries = [];
  return {
    add(stage, message) {
      entries.push({ stage: String(stage), message: String(message) });
    },
    get entries() {
      return entries.map((e) => ({ stage: e.stage, message: e.message }));
    },
    get hasErrors() {
      return entries.length > 0;
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

module.exports = { createBuildErrorCollector, resolveExitCode, formatFailures };

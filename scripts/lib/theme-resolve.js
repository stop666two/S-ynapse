'use strict';
// 构建期主题合成（唯一事实源）：内置预设 → presetOverrides → 手工颜色（preset 为空时）。
// build（scripts/build/config.js）与 OG 图片生成（scripts/generate-og.js）共用同一实现，
// 避免两处各自读取 theme.json5 造成站点与 OG 配色分歧。

const { resolveTheme } = require('./theme-presets');

/**
 * 解析最终主题（颜色 / 暗色 / 生效预设）。
 *
 * @param {object} theme theme.json5 的原始主题对象（可为空）
 * @returns {{colors: object, darkMode: object, appliedPreset: string|null, warnings: string[]}}
 *   colors 为亮色 13 色，darkMode.colors 为暗色 13 色；appliedPreset 形如 '经典蓝(classic-blue)'。
 */
function resolveBuildTheme(theme) {
  const input = theme && typeof theme === 'object' ? theme : {};
  const res = resolveTheme(input);
  return {
    colors: res.colors,
    darkMode: res.darkMode,
    appliedPreset: res.appliedPreset,
    warnings: res.warnings
  };
}

module.exports = { resolveBuildTheme };

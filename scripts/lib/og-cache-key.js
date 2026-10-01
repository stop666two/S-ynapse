'use strict';
// OG 缓存指纹（内容寻址键的一部分）：任何改变 PNG 字节的配置都必须进入指纹，
// 否则「改了配置但复用旧图」。palette 由 resolveBuildTheme 的最终色板与模式派生；
// appliedPreset/presetOverrides 记录配色来源，coverFit/overlay/useCover 控制封面合成路径。
const { configFingerprint } = require('./asset-cache');

/**
 * 构造 OG 生成指纹。
 *
 * @param {object} input 指纹输入（全部字段参与散列，顺序固定）：
 *   format/ext/quality 输出编码；width/height/fontScale 画布与字号；
 *   style/palette/paletteMode 模板样式与色板；colors 最终主/辅色；
 *   siteTitle/siteUrl 文本层；appliedPreset/presetOverrides 主题预设来源；
 *   coverFit/overlay/useCover 封面合成参数。
 * @returns {string} 十六进制指纹
 */
function buildOgFingerprint(input) {
  const it = input || {};
  return configFingerprint([
    it.format, it.ext, it.quality,
    it.width, it.height, it.fontScale,
    it.style, it.palette, it.paletteMode,
    it.colors,
    it.siteTitle, it.siteUrl,
    it.appliedPreset, it.presetOverrides, it.coverFit, it.overlay, it.useCover
  ]);
}

module.exports = { buildOgFingerprint };

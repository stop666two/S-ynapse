'use strict';

// OG 封面图输出格式解析（features.ogImage.format / jpegQuality 的唯一消费入口）。
// 设计约束：
//   - 默认 png：与历史产物、社交平台缓存、既有文档说明保持一致；
//   - jpeg / jpg 大小写不敏感，统一归一为 'jpeg'（sharp 格式名），扩展名固定 'jpg'（社交平台惯例）；
//   - jpegQuality 仅对 jpeg 生效：合法范围 1–100（越界/非数字回退 82），四舍五入取整；
//   - png 模式下 quality 恒为 null（调用方据此跳过 mozjpeg 参数）。
const DEFAULT_JPEG_QUALITY = 82;

function resolveOgFormat(ogImageCfg) {
  const cfg = ogImageCfg && typeof ogImageCfg === 'object' ? ogImageCfg : {};
  const raw = typeof cfg.format === 'string' ? cfg.format.trim().toLowerCase() : '';
  const isJpeg = raw === 'jpeg' || raw === 'jpg';
  const q = Number(cfg.jpegQuality);
  const quality = Number.isFinite(q) && q >= 1 && q <= 100 ? Math.round(q) : DEFAULT_JPEG_QUALITY;
  return isJpeg
    ? { format: 'jpeg', ext: 'jpg', quality: quality }
    : { format: 'png', ext: 'png', quality: null };
}

module.exports = { resolveOgFormat, DEFAULT_JPEG_QUALITY };

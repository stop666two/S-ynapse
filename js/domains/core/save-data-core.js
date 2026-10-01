// 省流模式纯函数核心：配置归一化、自动/手动触发决策、图片最小分辨率变体选择与系统字体栈常量。
// 被 js/domains/core/save-data.js（运行时决策）、js/domains/core/image-lazy.js（图片重写）
// 与 scripts/save-data.test.js（单测）共用；scripts/lib/feature-wiring.js 的 saveDataModeConfig
// 与本文件 resolveSaveDataConfig 同语义（单测对拍防漂移），templates/layout.ejs 首屏早置脚本
// 按同一存储键与 '1'/'0' 取值读取手动偏好（同步置类避免闪烁）。

export const DEFAULT_STORAGE_KEY = 'ss-save-data';
export const PREF_ON = '1';
export const PREF_OFF = '0';

// 关闭网页字体后的系统栈：与 theme.json5 → fontFamily/fontFamilyMono 的兜底段一致，
// 仅替换 --ff / --ff-d / --ff-h / --ff-mono（--ff-num 派生自前两者，自动跟随）。
export const SYSTEM_FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
export const SYSTEM_MONO_STACK = 'Menlo,Consolas,monospace';

// 配置归一化：enabled/auto/manual 默认 true；storageKey 空值回退默认键；
// degrade 各项默认 true——唯一关闭方式为显式 false，与 features.json5 逐项对应；
// degrade.lowResMaxWidthPx 非负（0 = 不限制，历史行为；非法/负数回退 0）。
export function resolveSaveDataConfig(raw) {
  var S = raw || {};
  var D = S.degrade || {};
  var key = S.storageKey == null ? '' : String(S.storageKey).trim();
  var maxW = Number(D.lowResMaxWidthPx);
  return {
    enabled: S.enabled !== false,
    auto: S.auto !== false,
    manual: S.manual !== false,
    storageKey: key || DEFAULT_STORAGE_KEY,
    degrade: {
      animations: D.animations !== false,
      particles: D.particles !== false,
      lowResImages: D.lowResImages !== false,
      lazyAggressive: D.lazyAggressive !== false,
      systemFontsOnly: D.systemFontsOnly !== false,
      lowResMaxWidthPx: isNaN(maxW) || maxW < 0 ? 0 : Math.floor(maxW)
    }
  };
}

// 手动偏好解析：接受 localStorage 字符串 '1'/'0' 与布尔/常见字符串形态；
// 无法识别（含 null/undefined/损坏值）返回 null = 尚无显式选择。
export function parseManualPreference(raw) {
  if (raw === true || raw === PREF_ON || raw === 'on' || raw === 'true') return true;
  if (raw === false || raw === PREF_OFF || raw === 'off' || raw === 'false') return false;
  return null;
}

export function serializeManualPreference(value) {
  return value ? PREF_ON : PREF_OFF;
}

// 决策矩阵（与首屏早置脚本逐字同语义）：
//   enabled=false                          → 关闭（disabled）
//   manual=true 且存在显式偏好              → 偏好（manual；true=开启、false=关闭，可覆盖自动）
//   auto=true 且 navigator.connection.saveData → 自动（auto）
//   其余                                    → 默认关闭（default）
// manual=false 时忽略存储偏好（开关不存在，不产生不可达状态）。
export function decideSaveData(cfg, connectionSaveData, manualPref) {
  var c = cfg || {};
  if (c.enabled === false) return { active: false, source: 'disabled' };
  var pref = c.manual === false ? null : parseManualPreference(manualPref);
  if (pref === true) return { active: true, source: 'manual' };
  if (pref === false) return { active: false, source: 'manual' };
  if (c.auto !== false && connectionSaveData === true) return { active: true, source: 'auto' };
  return { active: false, source: 'default' };
}

// 变体文件名宽度推断：匹配 `-640.jpg` 与 cache-bust 哈希形态 `-640.53b36a7a57.jpg`；
// 宽度令牌要求 ≥2 位数字，避免把 `test-photo-1.e6d80b0b99.jpg` 这类「名字以 -数字 结尾的
// 原图」误判为宽度 1 的变体（响应式档位实际远大于 1 位）；无法推断返回 null。
const VARIANT_WIDTH_RE = /-(\d{2,})(?:\.[0-9a-f]{6,})?\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i;

export function inferVariantWidth(url) {
  var m = VARIANT_WIDTH_RE.exec(String(url == null ? '' : url));
  return m ? parseInt(m[1], 10) : null;
}

// 候选有效宽度：显式描述符 > URL 宽度令牌 > 已知原图宽度（无令牌候选视为原图）；
// 三者皆无返回 Infinity（参与排序但永远最大）。
function effectiveWidth(url, descriptor, naturalWidth) {
  if (descriptor != null) return descriptor;
  var token = inferVariantWidth(url);
  if (token != null) return token;
  return naturalWidth > 0 ? naturalWidth : Infinity;
}

// 从候选集选最小分辨率 URL：候选为字符串或 { url, width }（width 可为 null）；
// 宽度相同保持先出现者；空集返回 ''。相同宽度时自动处理为稳定顺序。
// maxWidth > 0 时优先在宽度 ≤ maxWidth 的候选中选最小；无满足者回退全量最小（保证可用）。
export function pickSmallestVariant(entries, naturalWidth, maxWidth) {
  var list = Array.isArray(entries) ? entries : [];
  var nat = +naturalWidth > 0 ? +naturalWidth : 0;
  var cap = +maxWidth > 0 ? +maxWidth : Infinity;
  var best = '', bestW = Infinity;
  var capped = '', cappedW = Infinity;
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (!item) continue;
    var url = typeof item === 'string' ? item : String(item.url == null ? '' : item.url);
    if (!url) continue;
    var descriptor = typeof item === 'object' && item.width != null ? +item.width : null;
    var w = effectiveWidth(url, descriptor, nat);
    if (best === '' || w < bestW) { best = url; bestW = w; }
    if (w <= cap && (capped === '' || w < cappedW)) { capped = url; cappedW = w; }
  }
  return capped !== '' ? capped : best;
}

// srcset 解析：`url 640w` / `url 2x`（2x 无像素宽，按 null 处理）/ 裸 URL；
// 忽略空段与无 URL 段，保留出现顺序。
export function parseSrcset(srcset) {
  var out = [];
  var parts = String(srcset == null ? '' : srcset).split(',');
  for (var i = 0; i < parts.length; i++) {
    var piece = parts[i].trim();
    if (!piece) continue;
    var seg = piece.split(/\s+/);
    var url = seg[0] || '';
    if (!url) continue;
    var width = null;
    var descriptor = seg[1] || '';
    var wm = /^(\d+(?:\.\d+)?)w$/.exec(descriptor);
    if (wm) width = parseFloat(wm[1]);
    out.push({ url: url, width: width });
  }
  return out;
}

// 从 srcset 选最小候选 URL；无法解析时返回 ''（调用方保持原值）。
// maxWidth > 0 时优先选择宽度 ≤ maxWidth 的候选（低清阈值），无满足者回退最小候选。
export function smallestSrcsetUrl(srcset, naturalWidth, maxWidth) {
  return pickSmallestVariant(parseSrcset(srcset), naturalWidth, maxWidth);
}

// 单图最小候选：有 srcset 时按 srcset 选（原图宽度作无令牌候选兜底）；
// 无 srcset 时返回原 src（无候选可降）。maxWidth 语义同 pickSmallestVariant。
export function smallestImageUrl(src, srcset, naturalWidth, maxWidth) {
  var raw = String(src == null ? '' : src);
  var set = String(srcset == null ? '' : srcset).trim();
  if (!set) return raw;
  return smallestSrcsetUrl(set, naturalWidth, maxWidth) || raw;
}

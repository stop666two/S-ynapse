// 主题调色板纯函数核心：token 白名单归一化、颜色校验、覆盖状态净化/合并、
// theme.json5 presetOverrides JSON5 片段序列化。
// 被 js/domains/features/theme-lab.js（运行时）与 scripts/theme-lab.test.js（单测）共用；
// templates/layout.ejs 的首屏早置脚本按同一存储结构读取，颜色合法判定与 isValidColor 一致。

// 白名单 token 规格：id = CSS 变量名（消费方与存储键），key = theme.json5 → colors 同名键（导出用）。
export const TOKEN_SPECS = [
  { id: '--color-p', key: 'primary', zh: '主色', en: 'Primary' },
  { id: '--color-s', key: 'secondary', zh: '辅色', en: 'Secondary' },
  { id: '--color-a', key: 'accent', zh: '强调色', en: 'Accent' },
  { id: '--color-bg', key: 'background', zh: '背景', en: 'Background' },
  { id: '--color-surface', key: 'surface', zh: '卡面', en: 'Surface' },
  { id: '--color-t', key: 'text', zh: '正文', en: 'Text' },
  { id: '--color-ts', key: 'textSecondary', zh: '次要文字', en: 'Secondary text' },
  { id: '--color-tl', key: 'textLight', zh: '弱化文字', en: 'Muted text' },
  { id: '--color-border', key: 'border', zh: '边框', en: 'Border' },
  { id: '--color-hover', key: 'hover', zh: '悬停底', en: 'Hover' },
  { id: '--color-code-bg', key: 'codeBackground', zh: '代码底', en: 'Code background' },
  { id: '--color-code-t', key: 'codeText', zh: '代码字', en: 'Code text' }
];

export const DEFAULT_TOKEN_IDS = TOKEN_SPECS.map(function (spec) { return spec.id; });
export const MIN_TOKENS = 8;
export const MAX_TOKENS = 12;
export const DEFAULT_STORAGE_KEY = 'ss-theme-lab';
export const DEFAULT_EXPORT_NAME = 'theme-overrides.json5';

// 接受的色值：3/4/6/8 位十六进制（#rgb / #rgba / #rrggbb / #rrggbbaa，大小写不敏感）。
// 拒绝关键字、rgb()/hsl()/color-mix() 等无法被 <input type=color> 表达的形式。
// 该模式字符串与 templates/layout.ejs 首屏早置脚本内的内联正则字面量逐字一致（单测对拍防漂移）。
export const COLOR_PATTERN = '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$';
const COLOR_RE = new RegExp(COLOR_PATTERN);

export function tokenSpec(id) {
  for (var i = 0; i < TOKEN_SPECS.length; i++) {
    if (TOKEN_SPECS[i].id === id) return TOKEN_SPECS[i];
  }
  return null;
}

// 面板行文案：en 站取 en 标签（空回退中文），其余取中文。
export function tokenLabel(id, lang) {
  var spec = tokenSpec(id);
  if (!spec) return '';
  return String(lang) === 'en' ? (spec.en || spec.zh) : spec.zh;
}

export function isValidColor(value) {
  return typeof value === 'string' && COLOR_RE.test(value.trim());
}

// 归一化色值：合法则小写去空白返回；非法返回空串（调用方按「未设置」处理）。
export function normalizeColor(value) {
  return isValidColor(value) ? value.trim().toLowerCase() : '';
}

// token 白名单归一化：仅保留已定义变量名、去重保序、封顶 MAX；
// 过滤后不足 MIN 项（含非数组/空数组）回退默认全量清单（保持 8–12 项契约）。
export function resolveTokenIds(raw) {
  var out = [];
  if (Array.isArray(raw)) {
    for (var i = 0; i < raw.length; i++) {
      var id = raw[i] == null ? '' : String(raw[i]).trim();
      if (id && tokenSpec(id) && out.indexOf(id) === -1) out.push(id);
    }
  }
  if (out.length < MIN_TOKENS) return DEFAULT_TOKEN_IDS.slice();
  return out.slice(0, MAX_TOKENS);
}

// 导出文件名白名单化：剔除路径分隔符/保留字符/控制字符；空结果回退默认名。
export function safeExportName(raw) {
  // eslint-disable-next-line no-control-regex -- 有意匹配控制字符：文件名不得携带 NUL–US 段
  var name = String(raw == null ? '' : raw).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim();
  return name || DEFAULT_EXPORT_NAME;
}

// 配置归一化：与 scripts/lib/feature-wiring.js → themeLabConfig 同语义。
export function resolveThemeLabConfig(raw) {
  var T = raw || {};
  var key = T.storageKey == null ? '' : String(T.storageKey).trim();
  return {
    enabled: T.enabled !== false,
    storageKey: key || DEFAULT_STORAGE_KEY,
    tokens: resolveTokenIds(T.tokens),
    exportName: safeExportName(T.exportName)
  };
}

// 合并覆盖：base 先按白名单净化；patch 覆盖合法色值，null/空串/非法值被拒绝
// （null/空串表示删除该项，非法值整项忽略——绝不写入无法回滚的脏数据）。
export function mergeOverrides(base, patch, tokenIds) {
  var ids = resolveTokenIds(tokenIds);
  var out = {};
  var src = base && typeof base === 'object' ? base : {};
  var add = patch && typeof patch === 'object' ? patch : {};
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var v = normalizeColor(src[id]);
    if (v) out[id] = v;
  }
  for (var j = 0; j < ids.length; j++) {
    var key = ids[j];
    if (!Object.prototype.hasOwnProperty.call(add, key)) continue;
    var next = add[key];
    if (next == null || next === '') { delete out[key]; continue; }
    var color = normalizeColor(next);
    if (color) out[key] = color;
  }
  return out;
}

// 存储/状态净化：只保留白名单 token 的合法色值，未知键与非法值静默剔除。
export function sanitizeOverrides(raw, tokenIds) {
  var src = raw && typeof raw === 'object' ? raw : {};
  return {
    light: mergeOverrides({}, src.light, tokenIds),
    dark: mergeOverrides({}, src.dark, tokenIds)
  };
}

function serializeModeEntries(modeValues, ids) {
  var entries = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (!modeValues[id]) continue;
    var spec = tokenSpec(id);
    entries.push({ key: spec.key, value: modeValues[id], zh: spec.zh, id: id });
  }
  return entries;
}

// 序列化为可粘贴进 theme.json5 → presetOverrides 的 JSON5 片段（含注释头/逐项中文注释）。
// 输入先经 sanitizeOverrides 净化：非法值与未知 token 不会进入导出文本。
export function serializeThemeLabExport(state, tokenIds) {
  var ids = resolveTokenIds(tokenIds);
  var clean = sanitizeOverrides(state, ids);
  var light = serializeModeEntries(clean.light, ids);
  var dark = serializeModeEntries(clean.dark, ids);
  var lines = [];
  lines.push('// =====================================================================');
  lines.push('// theme.json5 片段 — 由主题调色板编辑器导出');
  lines.push('// 用法：将 presetOverrides 合并进 theme.json5 的同名段，重新构建后全站生效');
  lines.push('// 覆盖：明亮模式 ' + light.length + ' 项；暗色模式 ' + dark.length + ' 项');
  lines.push('// =====================================================================');
  lines.push('{');
  lines.push('  "presetOverrides": {');
  lines.push('    // 明亮模式单色覆盖（theme.json5 → presetOverrides.colors）');
  lines.push('    "colors": {');
  for (var i = 0; i < light.length; i++) {
    var comma = i < light.length - 1 ? ',' : '';
    lines.push('      "' + light[i].key + '": "' + light[i].value + '"' + comma + ' // ' + light[i].zh + '（' + light[i].id + '）');
  }
  lines.push('    },');
  lines.push('    // 暗色模式单色覆盖（theme.json5 → presetOverrides.darkMode.colors）');
  lines.push('    "darkMode": {');
  lines.push('      "colors": {');
  for (var j = 0; j < dark.length; j++) {
    var comma2 = j < dark.length - 1 ? ',' : '';
    lines.push('        "' + dark[j].key + '": "' + dark[j].value + '"' + comma2 + ' // ' + dark[j].zh + '（' + dark[j].id + '）');
  }
  lines.push('      }');
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  return lines.join('\n') + '\n';
}

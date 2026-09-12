// theme-presets.js — 站点主题预设系统（单一真源，勿散落色值）
// 版权：S-ynapse。仅项目内使用。
// 职责：
//   1. 定义六套内置预设（亮色 + 暗色 全套 13 色，对比度 WCAG AA 合规）
//   2. resolveTheme(theme) 按 「内置预设 → presetOverrides」 次序合成最终色板
//   3. 校验让 build 在不合法预设名时给出候选建议（数据合法测试）

// 与 templates/layout.ejs :root 注入的 13 个 CSS 颜色变量一一对应：
//   primary(-p) secondary(-s) accent(-a) background(-bg) surface(-surface)
//   text(-t) textSecondary(-ts) textLight(-tl) border(-border) shadow(-shadow)
//   hover(-hover) codeBackground(-code-bg) codeText(-code-t)
// 注意：暗色必须提供 primary（深色背景上的标题色），旧版缺失导致
//   a:hover 在暗色下几乎不可见——本系统已强制补齐。

function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * lin((n >> 16) & 255) +
    0.7152 * lin((n >> 8) & 255) +
    0.0722 * lin(n & 255)
  );
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// 六套预设。
// light/dark 各 13 色；label 为菜单展示名。
const PRESETS = {
  'classic-blue': {
    label: '经典蓝',
    labelEn: 'Classic Blue',
    light: {
      primary: '#2d3748', secondary: '#2563eb', accent: '#c53030',
      background: '#f7fafc', surface: '#ffffff', text: '#1a202c',
      textSecondary: '#4a5568', textLight: '#64748b', border: '#e2e8f0',
      shadow: 'rgba(0,0,0,0.1)', hover: '#edf2f7',
      codeBackground: '#e9eef4', codeText: '#1f2328'
    },
    dark: {
      primary: '#f1f5f9', secondary: '#7caeff', accent: '#fca5a5',
      background: '#0f172a', surface: '#1e293b', text: '#f1f5f9',
      textSecondary: '#a3b2c4', textLight: '#9aa8ba', border: '#334155',
      shadow: 'rgba(0,0,0,0.3)', hover: '#334155',
      codeBackground: '#0a1120', codeText: '#e6edf3'
    }
  },
  'night-jet': {
    label: '极夜黑',
    labelEn: 'Midnight Black',
    light: {
      primary: '#1f2937', secondary: '#1d4ed8', accent: '#ef4444',
      background: '#f3f4f6', surface: '#ffffff', text: '#111827',
      textSecondary: '#4b5563', textLight: '#636b74', border: '#e5e7eb',
      shadow: 'rgba(0,0,0,0.12)', hover: '#e5e7eb',
      codeBackground: '#e5e7eb', codeText: '#111827'
    },
    dark: {
      primary: '#e5e7eb', secondary: '#60a5fa', accent: '#f87171',
      background: '#0b0f14', surface: '#15191f', text: '#f3f4f6',
      textSecondary: '#9ca3af', textLight: '#8b95a3', border: '#232a33',
      shadow: 'rgba(0,0,0,0.5)', hover: '#1e252e',
      codeBackground: '#060809', codeText: '#e5e7eb'
    }
  },
  'forest-green': {
    label: '森林绿',
    labelEn: 'Forest Green',
    light: {
      primary: '#1e3a2f', secondary: '#1f7a4d', accent: '#b45309',
      background: '#f4f9f6', surface: '#ffffff', text: '#14231c',
      textSecondary: '#3f5a4e', textLight: '#5e7266', border: '#d4e5dc',
      shadow: 'rgba(0,0,0,0.1)', hover: '#e8f2ec',
      codeBackground: '#e6f0ea', codeText: '#14321f'
    },
    dark: {
      primary: '#d9f0e4', secondary: '#4ade80', accent: '#fbbf24',
      background: '#0d1a13', surface: '#142b1f', text: '#e8f5ee',
      textSecondary: '#b7d5c6', textLight: '#93ac9f', border: '#24402f',
      shadow: 'rgba(0,0,0,0.4)', hover: '#1d352a',
      codeBackground: '#08120d', codeText: '#dcefe3'
    }
  },
  'sakura-pink': {
    label: '樱花粉',
    labelEn: 'Sakura Pink',
    light: {
      primary: '#331a24', secondary: '#c22e63', accent: '#9a6a1f',
      background: '#fff8fa', surface: '#ffffff', text: '#331a24',
      textSecondary: '#6b4a56', textLight: '#8a6a74', border: '#f2dde4',
      shadow: 'rgba(0,0,0,0.08)', hover: '#fdeef3',
      codeBackground: '#fae8ee', codeText: '#4a1f2c'
    },
    dark: {
      primary: '#f2c4cf', secondary: '#f472b6', accent: '#fcd34d',
      background: '#1c1014', surface: '#26161c', text: '#f8eef1',
      textSecondary: '#d5b6bf', textLight: '#b1939d', border: '#3a242c',
      shadow: 'rgba(0,0,0,0.5)', hover: '#331e26',
      codeBackground: '#140a0e', codeText: '#f8e3ea'
    }
  },
  'editorial-grey': {
    label: '编辑部灰',
    labelEn: 'Editorial Gray',
    light: {
      primary: '#18181b', secondary: '#52525b', accent: '#a16207',
      background: '#fafafa', surface: '#ffffff', text: '#18181b',
      textSecondary: '#52525b', textLight: '#6b6b74', border: '#e4e4e7',
      shadow: 'rgba(0,0,0,0.07)', hover: '#f4f4f5',
      codeBackground: '#ececec', codeText: '#18181b'
    },
    dark: {
      primary: '#e4e4e7', secondary: '#a1a1aa', accent: '#d4a72c',
      background: '#171717', surface: '#1c1c1e', text: '#fafafa',
      textSecondary: '#a8a8b3', textLight: '#8d8d98', border: '#2e2e33',
      shadow: 'rgba(0,0,0,0.5)', hover: '#26262b',
      codeBackground: '#0d0d0d', codeText: '#e5e5ea'
    }
  },
  'cyber-purple': {
    label: '赛博紫',
    labelEn: 'Cyber Purple',
    light: {
      primary: '#1c1233', secondary: '#7c3aed', accent: '#db2777',
      background: '#f8f6ff', surface: '#ffffff', text: '#1c1233',
      textSecondary: '#564b7e', textLight: '#746896', border: '#e4defc',
      shadow: 'rgba(0,0,0,0.11)', hover: '#f1ecff',
      codeBackground: '#ebe5f7', codeText: '#241a3f'
    },
    dark: {
      primary: '#d4c7ff', secondary: '#b794f6', accent: '#f472b6',
      background: '#12071f', surface: '#1a0e29', text: '#f7f3ff',
      textSecondary: '#c9b8f0', textLight: '#a894cd', border: '#372a52',
      shadow: 'rgba(0,0,0,0.55)', hover: '#291b40',
      codeBackground: '#0b0414', codeText: '#e5dcf7'
    }
  }
};

const DEFAULT_PRESET = 'classic-blue';
const COLOR_KEYS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textSecondary', 'textLight', 'border', 'shadow', 'hover', 'codeBackground', 'codeText'];

// resolveTheme(theme) — 合成最终色板。
// 优先级：内置预设 → theme.presetOverrides（文本行最高）
// theme.colors / theme.darkMode.colors 在 preset 激活时被忽略（预设接管），
// 放弃预设（preset 置 null/空串）或 preset 不存在时回退到手工模式。
function resolveTheme(theme) {
  const out = {
    colors: {},
    darkMode: Object.assign({}, theme.darkMode || {}),
    appliedPreset: null,
    warnings: []
  };
  const presetName = theme.preset == null ? null : String(theme.preset).trim();
  if (!presetName) {
    out.colors = Object.assign({}, theme.colors);
    out.darkMode.colors = Object.assign({}, (theme.darkMode && theme.darkMode.colors) || {});
    return out;
  }
  let base = PRESETS[presetName];
  if (!base) {
    out.warnings.push(
      'theme.json: preset "' + presetName + '" 不存在。可用预设: ' +
      Object.keys(PRESETS).map(function (k) { return k + '(' + PRESETS[k].label + ')'; }).join(', ') +
      '。已回退至 classic-blue；如需临时关闭预设接管请设 preset 为 null。'
    );
    base = PRESETS[DEFAULT_PRESET];
  }
  const overrides = (theme.presetOverrides && theme.presetOverrides.colors) || {};
  const darkOverrides = (theme.presetOverrides && theme.presetOverrides.darkMode && theme.presetOverrides.darkMode.colors) || {};
  const darkBase = {};
  COLOR_KEYS.forEach(function (k) {
    if (base.dark[k] != null) darkBase[k] = base.dark[k];
  });
  out.colors = Object.assign({}, base.light, overrides);
  out.darkMode.colors = Object.assign({}, darkBase, darkOverrides);
  const appliedKey = PRESETS[presetName] ? presetName : DEFAULT_PRESET;
  out.appliedPreset = PRESETS[appliedKey].label + '(' + appliedKey + ')';
  return out;
}

// validatePreset(theme) — 仅供 build 校验用。
// 返回错误数组（FATAL），不含警告。
function validatePreset(theme) {
  const errors = [];
  if (!theme || typeof theme !== 'object') return ['theme.json 必须为对象'];
  const name = theme.preset == null ? null : String(theme.preset).trim();
  if (name && !PRESETS[name]) {
    errors.push(
      'theme.json "preset" 值 "' + name + '" 无效。可选: ' +
      Object.keys(PRESETS).map(function (k) { return k; }).join(' | ') +
      ' 或 null(关闭预设接管)'
    );
  }
  const overrides = theme.presetOverrides;
  if (overrides != null && typeof overrides !== 'object') {
    errors.push('theme.json "presetOverrides" 必须为对象');
  }
  return errors;
}

// getPresetList() — 预览页/报告菜单用（数组：key/label/模式色板）。
function getPresetList() {
  return Object.keys(PRESETS).map(function (k) {
    return { key: k, label: PRESETS[k].label, colors: PRESETS[k].light };
  });
}

module.exports = {
  PRESETS: PRESETS,
  DEFAULT_PRESET: DEFAULT_PRESET,
  COLOR_KEYS: COLOR_KEYS,
  resolveTheme: resolveTheme,
  validatePreset: validatePreset,
  getPresetList: getPresetList,
  contrastRatio: contrastRatio
};

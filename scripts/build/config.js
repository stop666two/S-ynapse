'use strict';
// 配置族（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createConfigModule(ctx) 注入项目根目录、监视模式、JSON5/深合并实现（活值 getter）
// 与后置模块提供的 CSP 裁剪上下文、字体清单；函数体逐字搬移，注释保留。
const fs = require('fs');
const path = require('path');
const { formatConfigError } = require('../lib/config-error');
const { trimCspDirectives } = require('../lib/csp');
const { DEFAULT_FEATURES, validateFeatures } = require('../lib/features-schema');
const { validatePopupNotice } = require('../lib/popup-notice-config');
const { resolveTheme: resolveThemePreset, validatePreset: validateThemePreset } = require('../lib/theme-presets');

function createConfigModule(ctx) {
  // Deterministic hue for a category/tag name (same name → same color everywhere).
  function hashHue(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function categoryHue(name) { return hashHue(name); }

  // Build a detailed, actionable error report for a JSON5 parse failure:
  // file path, line/column, the offending line with a caret, context lines, cause
  // and a repair hint. Config syntax errors must never be a one-line mystery.
  // Load a JSON5 config file from project root.
  // Strips BOM and normalizes line endings before parsing.
  // Exits the process with [FATAL] on any failure — config errors must not be silent.
  function abortBuild(message) {
    console.error(message);
    if (ctx.watchMode) {
      const err = new Error(message);
      err.isBuildAbort = true;
      throw err;
    }
    process.exit(1);
  }

  function loadConfigFile(filename) {
    const filePath = path.join(ctx.rootDir, filename);
    if (!fs.existsSync(filePath)) {
      const legacyPath = filename.endsWith('.json5') ? path.join(ctx.rootDir, filename.replace(/\.json5$/, '.json')) : null;
      let message = `  [FATAL] Config file not found: ${filename}`;
      if (legacyPath && fs.existsSync(legacyPath)) {
        message += `\n          v1.0.3 起配置文件统一为 .json5：请将 ${path.basename(legacyPath)} 重命名为 ${filename}`;
      }
      abortBuild(message);
    }
    try {
      let raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      raw = raw.replace(/\r\n/g, '\n');
      return ctx.getJson5().parse(raw);
    } catch (err) {
      const filePath = path.join(ctx.rootDir, filename);
      const fileText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
      abortBuild(formatConfigError(filename, err, { filePath, fileText }));
    }
  }

  // Load an optional config file. Missing file → null (no error).
  // Present-but-invalid → fatal, matching the strict behavior of loadConfigFile.
  function loadOptionalConfigFile(filename) {
    const filePath = path.join(ctx.rootDir, filename);
    if (!fs.existsSync(filePath)) {
      const legacyPath = filename.endsWith('.json5') ? path.join(ctx.rootDir, filename.replace(/\.json5$/, '.json')) : null;
      if (legacyPath && fs.existsSync(legacyPath)) {
        console.warn(`  [WARN] ${filename} 未找到，但检测到旧版 ${path.basename(legacyPath)}（v1.0.3 起配置文件统一为 .json5，旧文件将被忽略；请重命名）`);
      }
      return null;
    }
    try {
      let raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      raw = raw.replace(/\r\n/g, '\n');
      return ctx.getJson5().parse(raw);
    } catch (err) {
      const filePath = path.join(ctx.rootDir, filename);
      const fileText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
      abortBuild(formatConfigError(filename, err, { filePath, fileText }));
    }
  }

  // Load and merge all 6 config files with deep defaults.
  // The defaults object provides every possible key so user configs can be sparse.
  // deepmerge.all([defaults, userConfig]) ensures nested keys (e.g. theme.colors.primary)
  // fall through to defaults when user omits them.
  // Each loaded config overrides only the keys the user explicitly set.
  function loadConfig() {
    console.log('[1/14] Loading configuration...');
    const site = loadConfigFile('site.json5');
    const theme = loadConfigFile('theme.json5');
    const navigation = loadConfigFile('navigation.json5');
    const sidebar = loadConfigFile('sidebar.json5');
    const footer = loadConfigFile('footer.json5');
    const security = loadConfigFile('security.json5');
    // Content policy is optional — when the file is missing the built-in default
    // policy from scripts/lib/content-policy.js is used.
    const contentPolicy = loadOptionalConfigFile('content-policy.json5') || {};
    // Tag aliases + friends are optional external config files (single source per feature).
    const tagAliasData = loadOptionalConfigFile('tag-aliases.json5') || {};
    const friendsData = loadOptionalConfigFile('friends.json5') || {};
    // Features domain is optional: missing features.json5 falls back to the
    // built-in DEFAULT_FEATURES (matching current behavior).
    const features = loadOptionalConfigFile('features.json5') || {};
    // UI strings domain (feature 18): optional ui-strings.json5 — template
    // fallbacks stay in place when missing. Deep-merged (uiStrings overrides
    // only the keys it defines).
    const uiStrings = loadOptionalConfigFile('ui-strings.json5') || {};
    // UI tuning domain: optional tuning.json5 — fine-grained UI values (typography,
    // layout, radius, motion, ...). Missing file keeps every CSS fallback in place.
    const tuning = loadOptionalConfigFile('tuning.json5') || {};
    // Guard domain (module 60): optional guard.json5 — protection & interaction
    // controls (custom context menu, copy guard, hotkey guard, detection, ...).
    // Missing file keeps guards inert (client only reads it when features.guards
    // is enabled and the preset activates a module).
    const guard = loadOptionalConfigFile('guard.json5') || {};

    const { DEFAULT_CONFIG } = require('../lib/site-defaults.js');
    const defaults = DEFAULT_CONFIG;

    const config = ctx.getDeepmerge().all([defaults, { site, theme, navigation, sidebar, footer, security, contentPolicy, features, uiStrings, tuning, guard }, { tagAliases: tagAliasData, friends: friendsData }], { arrayMerge: (target, source) => source });
    // Features arrays must replace, not concatenate (e.g. share.order must drop
    // platforms the user removed). Deepmerge's default arrayMerge concatenates,
    // so features gets its own merge pass with a replace strategy.
    config.features = ctx.getDeepmerge().all([{}, DEFAULT_FEATURES, features], { arrayMerge: (target, source) => source });
    // `--features-override <file>`：隔离验证/预览构建的第二态 features 覆盖（深合并，
    // 数组替换语义与 features.json5 一致）；未知键仍会被 validateFeatures 拦截。
    if (ctx.featuresOverridePath) {
      if (!fs.existsSync(ctx.featuresOverridePath)) {
        abortBuild('\n[FATAL] --features-override file not found: ' + ctx.featuresOverridePath + '\n');
      }
      let overrideRaw = fs.readFileSync(ctx.featuresOverridePath, 'utf-8');
      if (overrideRaw.charCodeAt(0) === 0xFEFF) overrideRaw = overrideRaw.slice(1);
      let overrideObj;
      try {
        overrideObj = ctx.getJson5().parse(overrideRaw.replace(/\r\n/g, '\n'));
      } catch (err) {
        abortBuild('\n[FATAL] --features-override parse error in ' + ctx.featuresOverridePath + ': ' + err.message + '\n');
      }
      config.features = ctx.getDeepmerge().all([{}, config.features, overrideObj || {}], { arrayMerge: (target, source) => source });
      console.log('  [features-override] ' + path.relative(ctx.rootDir, ctx.featuresOverridePath).split(path.sep).join('/'));
    }
    // Cloudflare Web Analytics token: explicit config wins, else env fallback.
    if (config.site && config.site.webAnalytics && config.site.webAnalytics.enabled) {
      const wa = config.site.webAnalytics;
      if (!wa.token && process.env.CF_WEB_ANALYTICS_TOKEN) wa.token = process.env.CF_WEB_ANALYTICS_TOKEN;
      if (!wa.token) {
        console.log('  [WARN] webAnalytics.enabled=true but no token set (config token or CF_WEB_ANALYTICS_TOKEN); beacon will not be injected');
        wa.enabled = false;
      }
    }
    // SITE_URL 环境变量（CI / 预览部署）：显式覆盖配置中的站点地址，
    // 便于同一份配置部署到不同域名（留空则完全使用 site.json5 的 site.url）。
    if (process.env.SITE_URL) config.site.url = String(process.env.SITE_URL).replace(/\/+$/, '');
    // Theme preset resolution: built-in preset → presetOverrides. When a preset
    // is active it takes over colors/dark colors; manual colors field is only
    // honored when preset is null (see theme.json5 header notes).
    const themeRes = resolveThemePreset(config.theme);
    if (themeRes.warnings.length > 0) {
      themeRes.warnings.forEach(w => console.log('  [WARN] ' + w));
    } else if (themeRes.appliedPreset) {
      console.log('  [THEME] Preset applied: ' + themeRes.appliedPreset);
    }
    config.theme.appliedPreset = themeRes.appliedPreset;
    config.theme.colors = themeRes.colors;
    config.theme.darkMode = themeRes.darkMode;
    // Visual tiers (rounding / shadow / border) resolve to concrete CSS vars.
    applyVisualTiers(config.theme);
    // Layout density tiers (compact/balanced/airy) resolve container/gap/columns.
    applyDensity(config.theme);
    if (config.sidebar && config.theme && config.theme.density && config.theme.density.sidebarWidth) {
      config.sidebar.width = config.theme.density.sidebarWidth;
    }
    // Font system resolves stack → family + Google Fonts link; custom stack keeps
    // the hand-written theme.fontFamily with priority.
    resolveFontSystem(config.theme);
    // meta CSP（默认关）与 _headers/Worker 共用同一裁剪结果：开启时先就地裁剪，
    // 避免 meta 与响应头策略不一致；autoTrim=false 时保持原始超集（手动接管域名清单）。
    if (config.security && config.security.csp && config.security.csp.metaEnabled === true && config.security.csp.autoTrim !== false) {
      config.security.csp.directives = trimCspDirectives(config.security.csp.directives, ctx.buildCspTrimContext(config));
    }
    return config;
  }

  // applyDensity — 布局密度档位解析。档位数值定义在 theme.json5 的 tiers.density（配置即唯一来源）。
  function applyDensity(theme) {
    if (!theme.density) theme.density = {};
    const preset = theme.density.preset;
    const tiers = (theme.tiers && theme.tiers.density) || {};
    const tier = (preset && tiers[preset]) || null;
    const d = theme.density;
    theme.density.columns = tier && tier.columns != null ? tier.columns : (Number.isInteger(d.columns) ? d.columns : 2);
    if (tier) {
      if (tier.containerWidth) theme.density.containerWidth = tier.containerWidth;
      if (tier.gap) theme.density.gap = tier.gap;
      if (tier.sidebarWidth) theme.density.sidebarWidth = tier.sidebarWidth;
    }
    theme.spacing = theme.spacing || {};
    theme.spacing.containerWidth = theme.density.containerWidth || theme.spacing.containerWidth || '1250px';
    theme.spacing.gap = theme.density.gap || theme.spacing.gap || '2rem';
    theme.sidebarWidth = theme.density.sidebarWidth || theme.sidebarWidth || '280px';
  }

  // FONT_STACKS — fontSystem.stack 预设枚举 → CSS font-family 栈。
  // CJK_FALLBACK：统一中文字体回退链（Noto Sans SC 构建期按实际用字子集化并自托管 → 鸿蒙 →
  // 苹方 → 微软雅黑 UI → 雅黑），中西混排观感一致；子集未启用/失败时该字体名不存在，
  // 浏览器自动落到后续系统字体，无需运行时判断。
  const CJK_FALLBACK = "'Noto Sans SC','PingFang SC','HarmonyOS Sans SC','Microsoft YaHei UI','Microsoft YaHei',sans-serif";
  const SERIF_STACK = "Georgia,'Noto Serif SC','Songti SC','STSong','SimSun',serif";
  const FONT_STACKS = {
    inter: "'Inter','Segoe UI','Helvetica Neue',Arial," + CJK_FALLBACK,
    sora: "'Sora','Inter','Segoe UI'," + CJK_FALLBACK,
    manrope: "'Manrope','Inter','Segoe UI'," + CJK_FALLBACK,
    'noto-sans': CJK_FALLBACK,
    'noto-serif': "'Noto Serif SC'," + SERIF_STACK,
    system: "-apple-system,BlinkMacSystemFont,'Segoe UI'," + CJK_FALLBACK,
    serif: SERIF_STACK
  };
  // FONT_LINKS — 字体样式入口：inter/sora/manrope 使用本地 vendor 版本（离线可用）；
  // 本地字体合并为单一 fonts.css（只 1 个阻塞请求；内部含三个 @font-face，未用到的字面体开销极小）；
  // noto 系列为 CJK 网络字体（体积过大）保留外部 CDN，加载失败时自动回退系统字体链。
  const FONT_LINKS = {
    inter: '/assets/vendor/fonts/fonts.css',
    sora: '/assets/vendor/fonts/fonts.css',
    manrope: '/assets/vendor/fonts/fonts.css',
    'noto-sans': 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
    'noto-serif': 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap',
    system: null,
    serif: null,
    custom: null
  };

  function resolveFontSystem(theme) {
    const fs = theme.fontSystem || {};
    const stack = fs.stack || 'inter';
    const family = stack === 'custom'
      ? (fs.customStack || theme.fontFamily || FONT_STACKS.inter)
      : (FONT_STACKS[stack] || FONT_STACKS.inter);
    theme.fontFamily = family;
    const hs = fs.headingStack;
    theme.fontFamilyHeading = hs === 'serif'
      ? FONT_STACKS.serif
      : (hs === 'sans' ? FONT_STACKS.inter : (FONT_STACKS[hs] || family));
    const ds = fs.displayStack;
    theme.fontFamilyDisplay = FONT_STACKS[ds] || theme.fontFamilyHeading;
    theme.fontScale = (typeof fs.scale === 'number' && fs.scale > 0 && fs.scale <= 2) ? fs.scale : 1;
    theme.fontNumbersMono = fs.numbersMono !== false;
    const links = Array.from(new Set([FONT_LINKS[stack], FONT_LINKS[hs], FONT_LINKS[ds]].filter(Boolean)));
    const fontPreloads = [];
    [stack, hs, ds].forEach(function (n) { if (n && ctx.getVendorFonts()[n]) fontPreloads.push('/assets/vendor/fonts/' + ctx.getVendorFonts()[n].file); });
    theme.externalAssets = theme.externalAssets || { styles: [], scripts: [] };
    theme.externalAssets.fontPreloads = fontPreloads.filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (links.length) {
      theme.externalAssets = theme.externalAssets || { styles: [], scripts: [] };
      links.forEach(function (link) {
        theme.externalAssets.styles = theme.externalAssets.styles.filter(s => s !== link);
      });
      theme.externalAssets.styles = links.concat(theme.externalAssets.styles);
    }
  }

  // applyVisualTiers — rounding/shadowLevel/borderStyle 档位解析。
  // 档位数值定义在 theme.json5 的 tiers（配置即唯一来源）；档位缺失时保留现有值（兜底见 DEFAULTS）。
  function applyVisualTiers(theme) {
    const tiers = theme.tiers || {};
    const rd = (tiers.rounding && tiers.rounding[theme.rounding]) || null;
    const sh = (tiers.shadow && tiers.shadow[theme.shadowLevel]) || null;
    const bd = (tiers.border && tiers.border[theme.borderStyle]) || null;
    if (rd) {
      if (rd.radius) theme.spacing.radius = rd.radius;
      if (rd.radiusLarge) theme.spacing.radiusLarge = rd.radiusLarge;
      if (rd.button) theme.button.radius = rd.button;
    }
    if (sh) {
      if (sh.card) theme.shadow.card = sh.card;
      if (sh.dropdown) theme.shadow.dropdown = sh.dropdown;
      if (sh.fixed) theme.shadow.fixed = sh.fixed;
      theme.darkShadow = (theme.darkMode && theme.darkMode.enabled && sh.dark) ? sh.dark : null;
    }
    if (bd) {
      if (!theme.colors) theme.colors = {};
      if (bd.light) theme.colors.border = bd.light;
      if (theme.darkMode && theme.darkMode.enabled && bd.dark) {
        if (!theme.darkMode.colors) theme.darkMode.colors = {};
        theme.darkMode.colors.border = bd.dark;
      }
    }
  }

  // Validate merged config for required fields and suspicious values.
  // Returns boolean. Errors = build-stopping problems. Warnings = advisory only.
  // Caller must check the return value and abort if false.
  function validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (!config.site.title) errors.push('site.title is required');
    if (!config.site.url) errors.push('site.url is required');
    if (config.site.url && !/^https?:\/\//.test(config.site.url)) errors.push('site.url must start with http:// or https://');
    if (!config.site.language) errors.push('site.language is required');
    if (!config.site.postsPerPage || config.site.postsPerPage < 1) errors.push('site.postsPerPage must be >= 1');

    if (config.site.rss && config.site.rss.enabled) {
      if (!config.site.rss.path) warnings.push('site.rss.path not set, using default /feed.xml');
    }
    if (config.site.sitemap && config.site.sitemap.enabled) {
      if (!['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].includes(config.site.sitemap.changefreq)) {
        warnings.push(`site.sitemap.changefreq "${config.site.sitemap.changefreq}" is not standard`);
      }
    }

    if (config.theme.colors) {
      for (const [key, val] of Object.entries(config.theme.colors)) {
        if (val && !val.startsWith('#') && !val.startsWith('rgba') && !val.startsWith('rgb(')) {
          warnings.push(`theme.colors.${key}: "${val}" may not be a valid color`);
        }
      }
    }
    if (config.theme.darkMode && config.theme.darkMode.enabled) {
      if (!['light', 'dark', 'system'].includes(config.theme.darkMode.default)) {
        errors.push('theme.darkMode.default must be "light", "dark", or "system"');
      }
      if (config.theme.darkMode.iconStyle !== undefined && !['sun-moon', 'single', 'switch'].includes(config.theme.darkMode.iconStyle)) {
        errors.push('theme.darkMode.iconStyle must be "sun-moon", "single", or "switch"');
      }
    }
    if (config.theme.spacing) {
      const cw = config.theme.spacing.containerWidth;
      if (cw && !/^\d+(px|rem|em|%|vw)$/.test(cw)) warnings.push(`theme.spacing.containerWidth "${cw}" may be invalid`);
    }

    if (config.navigation.menu) {
      for (const item of config.navigation.menu) {
        if (!item.label) errors.push('navigation.menu item missing label');
        if (!item.url) errors.push('navigation.menu item missing url');
      }
    }

    if (config.sidebar && config.sidebar.enabled && config.sidebar.widgets) {
      const validTypes = ['author', 'recent', 'tags', 'categories', 'archive', 'search', 'custom', 'newsletter', 'toc', 'series', 'friends', 'stats', 'quote'];
      for (const w of config.sidebar.widgets) {
        if (w.enabled && !validTypes.includes(w.type)) warnings.push(`sidebar.widget type "${w.type}" is unknown`);
      }
    }

    if (config.security.csp && config.security.csp.enabled) {
      if (config.security.csp.directives['script-src'] && config.security.csp.directives['script-src'].includes("'unsafe-inline'")) {
        warnings.push('security.csp: script-src includes unsafe-inline, consider removing for stricter CSP');
      }
    }

    const featureResults = validateFeatures(config.features, 'features');
    errors.push(...featureResults.errors);
    warnings.push(...featureResults.warnings);

    const popupResults = validatePopupNotice((config.features || {}).popupNotice);
    errors.push(...popupResults.errors);
    warnings.push(...popupResults.warnings);

    const themeErrors = validateThemePreset(config.theme);
    errors.push(...themeErrors);
    const _tiers = config.theme.tiers || {};
    const _tk = function (group) { return Object.keys((_tiers[group] || {})); };
    if (config.theme.rounding && _tk('rounding').length && !_tiers.rounding[config.theme.rounding]) errors.push('theme.rounding 无效，可选: ' + _tk('rounding').join(' | '));
    if (config.theme.shadowLevel && _tk('shadow').length && !_tiers.shadow[config.theme.shadowLevel]) errors.push('theme.shadowLevel 无效，可选: ' + _tk('shadow').join(' | '));
    if (config.theme.borderStyle && _tk('border').length && !_tiers.border[config.theme.borderStyle]) errors.push('theme.borderStyle 无效，可选: ' + _tk('border').join(' | '));

    if (errors.length > 0) {
      console.error('\n[CONFIG VALIDATION ERRORS]');
      errors.forEach(e => console.error('  - ' + e));
      return false;
    }
    if (warnings.length > 0) {
      console.warn('\n[CONFIG WARNINGS]');
      warnings.forEach(w => console.warn('  - ' + w));
    }
    return true;
  }

  return { hashHue, categoryHue, abortBuild, loadConfigFile, loadOptionalConfigFile, loadConfig, applyDensity, resolveFontSystem, applyVisualTiers, validateConfig };
}

module.exports = { createConfigModule };

'use strict';

// 构建产物压缩配置（compression.json5）的加载、校验与豁免判定。
// DEFAULT_COMPRESSION 同时作为 verify:config 的结构监守注册表；
// 压缩阶段（scripts/build/minify.js）按 compressionActive 的结果决定是否执行。

const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');
const { setOwnProperty } = require('./utils');

const CONFIG_FILENAME = 'compression.json5';
const OBFUSCATE_PRESETS = ['low', 'medium', 'high'];

// 全部字段的内置默认值：文件缺失或字段缺省时的回退来源，也是结构监守的基准。
const DEFAULT_COMPRESSION = {
  enabled: true,
  html: { enabled: true, removeComments: true, collapseWhitespace: true, aggressive: false },
  css: { enabled: true, mergeInlineStyles: true, dedupe: true },
  js: { enabled: true, minify: true, obfuscate: { enabled: false, preset: 'medium', seed: 0 } },
  json: { enabled: true },
  exclude: [
    'report.txt',
    'build-report.html',
    'assets/vendor/**',
    'media/**',
    'og/**',
    'assets/fonts/**',
    '**/*.woff2',
    '**/*.avif',
    '**/*.webp',
    '**/*.png',
    '**/*.jpg',
    '**/*.svg'
  ],
  verify: { headless: true, fallbackOnFailure: true }
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_COMPRESSION));
}

// 深合并：对象逐键递归，数组与标量整体替换（exclude 自定义时不做默认项拼接）。
// 拷贝与写入均按自有属性语义：配置键可含 '__proto__'，Object.assign/普通赋值会触发原型 setter。
function deepMerge(base, override) {
  const out = {};
  if (isPlainObject(base)) {
    for (const key of Object.keys(base)) setOwnProperty(out, key, base[key]);
  }
  if (!isPlainObject(override)) return out;
  for (const key of Object.keys(override)) {
    const next = override[key];
    const current = Object.prototype.hasOwnProperty.call(out, key) ? out[key] : undefined;
    setOwnProperty(out, key, isPlainObject(next) && isPlainObject(current) ? deepMerge(current, next) : next);
  }
  return out;
}

function checkBoolean(obj, key, label, errors) {
  if (typeof obj[key] !== 'boolean') errors.push(label + ' 必须是布尔值（true | false）');
}

// 递归对照默认注册表找出配置中的未知键：只告警不报错（硬校验由 verify:config 的结构监守承担）。
function collectUnknown(user, def, prefix, warnings) {
  if (!isPlainObject(user)) return;
  for (const key of Object.keys(user)) {
    const label = prefix + '.' + key;
    if (!isPlainObject(def) || !Object.prototype.hasOwnProperty.call(def, key)) {
      warnings.push(label + ' 不是已知配置键（将被忽略）');
      continue;
    }
    collectUnknown(user[key], def[key], label, warnings);
  }
}

/**
 * 校验合并后的压缩配置（类型 / 枚举 / exclude 结构）。
 * @param {object} cfg 已与默认值合并的配置对象
 * @param {string} [prefix] 报错路径前缀，默认 compression
 * @returns {{ errors: string[], warnings: string[] }} errors 非空表示配置非法
 */
function validateCompression(cfg, prefix) {
  const p = prefix || 'compression';
  const errors = [];
  const warnings = [];
  if (!isPlainObject(cfg)) {
    errors.push(p + ' 必须是对象');
    return { errors, warnings };
  }

  checkBoolean(cfg, 'enabled', p + '.enabled', errors);

  /** @type {Array<[string, string[]]>} */
  const boolGroups = [
    ['html', ['enabled', 'removeComments', 'collapseWhitespace', 'aggressive']],
    ['css', ['enabled', 'mergeInlineStyles', 'dedupe']],
    ['js', ['enabled', 'minify']],
    ['json', ['enabled']],
    ['verify', ['headless', 'fallbackOnFailure']]
  ];
  for (const [section, keys] of boolGroups) {
    const block = cfg[section];
    if (block === undefined) continue;
    if (!isPlainObject(block)) {
      errors.push(p + '.' + section + ' 必须是对象');
      continue;
    }
    for (const key of keys) checkBoolean(block, key, p + '.' + section + '.' + key, errors);
  }

  const obfuscate = isPlainObject(cfg.js) ? cfg.js.obfuscate : undefined;
  if (obfuscate !== undefined) {
    if (!isPlainObject(obfuscate)) {
      errors.push(p + '.js.obfuscate 必须是对象');
    } else {
      checkBoolean(obfuscate, 'enabled', p + '.js.obfuscate.enabled', errors);
      if (!OBFUSCATE_PRESETS.includes(obfuscate.preset)) {
        errors.push(p + '.js.obfuscate.preset 必须是 low | medium | high 之一（当前：' + JSON.stringify(obfuscate.preset) + '）');
      }
      if (!Number.isInteger(obfuscate.seed) || obfuscate.seed < 0) {
        errors.push(p + '.js.obfuscate.seed 必须是非负整数（0 表示随机种子）');
      }
    }
  }

  if (!Array.isArray(cfg.exclude) || cfg.exclude.length === 0) {
    errors.push(p + '.exclude 必须是非空字符串数组');
  } else {
    cfg.exclude.forEach((item, index) => {
      if (typeof item !== 'string' || item.trim() === '') {
        errors.push(p + '.exclude[' + index + '] 必须是非空字符串');
      }
    });
  }

  if (isPlainObject(cfg.html) && cfg.html.aggressive === true) {
    warnings.push(p + '.html.aggressive=true 为实验性选项：需通过无头对比门禁验证，失败将回退未压缩产物');
  }
  return { errors, warnings };
}

/**
 * 读取并校验 compression.json5。
 * 文件缺失 → 返回全默认值（不算错误）；解析失败或字段非法 → errors 非空，
 * 调用方须终止压缩阶段（或按 verify.fallbackOnFailure 回退未压缩产物）。
 * @param {string} [root] 项目根目录，默认取本文件上两级目录
 * @returns {{ config: object, errors: string[], warnings: string[] }}
 */
function loadCompressionConfig(root) {
  const base = root || path.resolve(__dirname, '..', '..');
  const errors = [];
  const warnings = [];
  const file = path.join(base, CONFIG_FILENAME);
  if (!fs.existsSync(file)) {
    return { config: cloneDefaults(), errors, warnings };
  }

  let parsed;
  try {
    let raw = fs.readFileSync(file, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    parsed = json5.parse(raw.replace(/\r\n/g, '\n'));
  } catch (err) {
    errors.push(CONFIG_FILENAME + ' 解析失败：' + err.message);
    return { config: cloneDefaults(), errors, warnings };
  }
  if (!isPlainObject(parsed)) {
    errors.push(CONFIG_FILENAME + ' 顶层必须是对象');
    return { config: cloneDefaults(), errors, warnings };
  }

  const config = deepMerge(cloneDefaults(), parsed);
  collectUnknown(parsed, DEFAULT_COMPRESSION, 'compression', warnings);
  const result = validateCompression(config, 'compression');
  errors.push(...result.errors);
  warnings.push(...result.warnings);
  return { config, errors, warnings };
}

/**
 * 把 `--compression-override` 的覆盖对象深合并进已加载的压缩配置并重新校验。
 * 与 features/theme 覆盖同模式：深合并（数组与标量整体替换）、不写回仓库配置文件。
 * 校验错误不在此处终止流程，由调用方按「降级为内置默认值」处理。
 * @param {object} config 已与默认值合并的基础配置
 * @param {object} overrideObj 覆盖对象（JSON5 解析结果）
 * @returns {{ config: object, errors: string[], warnings: string[] }}
 */
function mergeCompressionOverride(config, overrideObj) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(overrideObj)) {
    errors.push('--compression-override 顶层必须是对象');
    return { config: isPlainObject(config) ? config : cloneDefaults(), errors, warnings };
  }
  const merged = deepMerge(config, overrideObj);
  const result = validateCompression(merged, 'compression-override');
  errors.push(...result.errors);
  warnings.push(...result.warnings);
  return { config: merged, errors, warnings };
}

// 路径归一化：统一 / 分隔、去掉开头的 ./ 与 /，保证 Windows 与产物发布路径语义一致。
function normalizePath(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

const globCache = new Map();

// 最小 glob → 正则：** 跨目录（含零层）、* 段内、? 单字符；其余字符按字面量转义。
function globToRegExp(pattern) {
  const cached = globCache.get(pattern);
  if (cached) return cached;
  const normalized = normalizePath(pattern);
  let source = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        if (normalized[i + 2] === '/') {
          source += '(?:.*/)?';
          i += 2;
        } else if (i + 2 === normalized.length) {
          if (source.endsWith('/')) source = source.slice(0, -1);
          source += '(?:/.*)?';
          i += 1;
        } else {
          source += '.*';
          i += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  const regex = new RegExp('^' + source + '$');
  globCache.set(pattern, regex);
  return regex;
}

/**
 * 判断 dist 产物相对路径是否命中豁免名单。
 * 匹配按原样字符（大小写敏感，与 Cloudflare 线上文件系统语义一致）；
 * 模式省略时使用 DEFAULT_COMPRESSION.exclude。
 * @param {string} relPath 相对 dist 根的路径（可用 \ 或 / 分隔）
 * @param {string[]} [patterns] 豁免 glob 列表
 * @returns {boolean} 命中任意模式即返回 true
 */
function isExcluded(relPath, patterns) {
  const list = Array.isArray(patterns) ? patterns : DEFAULT_COMPRESSION.exclude;
  const target = normalizePath(relPath);
  for (const pattern of list) {
    if (typeof pattern !== 'string' || pattern === '') continue;
    if (globToRegExp(pattern).test(target)) return true;
  }
  return false;
}

/**
 * 判断本次构建是否执行压缩：serve / watch（本地调试）永远关闭；
 * 其余情况按总开关（缺省视为开启）。
 * @param {{ enabled?: boolean }} [compression] 压缩配置（通常来自 loadCompressionConfig）
 * @param {{ serve?: boolean, watch?: boolean }} [options] 构建模式
 * @returns {boolean}
 */
function compressionActive(compression, options) {
  const opts = options || {};
  if (opts.serve === true || opts.watch === true) return false;
  if (!isPlainObject(compression)) return true;
  return compression.enabled !== false;
}

module.exports = {
  DEFAULT_COMPRESSION,
  OBFUSCATE_PRESETS,
  loadCompressionConfig,
  validateCompression,
  mergeCompressionOverride,
  isExcluded,
  compressionActive,
  normalizePath
};

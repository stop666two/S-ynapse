'use strict';

// internals.json5 加载器：深合并默认值 → 结构/类型/范围/枚举校验 → 返回冻结对象。
// 校验失败抛出 Error（调用方让进程以非零码退出，fail fast）；结果按文件路径缓存。
// 键名注册表与默认值在 scripts/lib/internals-defaults.js（单一来源）。

const fs = require('fs');
const path = require('path');
const json5 = require('json5');
const { DEFAULTS, SCHEMA } = require('./internals-defaults');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_FILE = path.join(ROOT, 'internals.json5');

const cacheByPath = new Map();

// 标记为 open 的规则节点：其子键允许自由扩展（值仍按规则校验，不做未知键扫描）。
const OPEN_PATHS = new Set(
  Object.entries(SCHEMA).filter(([, rule]) => rule.open === true).map(([keyPath]) => keyPath)
);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out = {};
  for (const key of Object.keys(base)) {
    out[key] = key in override ? deepMerge(base[key], override[key]) : base[key];
  }
  for (const key of Object.keys(override)) {
    if (!(key in out)) out[key] = override[key];
  }
  return out;
}

function findUnknownKeys(merged, defaults, prefix, out) {
  for (const key of Object.keys(merged)) {
    const current = prefix ? prefix + '.' + key : key;
    if (!(key in defaults)) {
      out.push(current);
      continue;
    }
    if (isPlainObject(merged[key]) && isPlainObject(defaults[key]) && !OPEN_PATHS.has(current)) {
      findUnknownKeys(merged[key], defaults[key], current, out);
    }
  }
  return out;
}

function valueAt(root, keyPath) {
  let current = root;
  for (const segment of keyPath.split('.')) {
    if (!isPlainObject(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isPathLike(value) {
  if (path.isAbsolute(value)) return false;
  const segments = value.split(/[\\/]+/);
  return !segments.includes('..');
}

function validateValue(keyPath, rule, value, errors) {
  const fail = (reason) => errors.push(keyPath + '：' + reason + '（当前值 ' + JSON.stringify(value) + '）');
  switch (rule.kind) {
    case 'integerMap': {
      if (!isPlainObject(value)) return fail('必须是对象（字符串→正整数毫秒）');
      for (const [mapKey, mapValue] of Object.entries(value)) {
        if (!Number.isInteger(mapValue) || mapValue <= 0) {
          return fail('键 "' + mapKey + '" 的值必须是正整数毫秒');
        }
      }
      return;
    }
    case 'integer':
      if (!Number.isInteger(value)) return fail('必须是整数');
      if (value < rule.min || value > rule.max) return fail('超出允许范围 ' + rule.min + '-' + rule.max);
      return;
    case 'boolean':
      if (typeof value !== 'boolean') return fail('必须是布尔值');
      return;
    case 'string':
      if (typeof value !== 'string' || !value.trim()) return fail('必须是非空字符串');
      break;
    case 'nullableString':
      if (value === null) return;
      if (typeof value !== 'string' || !value.trim()) return fail('必须是 null 或非空字符串');
      break;
    case 'color':
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) return fail('必须是 #rrggbb 十六进制颜色');
      return;
    case 'version':
      if (typeof value !== 'string' || !/^v?\d+(\.\d+){0,2}$/.test(value.trim())) return fail('必须是如 24 或 20.19.0 的版本号');
      return;
    default:
      return fail('内部错误：未知校验类型 ' + rule.kind);
  }
  if (rule.pathLike && !isPathLike(value)) return fail('必须是仓库内相对路径（不得为绝对路径或含 ..）');
  if (rule.identifierLike && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) return fail('必须是不含空格/路径分隔符的标识符');
}

function validateInternals(merged) {
  const errors = [];
  for (const [keyPath, rule] of Object.entries(SCHEMA)) {
    validateValue(keyPath, rule, valueAt(merged, keyPath), errors);
  }
  const unknown = findUnknownKeys(merged, DEFAULTS, '', []);
  for (const key of unknown) errors.push(key + '：未知配置键（internals.json5 不接受未登记键）');
  if (errors.length) {
    throw new Error('[internals] 校验失败：\n  - ' + errors.join('\n  - '));
  }
}

/**
 * 加载工程内部参数：合并默认值并校验。
 * @param {{path?: string}} [options] path 指向自定义 internals 文件（测试用）；
 *   省略时读取仓库根 internals.json5。
 * @returns {object} 冻结的合并结果；同路径重复调用返回同一实例。
 */
function loadInternals(options) {
  const file = path.resolve((options && options.path) || DEFAULT_FILE);
  const cached = cacheByPath.get(file);
  if (cached) return cached;
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    throw new Error('[internals] 无法读取 ' + file + '：' + err.message, { cause: err });
  }
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  let parsed;
  try {
    parsed = json5.parse(raw);
  } catch (err) {
    throw new Error('[internals] ' + file + ' 解析失败：' + err.message, { cause: err });
  }
  if (!isPlainObject(parsed)) {
    throw new Error('[internals] ' + file + ' 顶层必须是对象');
  }
  const merged = deepMerge(DEFAULTS, parsed);
  validateInternals(merged);
  Object.freeze(merged);
  cacheByPath.set(file, merged);
  return merged;
}

/** 清空加载缓存（仅测试使用：验证不同文件内容时不互相污染）。 */
function clearInternalsCache() {
  cacheByPath.clear();
}

module.exports = { loadInternals, clearInternalsCache, DEFAULTS, SCHEMA };

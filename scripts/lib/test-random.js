'use strict';
// 随机/属性测试的种子管理与失败留档基础设施。
// 种子来源：TEST_SEED 环境变量（十进制或 0x 十六进制）；未设置时随机生成 32 位并打印，
// 使任何一次失败都能用打印出的种子在下次运行中精确复现。
// 失败留档：build-artifacts/fuzz-failures/<test>-<UTC 时间戳>.json（目录已随 build-artifacts/ 忽略）。

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FAILURE_DIR = path.join(PROJECT_ROOT, 'build-artifacts', 'fuzz-failures');
const DEFAULT_NUM_RUNS = 100;
const MAX_NUM_RUNS = 100000;

let cachedSeed = null;

function randomSeed() {
  return crypto.randomBytes(4).readUInt32BE(0);
}

// 解析 TEST_SEED：仅接受非负十进制整数或 0x 前缀十六进制；非法值按未设置处理。
function parseSeed(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return null;
  if (/^0x[0-9a-f]+$/i.test(text)) {
    const value = parseInt(text, 16);
    return Number.isFinite(value) ? value >>> 0 : null;
  }
  if (/^[0-9]+$/.test(text)) {
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 ? value >>> 0 : null;
  }
  return null;
}

/**
 * 解析本次运行的基准种子（进程内缓存，保证同一测试进程内所有属性共享同一种子）。
 * @param {Record<string, string|undefined>} [env] 环境变量（默认 process.env）
 * @param {{ fresh?: boolean }} [options] fresh=true 时忽略缓存重新解析
 * @returns {number} 无符号 32 位种子
 */
function resolveSeed(env, options) {
  const useCache = !(options && options.fresh);
  if (cachedSeed !== null && useCache) return cachedSeed;
  const source = env || process.env;
  const fromEnv = parseSeed(source.TEST_SEED);
  const seed = fromEnv == null ? randomSeed() : fromEnv;
  cachedSeed = seed;
  const origin = fromEnv == null ? '随机生成' : 'TEST_SEED';
  process.stderr.write('[test-seed] ' + seed + '（' + origin + '）；复现：TEST_SEED=' + seed + ' npm run test:fuzz\n');
  return seed;
}

/**
 * 本波属性测试的迭代次数：FC_NUM_RUNS 控制（默认 100，上限 100000）。
 * 夜间深度档由 CI 注入 FC_NUM_RUNS=2000。
 * @param {Record<string, string|undefined>} [env]
 * @returns {number}
 */
function numRuns(env) {
  const raw = parseInt(String((env || process.env).FC_NUM_RUNS || ''), 10);
  if (Number.isInteger(raw) && raw > 0) return Math.min(raw, MAX_NUM_RUNS);
  return DEFAULT_NUM_RUNS;
}

// STRESS=1 打开超大/海量用例（超长文本、海量条目）；默认关闭以保持本地与 CI 时长可控。
function stressEnabled(env) {
  return String((env || process.env).STRESS || '').trim() === '1';
}

/**
 * 确定性 PRNG（mulberry32）：供不依赖 fast-check 的载荷生成器使用（如恶意语料组合）。
 * 同一 seed 必须产生同一序列，保证失败可复现。
 * @param {number} seed
 * @returns {{ next: () => number, int: (min: number, max: number) => number, bool: (p?: number) => boolean, pick: <T>(items: readonly T[]) => T }}
 */
function makeRng(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    bool(p) {
      return next() < (p == null ? 0.5 : p);
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    }
  };
}

// 测试名 → 文件名安全片段；时间戳取 UTC ISO 并把冒号/点替换为连字符（Windows 文件名兼容）。
function failureFileName(testName, date) {
  const safe = String(testName || 'unnamed').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
  const stamp = (date || new Date()).toISOString().replace(/[:.]/g, '-');
  return safe + '-' + stamp + '.json';
}

// JSON 序列化保护：counterexample 可能含 BigInt/循环等非常规值，退化时用 String 兜底，
// 保证留档本身绝不因序列化失败而丢掉失败信息。
function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify(String(value));
  }
}

/**
 * 记录一次属性测试失败：写入 build-artifacts/fuzz-failures/<test>-<UTC时间戳>.json。
 * 留档失败只告警，不改变（已经失败的）测试结果。
 * @param {string} testName
 * @param {{ seed?: number|null, counterexample?: unknown, replayCommand?: string, runs?: number|null, error?: string }} details
 * @returns {string} 留档文件绝对路径；写入失败返回空串
 */
function recordFailure(testName, details) {
  const info = details || {};
  const record = {
    test: String(testName || ''),
    recordedAt: new Date().toISOString(),
    seed: info.seed == null ? null : info.seed,
    counterexample: info.counterexample === undefined ? null : info.counterexample,
    replayCommand: info.replayCommand ? String(info.replayCommand) : '',
    runs: info.runs == null ? null : info.runs,
    error: info.error ? String(info.error).slice(0, 4000) : '',
    node: process.version,
    platform: process.platform + '-' + process.arch
  };
  let text;
  try {
    text = JSON.stringify(record, null, 2) + '\n';
  } catch (err) {
    text = JSON.stringify({ test: record.test, seed: record.seed, replayCommand: record.replayCommand, serializeError: String(err) }, null, 2) + '\n';
  }
  try {
    fs.mkdirSync(FAILURE_DIR, { recursive: true });
    const file = path.join(FAILURE_DIR, failureFileName(testName, new Date()));
    fs.writeFileSync(file, text, 'utf-8');
    process.stderr.write('[fuzz-failure] 已留档 ' + path.relative(PROJECT_ROOT, file) + '\n');
    return file;
  } catch (err) {
    process.stderr.write('[fuzz-failure] 留档失败（不影响测试判定）: ' + err.message + '\n');
    return '';
  }
}

/**
 * 构造复现命令（POSIX 形式；PowerShell 用 `$env:TEST_SEED='<seed>'; npm run test:fuzz`）。
 * @param {number} seed
 * @param {number} [runs]
 * @returns {string}
 */
function replayCommand(seed, runs) {
  return 'TEST_SEED=' + seed + ' FC_NUM_RUNS=' + (runs || numRuns()) + ' npm run test:fuzz';
}

/**
 * 运行一个 fast-check 属性：用基准种子与 FC_NUM_RUNS 迭代；失败时留档并抛出带复现信息的错误。
 * 使用 fc.check（不抛异常）以便在留档完成后再决定失败，避免丢失 counterexample。
 * @param {string} testName
 * @param {any} fcApi fast-check 模块
 * @param {any} property fc.property(...) 生成的属性
 * @param {{ seed?: number, numRuns?: number, env?: Record<string, string|undefined>, checkOptions?: object }} [options]
 * @returns {{ failed: boolean, numRuns: number, seed: number }}
 */
function checkProperty(testName, fcApi, property, options) {
  const opts = options || {};
  const runs = opts.numRuns || numRuns(opts.env);
  const seed = opts.seed == null ? resolveSeed(opts.env) : opts.seed;
  const details = fcApi.check(property, Object.assign({ seed: seed >>> 0, numRuns: runs }, opts.checkOptions || {}));
  if (!details.failed) {
    return { failed: false, numRuns: details.numRuns, seed };
  }
  const replay = replayCommand(seed, runs);
  recordFailure(testName, {
    seed,
    counterexample: details.counterexample,
    replayCommand: replay,
    runs,
    error: details.error ? String(details.error) : ''
  });
  /** @type {Error & { counterexample?: unknown, fuzzSeed?: number, replayCommand?: string }} */
  const error = new Error(
    '[fuzz] ' + testName + ' 失败：seed=' + seed + ' numRuns=' + runs +
    '\ncounterexample: ' + safeJson(details.counterexample) +
    '\n重放：' + replay
  );
  error.counterexample = details.counterexample;
  error.fuzzSeed = seed;
  error.replayCommand = replay;
  throw error;
}

module.exports = {
  PROJECT_ROOT,
  FAILURE_DIR,
  DEFAULT_NUM_RUNS,
  randomSeed,
  parseSeed,
  resolveSeed,
  numRuns,
  stressEnabled,
  makeRng,
  failureFileName,
  recordFailure,
  replayCommand,
  checkProperty
};

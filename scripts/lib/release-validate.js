'use strict';
// RELEASE.json 发布状态校验：tag 触发 CI 与本地 release:publish 共用同一套判定。
// 双重校验语义：只有「tag 存在」且「该 tag 指向的提交内 RELEASE.json 为 verified 且各字段自洽」
// 同时成立，才允许创建 Release；错误逐条返回，便于 CI 日志与人工排障。

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isSemver, normalizeTagVersion, RELEASE_GATES } = require('./release-version');

const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ISO 8601 UTC 严格校验：正则 + 逐字段范围 + 按月天数（拒绝 2026-02-30 这类被引擎进位的日期）。
function isValidIsoUtc(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_UTC_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  return !Number.isNaN(Date.parse(value));
}

// 校验入口。options：
//   tag            可选，vX.Y.Z；提供时校验 tag 与 version 一致
//   version        可选，期望版本；与 tag 二选一或同传（两者必须一致）
//   commit         可选，tag 指向的完整提交 SHA（40 位小写十六进制）
//   requiredChecks 可选，必须存在且为 true 的 checks 键清单（默认使用 RELEASE_GATES）
// 返回 { ok, errors }，errors 为逐条中文错误说明。
function validateReleaseState(state, options) {
  const opts = options || {};
  const errors = [];
  if (!isPlainObject(state)) {
    return { ok: false, errors: ['RELEASE.json 必须是 JSON 对象'] };
  }
  if (state.schemaVersion !== 1) {
    errors.push('schemaVersion 必须为 1（当前：' + JSON.stringify(state.schemaVersion) + '）');
  }
  if (!isSemver(state.version)) {
    errors.push('version 必须是 X.Y.Z 形式（当前：' + JSON.stringify(state.version) + '）');
  }

  // tag / version 一致性：tag 必须是 v + version。
  let expectedVersion = typeof opts.version === 'string' && opts.version !== '' ? opts.version : '';
  if (typeof opts.tag === 'string' && opts.tag !== '') {
    let tagVersion = '';
    try {
      tagVersion = normalizeTagVersion(opts.tag);
    } catch (err) {
      errors.push('tag 必须是 vX.Y.Z 形式（当前：' + opts.tag + '）');
    }
    if (tagVersion && expectedVersion && tagVersion !== expectedVersion) {
      errors.push('tag ' + opts.tag + ' 与期望版本 ' + expectedVersion + ' 不一致');
    }
    if (tagVersion) expectedVersion = tagVersion;
  }
  if (expectedVersion && isSemver(state.version) && state.version !== expectedVersion) {
    errors.push('version 与 tag 不一致：RELEASE.json=' + state.version + '，tag=v' + expectedVersion);
  }

  if (state.status !== 'verified') {
    errors.push('status 必须为 verified（当前：' + JSON.stringify(state.status) + '）——未完成标记不得发布');
  }
  if (typeof state.humanVerifiedBy !== 'string' || state.humanVerifiedBy.trim() === '') {
    errors.push('humanVerifiedBy 必须为非空字符串（记录人工核验人）');
  }
  if (!isValidIsoUtc(state.verifiedAt)) {
    errors.push('verifiedAt 必须是合法的 ISO 8601 UTC 时间（如 2026-09-27T12:00:00.000Z）');
  }
  if (typeof state.commit !== 'string' || !COMMIT_RE.test(state.commit)) {
    errors.push('commit 必须是 40 位小写十六进制提交 SHA（当前：' + JSON.stringify(state.commit) + '）');
  } else if (typeof opts.commit === 'string' && opts.commit !== '' && state.commit !== opts.commit.toLowerCase()) {
    errors.push('commit 与期望提交（tag 指向提交的父提交）不一致：RELEASE.json=' + state.commit + '，期望=' + opts.commit.toLowerCase());
  }

  if (!isPlainObject(state.checks) || Object.keys(state.checks).length === 0) {
    errors.push('checks 必须是非空对象（逐项门禁结果）');
  } else {
    const failed = Object.keys(state.checks).filter(function (key) { return state.checks[key] !== true; });
    if (failed.length > 0) {
      errors.push('checks 存在非 true 项：' + failed.join(', '));
    }
    const required = Array.isArray(opts.requiredChecks) && opts.requiredChecks.length > 0
      ? opts.requiredChecks
      : RELEASE_GATES.map(function (gate) { return gate.key; });
    const missing = required.filter(function (key) { return state.checks[key] !== true; });
    if (missing.length > 0) {
      errors.push('checks 缺少必需门禁项（未通过或未记录）：' + missing.join(', '));
    }
  }

  return { ok: errors.length === 0, errors };
}

// CLI：在 tag 检出点读取该 tag 指向的 RELEASE.json 并校验（CI validate 作业调用）。
// 用法：node scripts/lib/release-validate.js --tag vX.Y.Z
function runCli(argv) {
  const root = path.resolve(__dirname, '..', '..');
  const usage = '用法：node scripts/lib/release-validate.js --tag vX.Y.Z';
  let tag = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tag') {
      tag = argv[i + 1] || '';
      i += 1;
    } else if (argv[i].startsWith('--tag=')) {
      tag = argv[i].slice('--tag='.length);
    } else {
      console.error('[release-validate] 未知参数：' + argv[i]);
      console.error(usage);
      return 1;
    }
  }
  if (!tag) {
    console.error(usage);
    return 1;
  }

  // RELEASE.json.commit 记录被核验提交（tag 指向提交的父提交；git 提交无法包含自身 SHA）。
  const commitResult = spawnSync('git', ['rev-parse', tag + '^{commit}^'], { cwd: root, encoding: 'utf-8' });
  if (commitResult.error || commitResult.status !== 0) {
    console.error('[release-validate] 无法解析 tag ' + tag + ' 的父提交：' + ((commitResult.stderr || '').trim() || 'git rev-parse 失败'));
    return 1;
  }
  const commit = commitResult.stdout.trim();

  const stateResult = spawnSync('git', ['show', tag + ':RELEASE.json'], { cwd: root, encoding: 'utf-8' });
  if (stateResult.error || stateResult.status !== 0) {
    console.error('[release-validate] 无法读取 ' + tag + ':RELEASE.json：' + ((stateResult.stderr || '').trim() || '文件不存在'));
    return 1;
  }
  let state;
  try {
    state = JSON.parse(stateResult.stdout);
  } catch (err) {
    console.error('[release-validate] ' + tag + ':RELEASE.json 不是合法 JSON：' + err.message);
    return 1;
  }

  const result = validateReleaseState(state, { tag: tag, commit: commit });
  if (!result.ok) {
    console.error('[release-validate] tag ' + tag + '（' + commit + '）校验失败：');
    for (const error of result.errors) console.error('  - ' + error);
    return 1;
  }
  console.log('[release-validate] ' + tag + ' @ ' + commit + ' 校验通过：status=verified、version=' + state.version + '、核验人=' + state.humanVerifiedBy);
  return 0;
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = { validateReleaseState, isPlainObject, runCli };

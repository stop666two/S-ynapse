'use strict';
// 发布域纯函数层：版本计算、CHANGELOG 改写、RELEASE.json 构造。
// 与 release-validate.js 分工：本模块负责「生成」，后者负责「校验」；两者共用同一门禁清单。

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 前置质量门禁清单（顺序即 release:mark 的执行顺序，也是 RELEASE.json.checks 的必需键）。
// key 用于 checks 映射；command 为在仓库根执行的 shell 命令。
const RELEASE_GATES = Object.freeze([
  { key: 'lint', command: 'npm run lint', label: 'ESLint 静态检查' },
  { key: 'typecheck', command: 'npm run typecheck', label: 'TypeScript checkJs' },
  { key: 'test', command: 'npm test', label: '单元测试' },
  { key: 'test-build', command: 'npm run test:build', label: '构建冒烟' },
  { key: 'verify-config', command: 'npm run verify:config', label: '配置一致性' },
  { key: 'verify-config-refs', command: 'npm run verify:config-refs', label: '配置零引用键' },
  { key: 'verify-config-comments', command: 'npm run verify:config-comments', label: '配置逐键注释' },
  { key: 'verify-config-docs', command: 'npm run verify:config-docs', label: '配置文档覆盖' },
  { key: 'verify-security', command: 'npm run verify:security', label: '安全集成回归' },
  { key: 'verify-compression', command: 'npm run verify:compression', label: '压缩无头对比' },
  { key: 'build', command: 'npm run build', label: '真实构建' }
]);

// CHANGELOG 版本链接基址（与仓库现有链接保持一致）。
const CHANGELOG_LINK_BASE = 'https://github.com/stop666two/S-ynapse/releases/tag/';

function isSemver(value) {
  return typeof value === 'string' && SEMVER_RE.test(value);
}

function parseSemver(value) {
  if (!isSemver(value)) return null;
  const match = SEMVER_RE.exec(value);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

// 语义化比较：> 0 表示 a 大于 b，< 0 表示小于，0 表示相等。
function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) throw new Error('compareSemver 需要合法的 X.Y.Z 版本号');
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return 0;
}

// 计算目标版本：bump 支持 major/minor/patch 关键字或显式 X.Y.Z（必须大于当前版本）。
function computeNextVersion(currentVersion, bump) {
  const current = parseSemver(currentVersion);
  if (!current) throw new Error('当前版本不是合法的 X.Y.Z：' + currentVersion);
  if (bump === 'major') {
    return (current.major + 1) + '.0.0';
  }
  if (bump === 'minor') {
    return current.major + '.' + (current.minor + 1) + '.0';
  }
  if (bump === 'patch') {
    return current.major + '.' + current.minor + '.' + (current.patch + 1);
  }
  if (isSemver(bump)) {
    if (compareSemver(bump, currentVersion) <= 0) {
      throw new Error('显式版本 ' + bump + ' 必须大于当前版本 ' + currentVersion);
    }
    return bump;
  }
  throw new Error('无效的版本参数（可用：major|minor|patch|X.Y.Z）：' + String(bump));
}

// 从 tag（vX.Y.Z）解析语义版本号；非法 tag 抛错。
function normalizeTagVersion(tag) {
  if (typeof tag !== 'string' || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error('tag 必须是 vX.Y.Z 形式：' + String(tag));
  }
  return tag.slice(1);
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// CHANGELOG 发布改写：保留 [Unreleased] 标题作为下一次的占位，
// 将其后的全部内容归入新版本段，并在文末补充版本链接定义。
function rewriteChangelog(text, version, date) {
  if (typeof text !== 'string' || text === '') throw new Error('CHANGELOG 内容为空');
  if (!isSemver(version)) throw new Error('版本号必须是 X.Y.Z：' + version);
  if (typeof date !== 'string' || !DATE_RE.test(date)) throw new Error('日期必须是 YYYY-MM-DD：' + String(date));
  if (new RegExp('^## \\[' + escapeRegExp(version) + '\\]', 'm').test(text)) {
    throw new Error('CHANGELOG 已存在 [' + version + '] 段，拒绝重复发布');
  }
  const unreleased = /^## \[Unreleased\][^\S\r\n]*$/m.exec(text);
  if (!unreleased) throw new Error('CHANGELOG 未找到 "## [Unreleased]" 标题，无法改写');
  let updated = text.replace(
    unreleased[0],
    unreleased[0] + '\n\n## [' + version + '] - ' + date
  );
  const link = '[' + version + ']: ' + CHANGELOG_LINK_BASE + 'v' + version;
  if (!updated.includes('[' + version + ']:')) {
    updated = updated.replace(/\s*$/, '\n') + link + '\n';
  }
  return updated;
}

// 生成 RELEASE.json 对象（字段顺序固定，便于差异阅读）。
function buildReleaseState(fields) {
  const source = fields || {};
  return {
    schemaVersion: 1,
    version: source.version || '',
    status: source.status || 'unverified',
    humanVerifiedBy: source.humanVerifiedBy || '',
    verifiedAt: source.verifiedAt || '',
    commit: source.commit || '',
    checks: source.checks || {}
  };
}

// 门禁全部通过时的 checks 映射（每个 key 必须为 true 才能通过发布校验）。
function buildPassedChecks() {
  const checks = {};
  for (const gate of RELEASE_GATES) checks[gate.key] = true;
  return checks;
}

module.exports = {
  SEMVER_RE,
  RELEASE_GATES,
  CHANGELOG_LINK_BASE,
  isSemver,
  parseSemver,
  compareSemver,
  computeNextVersion,
  normalizeTagVersion,
  formatUtcDate,
  rewriteChangelog,
  buildReleaseState,
  buildPassedChecks
};

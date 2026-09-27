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

// 解析发布目标：仅显式 X.Y.Z 且等于当前版本时走「同版本标记」（sameVersion=true，为当前版本建首个 Release）；
// 其余输入复用 computeNextVersion 的递增语义（关键字递增或显式更高版本，低于/等于当前版本的非法组合仍抛错）。
function resolveReleaseTarget(currentVersion, bump) {
  if (!parseSemver(currentVersion)) throw new Error('当前版本不是合法的 X.Y.Z：' + currentVersion);
  if (isSemver(bump) && compareSemver(bump, currentVersion) === 0) {
    return { version: bump, sameVersion: true };
  }
  return { version: computeNextVersion(currentVersion, bump), sameVersion: false };
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

// —— CHANGELOG 发布变换（Keep a Changelog 结构）——
// 按输入现状分四类处理：
//   merge  有 [Unreleased] 且已有目标版本段：Unreleased 各小节按标题合并进目标段（新条目在前、既有条目保留），
//          删除 [Unreleased]，目标段日期更新为发布日；
//   rename 有 [Unreleased] 且无目标版本段：[Unreleased] 标题重命名为 [X.Y.Z] - 日期；
//   create 无 [Unreleased] 且无目标版本段：在最新版本段前新建空的目标版本段；
//   ensure 无 [Unreleased] 且目标版本段已存在：仅确保版本链接存在。
// 所有分支都不改动其他段落内容，并在缺少 [X.Y.Z] 链接定义时补到链接引用块末尾。

const SECTION_RE = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?[^\S\r\n]*$/;
const SUBSECTION_RE = /^### (.+?)[^\S\r\n]*$/;
const LINK_REF_RE = /^\[[^\]]+\]:\s*\S/;

// 解析顶层段落（标题/日期/行号）与文末链接引用块起始行；正文范围 = 标题后一行至下一段标题或链接块。
function parseChangelog(text) {
  const lines = text.split('\n');
  /** @type {Array<{ title: string, date: string, headingIndex: number, bodyStart: number, bodyEnd: number }>} */
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const match = SECTION_RE.exec(lines[i]);
    if (match) sections.push({ title: match[1], date: match[2] || '', headingIndex: i, bodyStart: i + 1, bodyEnd: i + 1 });
  }
  let linkStart = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '') continue;
    if (LINK_REF_RE.test(lines[i])) {
      linkStart = i;
      continue;
    }
    break;
  }
  for (let i = 0; i < sections.length; i++) {
    const next = sections[i + 1];
    sections[i].bodyStart = sections[i].headingIndex + 1;
    sections[i].bodyEnd = next ? next.headingIndex : linkStart;
  }
  return { lines, sections, linkStart };
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start += 1;
  while (end > start && lines[end - 1].trim() === '') end -= 1;
  return lines.slice(start, end);
}

// 段落正文解析为「头部杂项 + 按出现顺序的小节组」，条目行原样保留（含多行明细与空行）。
function parseSubsections(bodyLines) {
  const head = [];
  const groups = [];
  let current = null;
  for (const line of bodyLines) {
    const match = SUBSECTION_RE.exec(line);
    if (match) {
      current = { title: match[1], items: [] };
      groups.push(current);
    } else if (current) {
      current.items.push(line);
    } else {
      head.push(line);
    }
  }
  return {
    head: trimBlankLines(head),
    groups: groups.map(group => ({ title: group.title, items: trimBlankLines(group.items) }))
  };
}

// 渲染为段落正文：小节之间空一行，小节标题与条目之间空一行。
function renderSubsections(head, groups) {
  const parts = [];
  if (head.length > 0) parts.push(head.join('\n'));
  for (const group of groups) {
    const block = group.items.length > 0
      ? '### ' + group.title + '\n\n' + group.items.join('\n')
      : '### ' + group.title;
    parts.push(block);
  }
  return parts.join('\n\n');
}

function countEntries(lines) {
  return lines.filter(line => line.startsWith('- ')).length;
}

// 合并小节：同标题的 Unreleased 条目插到目标小节已有条目之前（新条目在上），
// 目标段没有的标题按 Unreleased 中的顺序追加到末尾。
function mergeSubsections(target, unreleased) {
  const groups = target.groups.map(group => ({ title: group.title, items: group.items.slice() }));
  for (const source of unreleased.groups) {
    if (source.items.length === 0) continue;
    const existing = groups.find(group => group.title === source.title);
    if (existing) {
      const separator = existing.items.length > 0 ? [''] : [];
      existing.items = source.items.concat(separator, existing.items);
    } else {
      groups.push({ title: source.title, items: source.items.slice() });
    }
  }
  const separator = unreleased.head.length > 0 && target.head.length > 0 ? [''] : [];
  return { head: unreleased.head.concat(separator, target.head), groups };
}

// 版本链接检查与补齐：已有 [X.Y.Z]: 定义则原样保留，缺失时追加到链接引用块末尾。
function appendVersionLink(text, version) {
  if (new RegExp('^\\[' + escapeRegExp(version) + '\\]:', 'm').test(text)) {
    return { text, added: false };
  }
  const link = '[' + version + ']: ' + CHANGELOG_LINK_BASE + 'v' + version;
  const normalized = text.replace(/\s*$/, '');
  const tail = normalized.split('\n').pop() || '';
  const separator = LINK_REF_RE.test(tail) ? '\n' : '\n\n';
  return { text: normalized + separator + link + '\n', added: true };
}

// 纯函数：分析 CHANGELOG 现状与目标版本的关系，返回变换计划与改写后的文本。
// mode：merge / rename / create / ensure（语义见上方说明）；mergedSubsections 为待合并小节及条目数。
function planChangelogRewrite(text, version, date) {
  if (typeof text !== 'string' || text === '') throw new Error('CHANGELOG 内容为空');
  if (!isSemver(version)) throw new Error('版本号必须是 X.Y.Z：' + version);
  if (typeof date !== 'string' || !DATE_RE.test(date)) throw new Error('日期必须是 YYYY-MM-DD：' + String(date));
  const parsed = parseChangelog(text);
  const unreleased = parsed.sections.find(section => section.title === 'Unreleased') || null;
  const target = parsed.sections.find(section => section.title === version) || null;
  const plan = {
    mode: 'ensure',
    version,
    date,
    sectionsRemoved: [],
    sectionsRenamed: [],
    mergedSubsections: [],
    headingCreated: false,
    linkAdded: false,
    text: ''
  };
  let lines = parsed.lines.slice();

  if (unreleased && target) {
    plan.mode = 'merge';
    const unreleasedBody = parseSubsections(parsed.lines.slice(unreleased.bodyStart, unreleased.bodyEnd));
    const targetBody = parseSubsections(parsed.lines.slice(target.bodyStart, target.bodyEnd));
    const merged = mergeSubsections(targetBody, unreleasedBody);
    const rendered = renderSubsections(merged.head, merged.groups);
    plan.mergedSubsections = unreleasedBody.groups
      .filter(group => group.items.length > 0)
      .map(group => ({ title: group.title, entries: countEntries(group.items) }));
    const rebuilt = [];
    for (let i = 0; i < lines.length; i++) {
      if (i >= unreleased.headingIndex && i < unreleased.bodyEnd) continue;
      if (i === target.headingIndex) {
        rebuilt.push('## [' + version + '] - ' + date, '');
        if (rendered !== '') rebuilt.push(rendered);
        rebuilt.push('');
        i = target.bodyEnd - 1;
        continue;
      }
      rebuilt.push(lines[i]);
    }
    lines = rebuilt;
    plan.sectionsRemoved.push('Unreleased');
  } else if (unreleased) {
    plan.mode = 'rename';
    lines[unreleased.headingIndex] = '## [' + version + '] - ' + date;
    plan.sectionsRenamed.push('Unreleased');
  } else if (!target) {
    plan.mode = 'create';
    if (parsed.sections.length > 0) {
      lines.splice(parsed.sections[0].headingIndex, 0, '## [' + version + '] - ' + date, '');
    } else {
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('');
      lines.push('## [' + version + '] - ' + date, '');
    }
    plan.headingCreated = true;
  }

  const linked = appendVersionLink(lines.join('\n'), version);
  plan.linkAdded = linked.added;
  plan.text = linked.text;
  return plan;
}

// CHANGELOG 发布改写入口：仅返回改写后的文本（计划与实现同源，见 planChangelogRewrite）。
function rewriteChangelog(text, version, date) {
  return planChangelogRewrite(text, version, date).text;
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
  resolveReleaseTarget,
  normalizeTagVersion,
  formatUtcDate,
  planChangelogRewrite,
  rewriteChangelog,
  buildReleaseState,
  buildPassedChecks
};

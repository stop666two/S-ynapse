'use strict';
// 发布描述（Release Notes）生成纯函数层：CHANGELOG 段提取、上一 tag 选择、
// 远端解析、SHA-256 与完整 Markdown 渲染。
//
// 设计约束：
//   - 纯函数、无 I/O、无当前时间——同一输入必得同一字节输出，便于测试与复现；
//   - 质量门禁清单与 scripts/lib/release-version.js 的 RELEASE_GATES 同源，
//     门禁项新增/改名时本模块自动跟随，不维护第二份清单；
//   - 输出统一 LF（normalizeLineEndings），GitHub Release 正文与仓库文件一致。
const crypto = require('node:crypto');
const { RELEASE_GATES, isSemver } = require('./release-version');

// 归档文件名约定（S-ynapse-<version>.zip），与 release-archive/release.yml 一致。
function buildArchiveName(version) {
  return 'S-ynapse-' + version + '.zip';
}

// 行尾归一化为 LF（RFC 3629 文本 + 跨平台一致）；渲染本身只产出 '\n'，
// 此函数用于净化来自 CHANGELOG 等外部输入中可能混入的 CRLF。
function normalizeLineEndings(text) {
  return String(text).replace(/\r\n?/g, '\n');
}

// 从 CHANGELOG 文本提取指定版本段正文（`## [X.Y.Z]` 到下一 `## [` 或文件尾）。
// 返回 { found, body }；版本段缺失时 found=false 交由调用方决定报错策略。
// body 保留原样（含 ### Added/Changed/Fixed/Removed 子段与条目），仅去除首尾空行。
function extractChangelogSection(changelogText, version) {
  if (typeof changelogText !== 'string') throw new TypeError('changelogText 必须是字符串');
  if (typeof version !== 'string' || !isSemver(version)) {
    throw new Error('version 必须是合法 SemVer（X.Y.Z 或 X.Y.Z-预发布）：' + String(version));
  }
  const lines = normalizeLineEndings(changelogText).split('\n');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRe = new RegExp('^## \\[' + escaped + '\\]');
  const anyHeadingRe = /^## \[/;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return { found: false, body: '' };
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (anyHeadingRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  const body = lines.slice(start, end).join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
  return { found: true, body };
}

// 从已按 creatordate 降序排列的 tag 列表中，选择目标 tag 之后（更早发布）的第一个 v* 版本标签。
// 非版本标签（如 nightly-*）跳过；目标不在列表或没有更早版本时返回 null（调用方回退首个提交锚点）。
function pickPreviousTag(tags, targetTag) {
  if (!Array.isArray(tags)) return null;
  const index = tags.indexOf(targetTag);
  if (index === -1) return null;
  for (let i = index + 1; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof tag === 'string' && tag.startsWith('v') && isSemver(tag.slice(1))) return tag;
  }
  return null;
}

// 解析远端地址为 { owner, repo }，支持 https://host/owner/repo(.git)、
// git@host:owner/repo(.git) 与 ssh://git@host/owner/repo(.git)；无法解析返回 null。
function parseOwnerRepo(remoteUrl) {
  if (typeof remoteUrl !== 'string') return null;
  const raw = normalizeLineEndings(remoteUrl).trim();
  if (raw === '') return null;
  let pathname;
  const scpMatch = /^[^@/\s]+@[^:/\s]+:(.+)$/.exec(raw);
  if (scpMatch) {
    pathname = scpMatch[1];
  } else {
    const urlMatch = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/\s]+@)?[^/\s]+(\/.*)?$/i.exec(raw);
    if (!urlMatch) return null;
    pathname = urlMatch[1] || '';
  }
  const segments = pathname.replace(/\.git$/i, '').split('/').filter(function (segment) { return segment !== ''; });
  if (segments.length < 2) return null;
  return { owner: segments[segments.length - 2], repo: segments[segments.length - 1] };
}

// 拼装 GitHub 版本对比链接；from 可以是上一 tag 或首个提交 SHA。
function buildCompareUrl(owner, repo, from, to) {
  return 'https://github.com/' + owner + '/' + repo + '/compare/' + from + '...' + to;
}

// SHA-256 十六进制摘要（接受字符串或 Buffer）；用于归档校验和展示。
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 字节数展示：<1 KiB 用字节，否则保留一位小数的 KiB（发布附件通常远小于 MiB）。
function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return String(bytes) + ' 字节';
  return (bytes / 1024).toFixed(1) + ' KiB（' + bytes + ' 字节）';
}

// 渲染门禁清单：逐项名称 + ✅（清单来自 RELEASE_GATES，release 创建前全部已通过）。
function renderGates() {
  return RELEASE_GATES.map(function (gate) {
    return '- ✅ ' + gate.label + '（`' + gate.command + '`）';
  }).join('\n');
}

// 渲染 RELEASE.json 摘要；读不到（null）时明确标注，不伪造状态。
function renderReleaseState(state) {
  if (!state || typeof state !== 'object') {
    return 'RELEASE.json：未能读取（缺失或不在目标 tag 内）；发布门禁结果以流水线 validate 作业为准。';
  }
  return [
    'RELEASE.json：',
    '',
    '- status：' + (state.status || '（缺失）'),
    '- humanVerifiedBy：' + (state.humanVerifiedBy || '（缺失）'),
    '- verifiedAt：' + (state.verifiedAt || '（缺失）'),
    '- commit：' + (state.commit || '（缺失）')
  ].join('\n');
}

// 渲染归档信息：提供 --archive 时展示文件名/大小/SHA-256；
// 未提供时说明校验和由 CI 附件流程提供（publish 作业传入 archive 即可计算）。
function renderArchive(archive, version) {
  const name = archive && archive.name ? archive.name : buildArchiveName(version);
  if (!archive) {
    return [
      '归档：',
      '',
      '- 文件：' + name + '（由 CI 附件流程上传）',
      '- 校验和：本次生成未传入 `--archive`，SHA-256 由 CI 附件流程提供'
    ].join('\n');
  }
  return [
    '归档：',
    '',
    '- 文件：' + name,
    '- 大小：' + formatByteSize(archive.bytes),
    '- SHA-256：' + archive.sha256
  ].join('\n');
}

// 渲染完整 Release 描述（确定性：不含生成时间，同输入同字节）。
// changelogText 中缺目标版本段时抛错并提示先补 CHANGELOG（发布标记本应保证段存在）。
function renderReleaseNotes(input) {
  const data = input || {};
  const version = data.version;
  const tag = data.tag;
  if (typeof version !== 'string' || !isSemver(version)) {
    throw new Error('version 必须是合法 SemVer（X.Y.Z 或 X.Y.Z-预发布）：' + String(version));
  }
  if (typeof tag !== 'string' || tag !== 'v' + version) {
    throw new Error('tag 必须与版本一致（v' + version + '）：' + String(tag));
  }
  const section = extractChangelogSection(data.changelogText, version);
  if (!section.found) {
    throw new Error(
      'CHANGELOG.md 中未找到 [' + version + '] 版本段：请先运行 npm run release:mark 生成版本段，或确认目标 tag 的版本号正确'
    );
  }
  const owner = data.owner;
  const repo = data.repo;
  const compareFrom = data.previousTag || data.firstCommit || '';
  const compareLine = owner && repo && compareFrom
    ? '版本对比：' + buildCompareUrl(owner, repo, compareFrom, tag)
    : '无法解析远端仓库地址或版本基线，省略版本对比链接。';
  const archiveName = data.archive && data.archive.name ? data.archive.name : buildArchiveName(version);
  const nodeVersion = typeof data.nodeVersion === 'string' && data.nodeVersion.trim() !== ''
    ? data.nodeVersion.trim()
    : '（未声明）';

  const lines = [
    '# S-ynapse ' + tag,
    '',
    '## 本版变更',
    '',
    section.body,
    '',
    '## 质量与校验',
    '',
    '发布门禁（' + RELEASE_GATES.length + ' 项全部通过，清单与 `scripts/lib/release-version.js` 的 `RELEASE_GATES` 同源）：',
    '',
    renderGates(),
    '',
    renderReleaseState(data.releaseState),
    '',
    renderArchive(data.archive, version),
    '',
    '构建环境：Node ' + nodeVersion + '（`.nvmrc`；CI 经 `node-version-file` 单源读取）。',
    '',
    '构建可用性：归档解压后在空站骨架（0 文章）上依次执行 `npm ci --ignore-scripts` → `npm test` → `npm run build`，'
      + '由发布流水线的 buildability 作业断言通过（关键产物 `dist/index.html`、`dist/build-report.html`、每语言搜索页与内容寻址搜索索引）。',
    '',
    '## 安装与使用',
    '',
    '1. 解压 `' + archiveName + '`，进入解压后的目录',
    '2. `npm ci`',
    '3. `npm run build`（Windows 可直接运行 `build.bat`）',
    '',
    '开发预览：`npm ci && npm run serve`（默认 http://localhost:3000）。',
    '',
    '## 完整变更',
    '',
    compareLine,
    '',
    '## 附件',
    '',
    '- `' + archiveName + '` — 基础包（空站骨架；不含示例文章与演示媒体，解压后按上述步骤即可构建）',
    ''
  ];
  return normalizeLineEndings(lines.join('\n'));
}

module.exports = {
  buildArchiveName,
  normalizeLineEndings,
  extractChangelogSection,
  pickPreviousTag,
  parseOwnerRepo,
  buildCompareUrl,
  sha256Hex,
  formatByteSize,
  renderReleaseNotes
};

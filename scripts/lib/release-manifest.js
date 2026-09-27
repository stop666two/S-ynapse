'use strict';
// Release 归档白名单的单一来源（release:archive 与 CI publish 共用）。
//
// 用途：
//   1. listReleaseIncludePaths() 生成 `git archive` 的 pathspec，只打包白名单内容；
//   2. isReleaseAllowed() 对归档内每个条目做白名单判定（默认拒绝）；
//   3. assertArchiveContents() 在 zip 生成后复核，任何越界条目立即抛错，阻止发布。
//
// 设计（口径：README 中除文档类外的每项能力，其所需文件都必须随包分发，
// 解压后 `npm ci && npm run build` 必须成功并产出可部署站点）：
//   - 包含：应用代码（js/scripts/templates/workers）、构建与发布入口（build.bat/serve.bat、
//     eslint.config.js、tsconfig.json、wrangler.toml）、站点内容与构建输入
//     （articles/pages/media/static）、git hook（.githooks）、根全部 *.json5 与锁文件；
//   - 排除：文档（docs/**、CHANGELOG.md、SECURITY.md）、CI 配置（.github/**）、
//     本地派生副本/缓存/构建产物（real-site/dist/node_modules/.cache/backups 等）
//     与构建期生成物（workers/security-config.js）；
//   - 可选内容目录 videos/ 与 assets/ 当前仓库尚无内容：`git archive` 对未匹配的
//     pathspec 直接失败（exit 128），不能预先写入 pathspec；待目录出现内容时显式加入
//     （未知路径默认拒绝会保证其不会悄悄入包）；
//   - 排除清单用于「即使未来包含模式扩大也必须排除」的路径，判定时优先于包含规则；
//   - 根目录 `*.json5` 采用非递归匹配（只允许根文件），避免任意深度的同名文件被放行；
//   - 未知路径一律拒绝，新增目录必须显式加入白名单，防止无意打包。

// 允许整目录递归包含且必须有内容的顶层目录（应用源码 + 站点内容）。
const RELEASE_REQUIRED_DIRS = Object.freeze([
  '.githooks', // git hooks（npm run init / postinstall 安装 pre-commit 保护）
  'articles',  // Markdown 文章（解压即可构建的非空站点内容）
  'js',        // 浏览器端运行时模块
  'media',     // 站点图片（构建预校验会因缺失 /media 引用直接失败）
  'pages',     // 自定义页面内容
  'scripts',   // 构建、验证与发布脚本（含 *.test.js，便于解压后运行 npm test）
  'static',    // 静态文件（构建直接复制进 dist/）
  'templates', // EJS 模板（构建站点必需）
  'workers'    // Cloudflare Worker 安全层与 wrangler.toml（通用版，无真实账户信息）
]);

// 允许整目录递归包含的顶层目录（当前与必需目录一致；保留独立常量以容纳未来的可选目录）。
const RELEASE_DIRS = Object.freeze(RELEASE_REQUIRED_DIRS.slice());

// 允许包含的根目录文件（逐项列出，多一个都必须显式评估）。
const RELEASE_ROOT_FILES = Object.freeze([
  'package.json',       // 依赖与 npm 命令入口
  'package-lock.json',  // 锁定依赖版本（可复现安装）
  '.env.example',       // 环境变量模板（真实 .env 永不入包）
  '.gitattributes',     // LF 归一化规则（跨平台解压一致）
  '.gitignore',         // 排除规则（解压后重新 npm install 不误提交）
  'LICENSE',            // 许可证
  'README.md',          // 安装/构建/部署说明（含下载提示）
  'RELEASE.json',       // 发布状态标记（版本 / 人工核验 / 门禁结果）
  'build.bat',          // Windows 一键构建（README 快捷脚本）
  'serve.bat',          // Windows 一键构建 + 本地预览
  'eslint.config.js',   // ESLint 10 扁平配置（npm run lint 必需）
  'tsconfig.json',      // TypeScript checkJs 配置（npm run typecheck 必需）
  'wrangler.toml'       // Cloudflare Pages 部署配置（deploy:pages / README 方式一）
]);

// 根目录 JSON5 配置文件名模式（非递归，仅根层）。
const RELEASE_ROOT_GLOB = '*.json5';

// 明确排除的路径模式（glob：** 跨目录、* 段内、? 单字符）。
// 这些路径即使未来被包含模式意外覆盖，也必须排除在发布包之外。
const RELEASE_EXCLUDE_PATTERNS = Object.freeze([
  'docs/**',                  // 开发文档，与运行无关
  '.github/**',               // CI 配置（发布工作流本身不需要随包分发）
  '.tmp-scripts/**',          // 本地临时脚本
  '.playwright-mcp/**',       // 浏览器测试产物
  'backups/**',               // 本地备份
  'real-site/**',             // 含真实数据的生产派生副本，永不入包
  'build-artifacts/**',       // SBOM 等构建产物
  'release-artifacts/**',     // 本工具生成的归档输出
  'dist/**',                  // 构建输出（解压后重新构建）
  'node_modules/**',          // 依赖目录
  '.cache/**',                // 构建缓存
  'workers/security-config.js' // 构建期由 security.json5 生成，可能含环境相关值
]);

// 归档必须包含的文件（发布包「解压即可构建」的最低断言）。
// 覆盖：元数据与锁文件、平台快捷脚本、构建/检查/部署配置、内容与模板入口、发布链路脚本与测试。
const RELEASE_REQUIRED_FILES = Object.freeze([
  'README.md',
  'LICENSE',
  'package.json',
  'package-lock.json',
  'RELEASE.json',
  '.env.example',
  'build.bat',
  'serve.bat',
  'eslint.config.js',
  'tsconfig.json',
  'wrangler.toml',
  'site.json5',
  'theme.json5',
  '.githooks/pre-commit',
  'js/core/main.js',
  'templates/layout.ejs',
  'templates/post.ejs',
  'scripts/build.js',
  'scripts/build.test.js',
  'scripts/release-mark.js',
  'scripts/release-archive.js',
  'scripts/release-publish.js',
  'scripts/release-prune.js',
  'workers/wrangler.toml'
]);

// 将反斜杠统一为正斜杠并去掉 ./ 前缀；返回 null 表示路径非法（绝对路径、含 ..、空）。
function normalizeRelPath(relPath) {
  if (typeof relPath !== 'string') return null;
  let value = relPath.trim().replace(/\\/g, '/');
  if (value === '') return null;
  while (value.startsWith('./')) value = value.slice(2);
  if (value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return null;
  const segments = value.split('/');
  if (segments.some(function (segment) { return segment === '..'; })) return null;
  return segments.filter(function (segment) { return segment !== '' && segment !== '.'; }).join('/');
}

// 最小 glob → 正则：** 跨目录（含零层）、* 段内、? 单字符，其余字符按字面量转义。
// 未直接复用 compression-config 的同名内部函数：那是压缩配置域的实现，发布域保持独立依赖。
function globToRegExp(pattern) {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          source += '(?:.*/)?';
          i += 2;
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
      source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + source + '$');
}

function matchesAny(target, patterns) {
  for (const pattern of patterns) {
    if (globToRegExp(pattern).test(target)) return true;
  }
  return false;
}

// 判定单个相对路径是否允许进入发布包（默认拒绝）。
function isReleaseAllowed(relPath) {
  const target = normalizeRelPath(relPath);
  if (target === null) return false;
  if (matchesAny(target, RELEASE_EXCLUDE_PATTERNS)) return false;
  if (RELEASE_ROOT_FILES.includes(target)) return true;
  const slash = target.indexOf('/');
  if (slash === -1) {
    return target.endsWith('.json5');
  }
  const topLevel = target.slice(0, slash);
  return RELEASE_DIRS.includes(topLevel);
}

// 生成 `git archive` 使用的 pathspec（:(top) 锚定仓库根，防止在子目录执行时解析偏移）。
function listReleaseIncludePaths() {
  const paths = RELEASE_DIRS.map(function (dir) { return ':(top,glob)' + dir + '/**'; });
  paths.push(':(top,glob)' + RELEASE_ROOT_GLOB);
  for (const file of RELEASE_ROOT_FILES) paths.push(':(top)' + file);
  return paths;
}

// 归档越界错误：附带 offenders 列表，调用方可直接打印违规条目。
class ReleaseArchiveContentError extends Error {
  constructor(message, offenders) {
    super(message);
    this.name = 'ReleaseArchiveContentError';
    this.offenders = offenders;
  }
}

// 归档后复核：entries 为 zip 内条目名数组（可含目录条目与统一前缀）。
// 任一非目录条目不在白名单内即抛错，错误对象附带 offenders 列表供调用方打印。
function assertArchiveContents(entries, options) {
  if (!Array.isArray(entries)) throw new TypeError('entries 必须是字符串数组');
  const opts = options || {};
  const prefix = typeof opts.prefix === 'string' ? opts.prefix : '';
  const offenders = [];
  let checked = 0;
  for (const raw of entries) {
    if (typeof raw !== 'string' || raw === '') continue;
    if (raw.endsWith('/')) continue;
    let rel = raw;
    if (prefix) {
      if (!raw.startsWith(prefix)) {
        offenders.push(raw + '（缺少统一前缀 ' + prefix + '）');
        continue;
      }
      rel = raw.slice(prefix.length);
    }
    if (!isReleaseAllowed(rel)) {
      offenders.push(raw);
      continue;
    }
    checked += 1;
  }
  if (offenders.length > 0) {
    throw new ReleaseArchiveContentError(
      'Release 归档越界：' + offenders.length + ' 个条目不在白名单内\n  - ' + offenders.join('\n  - '),
      offenders.slice()
    );
  }
  return { ok: true, checked };
}

module.exports = {
  RELEASE_DIRS,
  RELEASE_REQUIRED_DIRS,
  RELEASE_ROOT_FILES,
  RELEASE_ROOT_GLOB,
  RELEASE_EXCLUDE_PATTERNS,
  RELEASE_REQUIRED_FILES,
  ReleaseArchiveContentError,
  normalizeRelPath,
  isReleaseAllowed,
  listReleaseIncludePaths,
  assertArchiveContents
};

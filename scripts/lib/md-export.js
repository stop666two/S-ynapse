'use strict';
// 文章 Markdown 原文导出（features.exportArticle.markdown）构建期纯函数：
//   1. mdExportEnabled(features)：总开关与 markdown 子开关的归一化判定（默认开）；
//   2. mdExportRelPath(lang, slug)：/md/<lang>/<slug>.md 的相对产物路径，
//      lang 与 slug 双白名单校验（slug 复用 validateSlug 的字符集/穿越规则），
//      校验失败返回 null（调用方隐藏按钮，绝不写出越界路径）；
//   3. writeArticleMarkdown(opts)：把文章源文件按字节原样复制到产物目录，
//      保留原始 frontmatter（下载内容与仓库源一致，front-matter 解析与渲染
//      预处理不会污染导出文件）。写入走原子替换，失败由调用方记录非阻断告警。
const fs = require('fs');
const path = require('path');
const { validateSlug } = require('./utils');
const { writeFileAtomicSync } = require('./atomic-write');

// 语言段白名单：字母/数字/连字符（覆盖 BCP 47 主语言子标签），长度上限防异常路径。
const LANG_RX = /^[A-Za-z0-9-]+$/;
const LANG_MAX_LENGTH = 20;

function mdExportEnabled(features) {
  const e = (features && features.exportArticle) || {};
  return e.enabled !== false && e.markdown !== false;
}

function mdExportRelPath(lang, slug) {
  const l = String(lang == null ? '' : lang);
  if (!l || l === '.' || l === '..' || l.length > LANG_MAX_LENGTH || !LANG_RX.test(l)) return null;
  const check = validateSlug(slug);
  if (!check.ok) return null;
  return 'md/' + l + '/' + check.slug + '.md';
}

// 返回相对产物路径（POSIX 分隔符）或 null；sourceFile 缺失/不可读时原样抛出，
// 由调用方决定记录告警还是阻断构建。
function writeArticleMarkdown(opts) {
  const o = opts || {};
  const rel = mdExportRelPath(o.lang, o.slug);
  if (!rel || !o.sourceFile || !o.distDir) return null;
  const dest = path.join(o.distDir, rel.split('/').join(path.sep));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  writeFileAtomicSync(dest, fs.readFileSync(o.sourceFile));
  return rel;
}

module.exports = { mdExportEnabled, mdExportRelPath, writeArticleMarkdown };

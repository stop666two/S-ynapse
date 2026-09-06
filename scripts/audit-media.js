#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const MEDIA_ROOTS = ['media', 'assets', 'videos'];
const MEDIA_PREFIXES = ['media/', 'assets/', 'videos/'];
const AUDIT_OUT_FILE = 'media-audit.json';

let json5;
try {
  json5 = require('json5');
} catch (e) {
  json5 = { parse: JSON.parse };
}

function parseArgs(argv) {
  const args = { json: false, duplicates: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--duplicates') args.duplicates = true;
    else {
      console.error(`未知参数: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function toRel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function walkFiles(dir, nameRe) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkFiles(full, nameRe));
    } else if (ent.isFile() && nameRe.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectMediaFiles() {
  const out = [];
  for (const name of MEDIA_ROOTS) {
    const dir = path.join(ROOT, name);
    if (!fs.existsSync(dir)) continue;
    for (const file of walkFiles(dir, /.*/)) {
      out.push(toRel(file));
    }
  }
  return out;
}

function normalizeRef(raw) {
  let p = String(raw).trim();
  if (!p) return '';
  p = p.split(/\s+/)[0];
  const markIndex = p.search(/[?#]/);
  if (markIndex >= 0) p = p.slice(0, markIndex);
  p = p.replace(/\\/g, '/');
  p = p.replace(/^\/+/, '');
  while (/^\.\.?\//.test(p)) p = p.slice(3);
  return p;
}

function isMediaPath(p) {
  return MEDIA_PREFIXES.some((prefix) => p.startsWith(prefix));
}

function extractMediaRefs(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  const refs = new Set();
  const push = (value) => {
    const p = normalizeRef(value);
    if (p && isMediaPath(p)) refs.add(p);
  };
  let m;
  const mdLinkRe = /\]\(([^)]+)\)/g;
  while ((m = mdLinkRe.exec(raw)) !== null) push(m[1]);
  const srcRe = /src\s*=\s*["']([^"']*)["']/g;
  while ((m = srcRe.exec(raw)) !== null) push(m[1]);
  return [...refs];
}

function loadAuditConfig() {
  const file = path.join(ROOT, 'features.json5');
  if (!fs.existsSync(file)) return {};
  try {
    let raw = fs.readFileSync(file, 'utf-8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const features = json5.parse(raw) || {};
    return features.mediaAudit && typeof features.mediaAudit === 'object'
      ? features.mediaAudit
      : {};
  } catch (err) {
    console.warn(`[WARN] features.json5 解析失败, 使用默认审计配置: ${err.message}`);
    return {};
  }
}

function findDuplicates(relPaths) {
  const groups = new Map();
  for (const rel of relPaths) {
    if (!rel.startsWith('media/')) continue;
    const hash = crypto
      .createHash('md5')
      .update(fs.readFileSync(path.join(ROOT, rel)))
      .digest('hex');
    if (!groups.has(hash)) groups.set(hash, []);
    groups.get(hash).push(rel);
  }
  return [...groups.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([md5, files]) => ({ md5, files }));
}

function main() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(`[ERROR] articles 目录不存在: ${ARTICLES_DIR}`);
    process.exit(1);
  }
  const args = parseArgs(process.argv);
  const cfg = loadAuditConfig();
  const reportMissed = cfg.reportMissed === undefined ? true : !!cfg.reportMissed;
  const reportUnreferenced = cfg.reportUnreferenced === undefined ? true : !!cfg.reportUnreferenced;
  const reportDuplicate = cfg.reportDuplicate === undefined ? false : !!cfg.reportDuplicate;
  const jsonOutput = args.json || cfg.output === 'json';
  const checkDuplicates = args.duplicates || reportDuplicate;

  const articleFiles = walkFiles(ARTICLES_DIR, /\.(md|markdown)$/i);
  const referencedBy = new Map();
  for (const file of articleFiles) {
    const rel = toRel(file);
    for (const ref of extractMediaRefs(file)) {
      if (!referencedBy.has(ref)) referencedBy.set(ref, []);
      referencedBy.get(ref).push(rel);
    }
  }

  const mediaFiles = collectMediaFiles();
  const mediaSet = new Set(mediaFiles);

  const missing = [];
  const orphan = [];
  for (const [ref, articles] of referencedBy) {
    if (!mediaSet.has(ref) && !fs.existsSync(path.join(ROOT, ref))) {
      missing.push({ path: ref, referencedBy: articles });
    }
  }
  for (const rel of mediaFiles) {
    if (!referencedBy.has(rel)) orphan.push({ path: rel });
  }

  let duplicates = [];
  if (checkDuplicates) {
    duplicates = findDuplicates(mediaFiles);
  }

  const report = {
    createdAt: new Date().toISOString(),
    articleCount: articleFiles.length,
    mediaCount: mediaFiles.length,
    referencedCount: referencedBy.size,
    missing,
    orphan,
    duplicates
  };

  if (jsonOutput) {
    fs.writeFileSync(path.join(ROOT, AUDIT_OUT_FILE), `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    console.log(`审计结果已写入: ${AUDIT_OUT_FILE}`);
    console.log(`汇总: ${report.articleCount} 篇文章, ${report.mediaCount} 个媒体文件, 缺失 ${missing.length} 个, 孤儿 ${orphan.length} 个, 重复 ${duplicates.length} 组`);
  } else {
    console.log(`审计汇总: ${report.articleCount} 篇文章, ${report.mediaCount} 个媒体文件, ${referencedBy.size} 条媒体引用`);
    if (reportMissed) {
      console.log(`缺失文件 (${missing.length})`);
      if (missing.length) {
        console.table(missing.map((m) => ({
          路径: m.path,
          引用文章: m.referencedBy.join('、'),
          状态: '缺失'
        })));
      }
    }
    if (reportUnreferenced) {
      console.log(`孤儿文件 (${orphan.length})`);
      if (orphan.length) {
        console.table(orphan.map((o) => ({
          路径: o.path,
          引用文章: '-',
          状态: '未引用'
        })));
      }
    }
    if (checkDuplicates) {
      console.log(`重复文件 (${duplicates.length} 组)`);
      if (duplicates.length) {
        console.table(duplicates.flatMap((d) => d.files.map((f) => ({
          文件: f,
          MD5: d.md5,
          状态: '重复'
        }))));
      }
    }
    console.log(`结论: 缺失 ${missing.length} 个, 孤儿 ${orphan.length} 个, 重复 ${duplicates.length} 组`);
  }

  if (missing.length > 0) process.exitCode = 1;
}

main();

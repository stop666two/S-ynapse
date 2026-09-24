#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const CONFIG_FILES = [
  'site.json5',
  'theme.json5',
  'navigation.json5',
  'sidebar.json5',
  'footer.json5',
  'security.json5',
  'features.json5',
  'ui-strings.json5',
  'content-policy.json5',
  'tag-aliases.json5',
  'friends.json5',
  'tuning.json5',
  'guard.json5'
];
const MEDIA_DIRS = ['media', 'assets', 'videos'];
const DEFAULT_OUTPUT_DIR = 'exports';
const DEFAULT_PREFIX = 's-ynapse-backup';

let json5;
try {
  json5 = require('json5');
} catch (e) {
  json5 = { parse: JSON.parse };
}

function parseArgs(argv) {
  const args = { dir: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = path.resolve(ROOT, argv[++i]);
    else {
      console.error(`未知参数: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function loadFeatures() {
  const file = path.join(ROOT, 'features.json5');
  if (!fs.existsSync(file)) return {};
  try {
    let raw = fs.readFileSync(file, 'utf-8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return json5.parse(raw) || {};
  } catch (err) {
    console.warn(`[WARN] features.json5 解析失败, 使用默认导出配置: ${err.message}`);
    return {};
  }
}

function timestampPart() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
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

function countFiles(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return count;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) count += countFiles(full);
    else if (ent.isFile()) count++;
  }
  return count;
}

function makeBackupDirectory(baseDir, fileNamePrefix) {
  fs.mkdirSync(baseDir, { recursive: true });
  const baseName = `${fileNamePrefix}-${timestampPart()}`;
  let candidate = path.join(baseDir, baseName);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(baseDir, `${baseName}-${suffix}`);
    suffix++;
  }
  return candidate;
}

function main() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(`[ERROR] articles 目录不存在: ${ARTICLES_DIR}`);
    process.exit(1);
  }
  const args = parseArgs(process.argv);
  const features = loadFeatures();
  const exportCfg = features.exportBackup && typeof features.exportBackup === 'object'
    ? features.exportBackup
    : {};
  const includeMedia = exportCfg.includeMedia === undefined ? true : !!exportCfg.includeMedia;
  const includeConfig = exportCfg.includeConfig === undefined ? true : !!exportCfg.includeConfig;
  const outputDir = args.dir || exportCfg.outputDir || DEFAULT_OUTPUT_DIR;
  const fileNamePrefix = exportCfg.fileNamePrefix || DEFAULT_PREFIX;

  const backupDir = makeBackupDirectory(outputDir, fileNamePrefix);
  const copiedConfigs = [];
  let copyFailed = false;

  console.log(`导出备份到: ${outputDir}`);
  console.log(`备份目录: ${toRel(backupDir)}`);

  const articleCount = walkFiles(ARTICLES_DIR, /\.(md|markdown)$/i).length;
  let mediaCount = 0;

  const copyMediaDir = (name) => {
    const src = path.join(ROOT, name);
    if (!fs.existsSync(src)) return;
    const fileCount = countFiles(src);
    mediaCount += fileCount;
    console.log(`  复制 ${toRel(src)} (${fileCount} 个文件)`);
    try {
      fs.cpSync(src, path.join(backupDir, name), { recursive: true });
    } catch (err) {
      console.error(`[ERROR] 复制失败: ${toRel(src)} → ${err.message}`);
      copyFailed = true;
    }
  };

  console.log(`  复制 articles (${articleCount} 篇文章)`);
  try {
    fs.cpSync(ARTICLES_DIR, path.join(backupDir, 'articles'), { recursive: true });
  } catch (err) {
    console.error(`[ERROR] 复制失败: articles → ${err.message}`);
    copyFailed = true;
  }

  if (includeMedia) {
    for (const name of MEDIA_DIRS) copyMediaDir(name);
  }

  if (includeConfig) {
    for (const name of CONFIG_FILES) {
      const src = path.join(ROOT, name);
      if (!fs.existsSync(src)) continue;
      try {
        fs.copyFileSync(src, path.join(backupDir, name));
        copiedConfigs.push(name);
        console.log(`  复制 ${name}`);
      } catch (err) {
        console.error(`[ERROR] 复制失败: ${name} → ${err.message}`);
        copyFailed = true;
      }
    }
  }

  const packagePath = path.join(ROOT, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      fs.copyFileSync(packagePath, path.join(backupDir, 'package.json'));
      console.log('  复制 package.json');
    } catch (err) {
      console.error(`[ERROR] 复制失败: package.json → ${err.message}`);
      copyFailed = true;
    }
  }

  let version = '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    if (pkg && typeof pkg.version === 'string') version = pkg.version;
  } catch (err) {
    console.warn(`[WARN] package.json 读取失败, manifest.version 使用 0.0.0: ${err.message}`);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    version,
    articleCount,
    mediaCount,
    configFiles: copiedConfigs
  };
  try {
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  } catch (err) {
    console.error(`[ERROR] manifest.json 写入失败: ${err.message}`);
    copyFailed = true;
  }

  const summary = `备份完成: ${toRel(backupDir)} (${articleCount} 篇文章, ${mediaCount} 个媒体文件, ${copiedConfigs.length} 个配置文件)`;
  if (copyFailed) {
    console.log(`${summary}, 存在复制错误, 请检查上方 [ERROR] 输出`);
    process.exitCode = 1;
  } else {
    console.log(summary);
  }
}

main();

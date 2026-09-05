#!/usr/bin/env node
'use strict';
// Import CLI — migrate posts from Hexo / Hugo / WordPress into articles/.
//
// Usage:
//   node scripts/import.js --from hexo      --source <hexo-root-or-_posts-dir>
//   node scripts/import.js --from hugo      --source <content-dir>
//   node scripts/import.js --from wordpress --source <export.xml>
//
// Options:
//   --out dir        target directory (default articles/)
//   --prefix text    filename prefix for imported files (default imported-)
//   --dry-run        show what would be imported without writing files
//
// Output articles use the S-ynapse frontmatter shape:
//   title / date / tags / categories / slug / draft
// Imported content is NOT modified (HTML bodies pass through the existing
// sanitizeHtml pipeline at build time).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const DEFAULT_PREFIX = 'imported-';

function parseArgs(argv) {
  const args = { from: '', source: '', out: ARTICLES_DIR, prefix: DEFAULT_PREFIX, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from') args.from = argv[++i];
    else if (a === '--source') args.source = argv[++i];
    else if (a === '--out') args.out = path.resolve(ROOT, argv[++i]);
    else if (a === '--prefix') args.prefix = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else { console.error(`Unknown option: ${a}`); process.exit(1); }
  }
  return args;
}

function frontmatterEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function yamlValue(v) {
  return `"${frontmatterEscape(v)}"`;
}

function buildFrontmatter(post, index) {
  const lines = ['---'];
  lines.push(`title: ${yamlValue(post.title)}`);
  if (post.date) lines.push(`date: ${post.date}`);
  if (post.tags && post.tags.length) lines.push(`tags: [${post.tags.map(yamlValue).join(', ')}]`);
  if (post.categories && post.categories.length) lines.push(`categories: [${post.categories.map(yamlValue).join(', ')}]`);
  if (post.slug) lines.push(`slug: ${yamlValue(post.slug)}`);
  if (post.draft) lines.push('draft: true');
  if (post.featuredImage) lines.push(`featuredImage: ${yamlValue(post.featuredImage)}`);
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function readDirMd(dir, depthLeft) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory() && depthLeft > 0) out.push(...readDirMd(full, depthLeft - 1));
    else if (ent.isFile() && /\.(md|markdown)$/i.test(ent.name)) out.push(full);
  }
  return out;
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { attrs: {}, body: raw };
  const attrs = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*)[ \t]*:[ \t]*(.*)$/);
    if (kv) {
      let val = kv[2].trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      attrs[kv[1]] = val;
    }
  }
  return { attrs, body: raw.slice(m[0].length) };
}

function toPost(attrs, body, file) {
  const base = path.basename(file).replace(/\.(md|markdown)$/i, '');
  const title = attrs.title || (body.match(/^#\s+(.+)$/m) || [])[1] || base;
  return {
    title,
    date: attrs.date || null,
    tags: Array.isArray(attrs.tags) ? attrs.tags : (attrs.tags ? [attrs.tags] : []),
    categories: Array.isArray(attrs.categories) ? attrs.categories : (attrs.categories ? [attrs.categories] : []),
    slug: typeof attrs.slug === 'string' ? attrs.slug : (typeof attrs.slugline === 'string' ? attrs.slugline : null),
    draft: attrs.draft === true || attrs.draft === 'true',
    featuredImage: attrs.featuredImage || attrs.cover || attrs.thumbnail ||null,
    body
  };
}

function importHexo(source) {
  const dirStats = fs.statSync(source).isDirectory();
  const postsDir = dirStats && /_posts$/i.test(source) ? source : path.join(source, '_posts');
  const files = readDirMd(fs.statSync(postsDir, { throwIfNoEntry: false }) ? postsDir : source, 1);
  const posts = [];
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf-8');
    const { attrs, body } = parseFrontmatter(raw);
    posts.push({ ...toPost(attrs, body, f), source: path.relative(source, f) });
  }
  return posts;
}

function importHugo(source) {
  if (!fs.existsSync(source)) throw new Error(`Source directory not found: ${source}`);
  const files = readDirMd(source, 6);
  const posts = [];
  for (const f of files) {
    if (/^_?index\.(md|markdown)$/i.test(path.basename(f))) continue;
    const raw = fs.readFileSync(f, 'utf-8');
    const { attrs, body } = parseFrontmatter(raw);
    posts.push({ ...toPost(attrs, body, f), source: path.relative(source, f) });
  }
  return posts;
}

function importWordPress(source) {
  if (!fs.existsSync(source)) throw new Error(`XML file not found: ${source}`);
  const xml = fs.readFileSync(source, 'utf-8');
  const posts = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return mm ? decodeXml(mm[1]) : null;
    };
    const getAttr = (tag) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return mm ? mm[1].trim() : null;
    };
    if (get('wp:post_type') !== 'post') continue;
    if (get('wp:post_status') !== 'publish') continue;
    const categories = [];
    const tags = [];
    const catRe = /<category domain="([^"]+)"[^>]*>([\s\S]*?)<\/category>/g;
    let cm;
    while ((cm = catRe.exec(block)) !== null) {
      const text = decodeXml(cm[2]);
      if (cm[1] === 'category') categories.push(text);
      else if (cm[1] === 'post_tag') tags.push(text);
    }
    const date = get('wp:post_date') || null;
    const formatted = date ? date.replace(' ', 'T') : null;
    posts.push({
      title: get('title') || 'untitled',
      date: formatted,
      tags,
      categories,
      slug: get('wp:post_name') || getAttr('guid') ? (get('wp:post_name') || null) : null,
      draft: false,
      featuredImage: null,
      body: get('wp:post_content') || '',
      source: null
    });
  }
  return posts;
}

function decodeXml(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#8217;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, (mm) => String.fromCharCode(parseInt(mm.slice(2, -1), 10)));
}

function writePost(post, index, args) {
  const safeName = post.slug || post.title || `post-${index}`;
  const slug = safeName.replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '') || `post-${index}`;
  const filename = `${args.prefix}${String(index + 1).padStart(2, '0')}-${slug}.md`;
  const content = buildFrontmatter(post, index) + post.body.replace(/^\s*\n/, '') + (post.body.trim() ? '\n' : '');
  const outPath = path.join(args.out, filename);
  fs.writeFileSync(outPath, content, 'utf-8');
  return outPath;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.from) { console.error('Usage: node scripts/import.js --from hexo|hugo|wordpress --source <path> [--out dir] [--prefix text] [--dry-run]'); process.exit(1); }
  if (!args.source) { console.error('[ERROR] --source is required'); process.exit(1); }
  let posts = [];
  try {
    if (args.from === 'hexo') posts = importHexo(args.source);
    else if (args.from === 'hugo') posts = importHugo(args.source);
    else if (args.from === 'wordpress') posts = importWordPress(args.source);
    else { console.error(`[ERROR] Unknown importer: ${args.from}`); process.exit(1); }
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }
  if (!posts.length) {
    console.log(`No ${args.from} posts found in ${args.source}`);
    return;
  }
  console.log(`[import] Found ${posts.length} ${args.from} posts`);
  if (args.dryRun) {
    posts.forEach((p, i) => console.log(`  would import: ${p.title || p.slug}${p.draft ? ' (draft)' : ''}`));
    return;
  }
  fs.mkdirSync(args.out, { recursive: true });
  let written = 0;
  posts.forEach((p, i) => {
    const outPath = writePost(p, i, args);
    console.log(`  imported: ${path.relative(ROOT, outPath)}`);
    written++;
  });
  console.log(`[import] Done — ${written} file(s) written to ${path.relative(ROOT, args.out)}`);
}

main();

'use strict';
// 构建产物压缩与缓存指纹（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createMinifyModule(ctx) 注入路径、开关与共享依赖，避免模块间隐式全局。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeFileAtomicSync } = require('../lib/atomic-write');

function createMinifyModule(ctx) {
  const { minifyHtmlNode, CleanCSS, terser } = ctx;

  // Minify all HTML files in a directory tree using @minify-html/node.
  // Only runs when site.build.minifyHTML is enabled and the package is installed.
  // minify_js / minify_css also compress inline <script>/<style> content
  // (comments and whitespace inside inline code are removed here).
  async function minifyHTMLInDir(dir, config) {
    if (!config.site.build.minifyHTML || !minifyHtmlNode) return;
    const files = ctx.getAllFiles(dir).filter(f => /\.html?$/i.test(f));
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const minified = minifyHtmlNode.minify(Buffer.from(content, 'utf-8'), {
          keep_comments: false,
          minify_js: true,
          minify_css: true,
          minify_doctype: false,
          keep_html_and_head_opening_tags: true,
          keep_closing_tags: true,
          preserve_brace_template_syntax: true
        }).toString('utf-8');
        if (minified.length < content.length) {
          writeFileAtomicSync(file, minified, 'utf-8');
        }
      } catch (err) {
        console.error(`  [ERROR] Failed to minify HTML ${file}: ${err.message}`);
        ctx.recordBuildFailure('minify', `HTML ${file}: ${err.message}`);
      }
    }
  }

  // Minify all CSS files in a directory tree using CleanCSS (level 2 optimization).
  async function minifyCSSInDir(dir, config) {
    if (!config.site.build.minifyCSS || !CleanCSS) return;
    if (!fs.existsSync(dir)) return;
    const files = ctx.getAllFiles(dir).filter(f => /\.css$/i.test(f));
    const minifier = new CleanCSS({ level: 2 });
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const result = minifier.minify(content);
        if (!result.errors.length && result.styles.length < content.length) {
          writeFileAtomicSync(file, result.styles, 'utf-8');
        }
        for (const err of result.errors) { console.error(`  [ERROR] CSS minify error: ${err}`); ctx.recordBuildFailure('minify', 'CSS: ' + err); }
      } catch (err) {
        console.error(`  [ERROR] Failed to minify CSS ${file}: ${err.message}`);
        ctx.recordBuildFailure('minify', `CSS ${file}: ${err.message}`);
      }
    }
  }

  // Minify all JS files in a directory tree using Terser.
  // Optionally removes console.* statements when site.build.removeConsole is true.
  async function minifyJSInDir(dir, config) {
    if (!config.site.build.minifyJS || !terser) return;
    if (!fs.existsSync(dir)) return;
    const files = ctx.getAllFiles(dir).filter(f => /\.js$/i.test(f));
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const result = await terser.minify(content, {
          module: true,
          compress: { drop_console: config.site.build.removeConsole || false },
          mangle: { toplevel: true },
          output: { comments: false }
        });
        if (result.code && result.code.length < content.length) {
          writeFileAtomicSync(file, result.code, 'utf-8');
        }
        if (result.error) { console.error(`  [ERROR] JS minify error: ${result.error}`); ctx.recordBuildFailure('minify', 'JS: ' + result.error); }
      } catch (err) {
        console.error(`  [ERROR] Failed to minify JS ${file}: ${err.message}`);
        ctx.recordBuildFailure('minify', `JS ${file}: ${err.message}`);
      }
    }
  }

  // Minify inline <style> blocks inside HTML files using CleanCSS (level 1).
  // @minify-html skips very large style blocks; this pass guarantees inline CSS
  // comments/whitespace removal while preserving modern syntax (@property/:has/color-mix).
  async function minifyInlineStylesInDir(dir, config) {
    if (!config.site.build.minifyCSS || !CleanCSS) return;
    const minifier = new CleanCSS({ level: 1 });
    const files = ctx.getAllFiles(dir).filter(f => /\.html?$/i.test(f));
    for (const file of files) {
      try {
        let html = fs.readFileSync(file, 'utf-8');
        let changed = false;
        html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, function (all, attrs, css) {
          if (css.length < 200) return all;
          const r = minifier.minify(css);
          if (r.errors.length) return all;
          if (r.styles.length && r.styles.length < css.length) {
            changed = true;
            return '<style' + attrs + '>' + r.styles + '</style>';
          }
          return all;
        });
        if (changed) writeFileAtomicSync(file, html, 'utf-8');
      } catch (err) {
        console.error(`  [ERROR] Inline CSS minify ${file}: ${err.message}`);
        ctx.recordBuildFailure('minify', `inline CSS ${file}: ${err.message}`);
      }
    }
  }

  // Run all three minifiers (HTML, CSS, JS) across the dist/ directory.
  // Each skips gracefully if its package is missing or the feature is disabled.
  async function minifyAll(config) {
    console.log('[11/14] Minifying assets...');
    await minifyHTMLInDir(ctx.distDir, config);
    await minifyInlineStylesInDir(ctx.distDir, config);
    await minifyCSSInDir(ctx.distDir, config);
    if (!ctx.bundleActive) await minifyJSInDir(path.join(ctx.distDir, 'assets', 'js'), config);
    const types = [];
    if (config.site.build.minifyHTML) types.push('HTML');
    if (config.site.build.minifyCSS) types.push('CSS');
    if (config.site.build.minifyJS) types.push('JS');
    if (types.length)     console.log(`  Minified: ${types.join(', ')}`);
    else console.log('  [SKIP] Minification disabled');
  }

  // Cache-busting via MD5 content hashing.
  // For each matched file (css|js|png|jpg|svg), renames to {name}.{hash}.{ext}
  // and updates all HTML references pointing to the old path.
  // The cache-bust-manifest.json file records the old→new mapping.
  async function cacheBust(config) {
    if (!config.site.build.enableCacheBusting) {
      console.log('  [SKIP] Cache busting disabled');
      return;
    }
    console.log('[12/14] Cache busting...');
    const bustPattern = config.site.build.cacheBustingPattern || '.*\\.(css|js|png|jpg|svg)$';
    const bustRegex = new RegExp(bustPattern, 'i');
    // 跳过：node_modules、og 目录、assets 目录、sw.js（固定路径）；以及 PWA manifest 引用的固定文件名图标
    // （manifest.json 不参与路径重写，若对 icon-192/512.png 做哈希重命名会导致 manifest 引用 404）
    const files = ctx.getAllFiles(ctx.distDir).filter(f => bustRegex.test(f) && !f.includes('node_modules') && !f.includes(path.sep + 'og' + path.sep) && !f.includes(path.sep + 'assets' + path.sep) && path.basename(f) !== 'sw.js' && !/^icon-(192|512)\.png$/.test(path.basename(f)));
    const mapping = {};
    for (const file of files) {
      try {
        const content = fs.readFileSync(file);
        const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 10);
        const parsed = path.parse(file);
        const basename = parsed.name;
        const hashedName = `${basename}.${hash}${parsed.ext}`;
        const hashedPath = path.join(parsed.dir, hashedName);
        if (file !== hashedPath && !fs.existsSync(hashedPath)) {
          fs.renameSync(file, hashedPath);
        }
        const relOrig = path.relative(ctx.distDir, file).replace(/\\/g, '/');
        const relNew = path.relative(ctx.distDir, hashedPath).replace(/\\/g, '/');
        if (relOrig !== relNew) {
          mapping['/' + relOrig] = '/' + relNew;
        }
      } catch (err) {
        console.error(`  [ERROR] Cache bust ${file}: ${err.message}`);
        ctx.recordBuildFailure('cachebust', `Cache bust ${file}: ${err.message}`);
      }
    }
    if (Object.keys(mapping).length > 0) {
      const htmlFiles = ctx.getAllFiles(ctx.distDir).filter(f => /\.html?$/i.test(f));
      for (const htmlFile of htmlFiles) {
        try {
          let content = fs.readFileSync(htmlFile, 'utf-8');
          let changed = false;
          for (const [orig, hashed] of Object.entries(mapping)) {
            const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(escaped, 'g');
            if (re.test(content)) {
              content = content.replace(re, hashed);
              changed = true;
            }
          }
          if (changed) writeFileAtomicSync(htmlFile, content, 'utf-8');
        } catch (err) {
          console.error(`  [ERROR] Update refs in ${htmlFile}: ${err.message}`);
          ctx.recordBuildFailure('cachebust', `Update refs in ${htmlFile}: ${err.message}`);
        }
      }
      writeFileAtomicSync(ctx.cacheBustManifestPath, JSON.stringify(mapping), 'utf-8');
      console.log(`  Renamed ${Object.keys(mapping).length} files, updated HTML refs`);
      // Search indexes reference media paths (featuredImage) generated before hashing;
      // rewrite them with the same mapping so lazy-loaded search results never 404.
      const jsonIndexes = ctx.getAllFiles(ctx.distDir).filter(f => /search-index\.json$/i.test(f));
      for (const jf of jsonIndexes) {
        try {
          let jsonText = fs.readFileSync(jf, 'utf-8');
          let jsonChanged = false;
          for (const [orig, hashed] of Object.entries(mapping)) {
            if (jsonText.includes(orig)) {
              jsonText = jsonText.split(orig).join(hashed);
              jsonChanged = true;
            }
          }
          if (jsonChanged) writeFileAtomicSync(jf, jsonText, 'utf-8');
        } catch (err) {
          console.error(`  [ERROR] Cache bust ${jf}: ${err.message}`);
          ctx.recordBuildFailure('cachebust', `Cache bust ${jf}: ${err.message}`);
        }
      }
    } else {
      console.log('  No files to bust');
    }
  }

  return { minifyHTMLInDir, minifyInlineStylesInDir, minifyCSSInDir, minifyJSInDir, minifyAll, cacheBust };
}

module.exports = { createMinifyModule };

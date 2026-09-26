'use strict';
// 构建产物压缩与缓存指纹（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createMinifyModule(ctx) 注入路径、开关与共享依赖，避免模块间隐式全局。
// 压缩阶段分两层：基线压缩（minify-html / CleanCSS / Terser 的既有行为，恒定执行）与增强步骤
// （compression.json5 控制：HTML 激进选项、JSON 去空白；CSS/JS 接口预留给后续实现），
// 增强步骤全部位于 cacheBust 之前，保证文件名哈希对应最终字节。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { isExcluded } = require('../lib/compression-config');
const {
  buildHtmlMinifyOptions,
  compactJsonText,
  compressionEnhancementPlan,
  jsonSkipReason
} = require('../lib/compression-steps');

function createMinifyModule(ctx) {
  const { minifyHtmlNode, CleanCSS, terser } = ctx;

  // 压缩配置与增强计划（context.js 注入）：config 为合并后的 compression.json5，
  // active 为 compressionActive() 的结果（serve/watch 强制 false），errors/warnings 来自加载与覆盖校验。
  const compressionState = ctx.compression || { config: {}, active: false, errors: [], warnings: [], override: '' };
  const compressionConfig = compressionState.config || {};
  const compressionPlan = compressionEnhancementPlan(compressionConfig, compressionState.active);

  function distRel(file) {
    return path.relative(ctx.distDir, file).split(path.sep).join('/');
  }

  // Minify all HTML files in a directory tree using @minify-html/node.
  // Only runs when site.build.minifyHTML is enabled and the package is installed.
  // minify_js / minify_css also compress inline <script>/<style> content
  // (comments and whitespace inside inline code are removed here).
  // 增强：html.aggressive 时对未豁免文件叠加激进选项（可选闭合标签/属性引号折叠等）。
  async function minifyHTMLInDir(dir, config) {
    if (!config.site.build.minifyHTML || !minifyHtmlNode) return;
    const files = ctx.getAllFiles(dir).filter(f => /\.html?$/i.test(f));
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const aggressive = compressionPlan.htmlAggressive && !isExcluded(distRel(file), compressionPlan.exclude);
        const minified = minifyHtmlNode.minify(Buffer.from(content, 'utf-8'), buildHtmlMinifyOptions({
          aggressive,
          removeComments: compressionPlan.active ? compressionPlan.htmlRemoveComments : true
        })).toString('utf-8');
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

  // JSON 去空白（增强步骤）：扫描 dist 全部 *.json，仅重写「含换行/缩进」的文件；
  // 豁免名单（vendor/media/报告等）与内容寻址的 assets/config.<hash>.json 先行跳过。
  // 单文件失败只告警并保留原文件（recordBuildFailure 记录，压缩阶段不中断）。
  async function compactJsonInDir(dir) {
    const files = ctx.getAllFiles(dir).filter(f => /\.json$/i.test(f));
    let compacted = 0;
    for (const file of files) {
      const rel = distRel(file);
      if (jsonSkipReason(rel, compressionPlan.exclude)) continue;
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const result = compactJsonText(content);
        if (result.changed) {
          writeFileAtomicSync(file, result.text, 'utf-8');
          compacted += 1;
        }
      } catch (err) {
        console.warn(`  [WARN] JSON 压缩失败，保留原文件 ${rel}: ${err.message}`);
        ctx.recordBuildFailure('compression', `JSON ${rel}: ${err.message}`);
      }
    }
    return compacted;
  }

  // 压缩配置加载/覆盖校验问题集中上报：warnings 打日志，errors 记录构建失败（不中止构建流程）。
  function reportCompressionIssues() {
    for (const message of compressionState.warnings) console.warn('  [WARN] ' + message);
    for (const message of compressionState.errors) {
      console.error('  [ERROR] compression: ' + message);
      ctx.recordBuildFailure('compression', message);
    }
  }

  // 执行增强步骤。compressionActive=false（serve/watch 或 enabled=false）时全部跳过，仅保留基线压缩。
  async function runCompressionEnhancements() {
    if (!compressionPlan.active) {
      console.log('  [compression] 增强步骤已跳过（serve/watch 或 compression.enabled=false）；基线压缩照常');
      return;
    }
    if (compressionState.override) console.log('  [compression] override: ' + compressionState.override);
    if (compressionConfig.html && compressionConfig.html.enabled !== false && compressionConfig.html.collapseWhitespace === false) {
      console.warn('  [WARN] compression.html.collapseWhitespace=false 不受支持：minify-html 始终折叠安全空白，本次构建保持折叠');
    }
    const steps = [];
    if (compressionPlan.htmlAggressive) steps.push('HTML 激进选项');
    if (compressionPlan.jsonCompact) {
      const count = await compactJsonInDir(ctx.distDir);
      if (count > 0) steps.push('JSON 去空白 ×' + count);
    }
    if (compressionPlan.jsObfuscate) {
      console.warn('  [WARN] compression.js.obfuscate.enabled=true 暂未接入，本次构建未执行混淆');
    }
    console.log('  [compression] ' + (steps.length ? '已执行增强: ' + steps.join('、') : '无增强步骤执行（基线压缩已完成）'));
  }

  // Run all three minifiers (HTML, CSS, JS) across the dist/ directory.
  // Each skips gracefully if its package is missing or the feature is disabled.
  async function minifyAll(config) {
    console.log('[11/14] Minifying assets...');
    reportCompressionIssues();
    await minifyHTMLInDir(ctx.distDir, config);
    await minifyInlineStylesInDir(ctx.distDir, config);
    await minifyCSSInDir(ctx.distDir, config);
    if (!ctx.bundleActive) await minifyJSInDir(path.join(ctx.distDir, 'assets', 'js'), config);
    await runCompressionEnhancements();
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
        // 幂等：文件名已带本轮内容哈希（增量构建不清理 dist，上一轮的内容寻址产物会
        // 再次进入扫描）时跳过，避免重复追加哈希并连锁改写全部 HTML 引用。
        if (parsed.name.endsWith('.' + hash)) continue;
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

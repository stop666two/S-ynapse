'use strict';
// 构建产物压缩与缓存指纹（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createMinifyModule(ctx) 注入路径、开关与共享依赖，避免模块间隐式全局。
// 压缩阶段分两层：基线压缩（minify-html / CleanCSS / Terser 的既有行为，恒定执行）与增强步骤
// （compression.json5 控制：HTML 激进选项、CSS 同页合并去重、JS 可选混淆、JSON 去空白），
// 增强步骤全部位于 cacheBust 之前；C4 混淆后按最终字节重命名 bundle 并同步改写 HTML 引用，
// 保证「文件名哈希 = 最终字节」。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { isExcluded } = require('../lib/compression-config');
const { gzipSize } = require('../lib/perf-budget');
const { mergeStyleBlocks, dedupeStyleBlocks, dedupeCss } = require('../lib/css-merge');
const {
  buildHtmlMinifyOptions,
  buildObfuscateOptions,
  compactJsonText,
  compressionEnhancementPlan,
  enhancementWorkActive,
  jsonSkipReason,
  selectObfuscationTargets,
  RUNTIME_TARGET_RE
} = require('../lib/compression-steps');
const {
  createBaselineSnapshot,
  restoreBaselineSnapshot,
  compareSnapshotBytes,
  verifyCompression,
  verifyModeFromEnv,
  summarizeFailures,
  writeVerifyReport
} = require('../lib/compression-verify');
const { resolveChromePath } = require('../lib/mermaid-render');

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '?';
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function createMinifyModule(ctx) {
  const { minifyHtmlNode, CleanCSS, terser } = ctx;

  // 压缩配置与增强计划（context.js 惰性注入）：config 为合并后的 compression.json5，
  // active 为 compressionActive() 的结果（serve/watch 强制 false）。
  // 首次消费发生在 minifyAll（build() 的 try 内），--compression-override 的缺失/解析错误
  // 因此可被 watch 的 rebuild 循环捕获；状态一次加载后缓存，同一构建进程内复用。
  const FALLBACK_COMPRESSION_STATE = { config: {}, active: false, errors: [], warnings: [], override: '' };
  let compressionState = FALLBACK_COMPRESSION_STATE;
  let compressionPlan = compressionEnhancementPlan({}, false);

  function refreshCompressionState() {
    if (typeof ctx.getCompression === 'function') {
      compressionState = ctx.getCompression() || FALLBACK_COMPRESSION_STATE;
    } else if (ctx.compression) {
      compressionState = ctx.compression;
    }
    compressionPlan = compressionEnhancementPlan(compressionState.config || {}, compressionState.active === true);
  }

  // 本轮 esbuild 产物白名单（build.js 经活值 getter 注入）：混淆只作用于本轮 app/deferred，
  // 增量构建残留的旧 bundle 与 vendor 不在名单内。
  const getBundleFiles = typeof ctx.getBundleFiles === 'function' ? ctx.getBundleFiles : () => [];

  // 无头对比验证的开关与落盘路径：基线快照与结果 JSON 固定在项目 .cache/（不入部署产物）；
  // 结果路径可经 SYNAPSE_COMPRESSION_VERIFY_REPORT 覆盖（verify:compression CLI 读取专用路径）。
  const compressionBaselineDir = ctx.compressionBaselineDir || path.join(ctx.distDir, '..', '.cache', 'compression-baseline');
  function verifyReportPath() {
    return process.env.SYNAPSE_COMPRESSION_VERIFY_REPORT
      || ctx.compressionVerifyReportPath
      || path.join(ctx.distDir, '..', '.cache', 'compression-verify', 'last.json');
  }

  function shouldRunVerification() {
    if (verifyModeFromEnv(process.env) === 'off') return false;
    if (compressionPlan.active !== true || compressionPlan.verifyHeadless !== true) return false;
    return enhancementWorkActive(compressionPlan);
  }

  function distRel(file) {
    return path.relative(ctx.distDir, file).split(path.sep).join('/');
  }

  // 压缩阶段统计的分类：与压缩/增强步骤实际触达的产物类型一一对应。
  // JS 含 vendor（基线压缩在 --no-bundle 下会处理全部 JS），豁免计数单独给出。
  const STAT_CATEGORIES = Object.freeze({
    html: /\.html?$/i,
    css: /\.css$/i,
    js: /\.js$/i,
    json: /\.json$/i
  });

  // 统计快照：记录各分类当前文件的 raw/gzip 字节与内容哈希（md5）。
  // raw/gzip 汇总用于 report.txt 的前后对照；哈希用于判定同路径文件是否被改写。
  function snapshotCompressionStats() {
    const snapshot = {};
    for (const key of Object.keys(STAT_CATEGORIES)) {
      const pattern = STAT_CATEGORIES[key];
      const entries = new Map();
      let raw = 0;
      let gzip = 0;
      for (const file of ctx.getAllFiles(ctx.distDir).filter((f) => pattern.test(f))) {
        try {
          const buffer = fs.readFileSync(file);
          const gzipped = gzipSize(buffer);
          raw += buffer.length;
          gzip += gzipped;
          entries.set(distRel(file), {
            raw: buffer.length,
            gzip: gzipped,
            hash: crypto.createHash('md5').update(buffer).digest('hex')
          });
        } catch (err) {
          console.warn(`  [WARN] 压缩统计快照跳过 ${distRel(file)}: ${err.message}`);
        }
      }
      snapshot[key] = { entries, raw, gzip };
    }
    return snapshot;
  }

  // 前后快照差分：变更 = 同路径内容哈希变化；新增/移除 = 混淆改名等导致的文件集变化；
  // 跳过 = 存在且未变化；豁免 = 命中 compression.exclude（仅约束增强步骤）。
  function buildCompressionStats(before, after) {
    const categories = {};
    for (const key of Object.keys(STAT_CATEGORIES)) {
      const previous = before[key] || { entries: new Map(), raw: 0, gzip: 0 };
      const current = after[key] || { entries: new Map(), raw: 0, gzip: 0 };
      let changed = 0;
      let added = 0;
      let exempt = 0;
      for (const [rel, entry] of current.entries) {
        const old = previous.entries.get(rel);
        if (!old) added += 1;
        else if (old.hash !== entry.hash) changed += 1;
        if (isExcluded(rel, compressionPlan.exclude)) exempt += 1;
      }
      let removed = 0;
      for (const rel of previous.entries.keys()) {
        if (!current.entries.has(rel)) removed += 1;
      }
      categories[key] = {
        filesBefore: previous.entries.size,
        filesAfter: current.entries.size,
        rawBefore: previous.raw,
        rawAfter: current.raw,
        gzipBefore: previous.gzip,
        gzipAfter: current.gzip,
        changed,
        added,
        removed,
        skipped: current.entries.size - changed - added,
        exempt
      };
    }
    return {
      active: compressionPlan.active === true,
      verificationRan: shouldRunVerification(),
      categories
    };
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
  // 单文件失败只告警并保留原文件，同时记入失败账本（构建最终以非零退出）；压缩阶段不中断。
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

  // C3：页面内联 <style> 合并 + 保守去重，以及 dist 外链 CSS 文件的保守去重。
  // 逐文件 try/catch：解析异常（标签/括号/引号/注释不配平）只告警并保留原文件，
  // 计入 skipped 统计（明细进 report.txt），不计入失败账本（不阻断构建）。
  // 注意：外链 CSS 与基线 CleanCSS 行为一致，只改内容不改名（assets/ 不参与 cacheBust）。
  async function runCssEnhancements() {
    const totals = { pages: 0, blocksMerged: 0, rulesCollapsed: 0, declsDropped: 0, cssFiles: 0, bytesSaved: 0, skipped: 0, skippedDetails: [] };
    const htmlFiles = ctx.getAllFiles(ctx.distDir).filter(f => /\.html?$/i.test(f));
    for (const file of htmlFiles) {
      const rel = distRel(file);
      if (isExcluded(rel, compressionPlan.exclude)) continue;
      try {
        const before = fs.readFileSync(file, 'utf-8');
        let html = before;
        let merged = null;
        let deduped = null;
        if (compressionPlan.cssMergeInlineStyles) {
          merged = mergeStyleBlocks(html, { nonce: ctx.cspNonce });
          html = merged.html;
        }
        if (compressionPlan.cssDedupe) {
          deduped = dedupeStyleBlocks(html);
          html = deduped.html;
        }
        if (html === before) continue;
        writeFileAtomicSync(file, html, 'utf-8');
        totals.pages += 1;
        if (merged) totals.blocksMerged += merged.stats.blocksMerged;
        if (deduped) {
          totals.rulesCollapsed += deduped.stats.rulesCollapsed;
          totals.declsDropped += deduped.stats.declsDropped;
        }
        totals.bytesSaved += before.length - html.length;
      } catch (err) {
        console.warn(`  [WARN] HTML 内联样式合并/去重跳过 ${rel}，保留原文件: ${err.message}`);
        totals.skipped += 1;
        totals.skippedDetails.push({ file: rel, reason: err.message });
      }
    }
    if (!compressionPlan.cssDedupe) return totals;
    for (const file of ctx.getAllFiles(ctx.distDir).filter(f => /\.css$/i.test(f))) {
      const rel = distRel(file);
      if (isExcluded(rel, compressionPlan.exclude)) continue;
      try {
        const before = fs.readFileSync(file, 'utf-8');
        const result = dedupeCss(before);
        if (!result.changed) continue;
        writeFileAtomicSync(file, result.css, 'utf-8');
        totals.cssFiles += 1;
        totals.rulesCollapsed += result.stats.rulesCollapsed;
        totals.declsDropped += result.stats.declsDropped;
        totals.bytesSaved += result.stats.bytesSaved;
      } catch (err) {
        console.warn(`  [WARN] CSS 文件去重跳过 ${rel}，保留原文件: ${err.message}`);
        totals.skipped += 1;
        totals.skippedDetails.push({ file: rel, reason: err.message });
      }
    }
    return totals;
  }

  // 改名后按最终字节同步改写全部 HTML 引用（app src / deferred 内联 URL / runtime script src），
  // 维持「文件名哈希 = 最终字节」；替换失败只告警，文件保留新名与旧名两份，不影响可用性。
  function updateBundleRefsInHtml(mapping) {
    const entries = Object.entries(mapping);
    let updated = 0;
    for (const file of ctx.getAllFiles(ctx.distDir).filter(f => /\.html?$/i.test(f))) {
      try {
        let html = fs.readFileSync(file, 'utf-8');
        let changed = false;
        for (const [orig, next] of entries) {
          if (!html.includes(orig)) continue;
          html = html.split(orig).join(next);
          changed = true;
        }
        if (changed) {
          writeFileAtomicSync(file, html, 'utf-8');
          updated += 1;
        }
      } catch (err) {
        console.warn(`  [WARN] bundle 引用更新失败 ${distRel(file)}: ${err.message}`);
        ctx.recordBuildFailure('compression', `bundle ref ${distRel(file)}: ${err.message}`);
      }
    }
    return updated;
  }

  // runtime 引导脚本压缩：copyRuntimeBootstrap 原样复制 js/core/runtime.js（classic script，
  // 以 <script src> 先于 app 执行），基线打包的 esbuild minify 不覆盖它。
  // Terser 选项显式 module=false：引导脚本不是 ESM，压缩器不得按模块语义处理顶层代码；
  // mangle 不带 toplevel，保留 window.* 赋值与顶层标识符。压缩后按最终字节以 md5 重命名并
  // 同步 HTML 引用（与混淆同一「文件名哈希 = 最终字节」原则），旧文件删除，失败保留原文件。
  async function compressRuntimeBootstrap() {
    if (!terser) return null;
    const dir = path.join(ctx.distDir, 'assets', 'js');
    if (!fs.existsSync(dir)) return null;
    const targets = fs.readdirSync(dir).filter(name => RUNTIME_TARGET_RE.test(name));
    if (targets.length === 0) return null;
    const files = [];
    const mapping = {};
    let beforeTotal = 0;
    let afterTotal = 0;
    const startedAt = Date.now();
    for (const name of targets) {
      const rel = 'assets/js/' + name;
      if (isExcluded(rel, compressionPlan.exclude)) continue;
      try {
        const source = fs.readFileSync(path.join(dir, name), 'utf-8');
        const result = await terser.minify(source, {
          module: false,
          compress: true,
          mangle: true,
          output: { comments: false }
        });
        if (!result.code || result.code.length === 0) throw new Error('压缩输出为空');
        if (result.code.length >= source.length) continue;
        const newName = name.replace(/\.[0-9A-Za-z]+\.js$/, '')
          + '.' + crypto.createHash('md5').update(result.code).digest('hex').slice(0, 10) + '.js';
        writeFileAtomicSync(path.join(dir, newName), result.code, 'utf-8');
        if (newName !== name) mapping[rel] = 'assets/js/' + newName;
        files.push({ name, newName, before: Buffer.byteLength(source), after: Buffer.byteLength(result.code) });
        beforeTotal += Buffer.byteLength(source);
        afterTotal += Buffer.byteLength(result.code);
      } catch (err) {
        console.warn(`  [WARN] runtime 压缩跳过 ${name}，保留原文件: ${err.message}`);
        ctx.recordBuildFailure('compression', `JS runtime ${name}: ${err.message}`);
      }
    }
    if (files.length === 0) return null;
    const refsUpdated = Object.keys(mapping).length > 0 ? updateBundleRefsInHtml(mapping) : 0;
    for (const item of files) {
      if (!mapping['assets/js/' + item.name]) continue;
      try {
        fs.unlinkSync(path.join(dir, item.name));
      } catch (err) {
        console.warn(`  [WARN] 旧 runtime 清理失败 ${item.name}: ${err.message}`);
      }
    }
    return { files, beforeTotal, afterTotal, refsUpdated, ms: Date.now() - startedAt };
  }

  // C4：对自研 bundle（本轮 app/deferred，runtime 因参与内容哈希引用而排除）执行可选混淆。
  // 依赖惰性加载（仅开关开启时 require），默认态构建不负担加载耗时；单文件失败只告警。
  async function obfuscateBundles() {
    const targets = selectObfuscationTargets(getBundleFiles())
      .filter(name => !isExcluded('assets/js/' + name, compressionPlan.exclude));
    if (targets.length === 0) return null;
    let obfuscator;
    try {
      obfuscator = require('javascript-obfuscator');
    } catch (err) {
      console.warn('  [WARN] JS 混淆已开启但 javascript-obfuscator 不可用（npm install 后重试）: ' + err.message);
      ctx.recordBuildFailure('compression', 'JS obfuscate: javascript-obfuscator 不可用');
      return null;
    }
    const options = buildObfuscateOptions(compressionPlan.jsObfuscatePreset, compressionPlan.jsObfuscateSeed);
    const dir = path.join(ctx.distDir, 'assets', 'js');
    const mapping = {};
    const files = [];
    let beforeTotal = 0;
    let afterTotal = 0;
    const startedAt = Date.now();
    for (const name of targets) {
      try {
        const source = fs.readFileSync(path.join(dir, name), 'utf-8');
        const output = obfuscator.obfuscate(source, options).getObfuscatedCode();
        if (typeof output !== 'string' || output.length === 0) throw new Error('混淆输出为空');
        const newName = name.replace(/\.[0-9A-Za-z]+\.js$/, '')
          + '.' + crypto.createHash('md5').update(output).digest('hex').slice(0, 10) + '.js';
        writeFileAtomicSync(path.join(dir, newName), output, 'utf-8');
        if (newName !== name) mapping['assets/js/' + name] = 'assets/js/' + newName;
        files.push({ name, newName, before: Buffer.byteLength(source), after: Buffer.byteLength(output) });
        beforeTotal += Buffer.byteLength(source);
        afterTotal += Buffer.byteLength(output);
      } catch (err) {
        console.warn(`  [WARN] JS 混淆跳过 ${name}，保留原文件: ${err.message}`);
        ctx.recordBuildFailure('compression', `JS 混淆 ${name}: ${err.message}`);
      }
    }
    if (files.length === 0) return null;
    const refsUpdated = Object.keys(mapping).length > 0 ? updateBundleRefsInHtml(mapping) : 0;
    for (const item of files) {
      if (!mapping['assets/js/' + item.name]) continue;
      try {
        fs.unlinkSync(path.join(dir, item.name));
      } catch (err) {
        console.warn(`  [WARN] 旧 bundle 清理失败 ${item.name}: ${err.message}`);
      }
    }
    return { files, beforeTotal, afterTotal, refsUpdated, ms: Date.now() - startedAt };
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
  // 返回 { cssSkips }：CSS 合并/去重跳过计数与明细（无增强运行时为 0），供 minifyAll 汇总进构建报告。
  async function runCompressionEnhancements() {
    const cssSkips = { count: 0, details: [] };
    if (!compressionPlan.active) {
      console.log('  [compression] 增强步骤已跳过（serve/watch 或 compression.enabled=false）；基线压缩照常');
      return { cssSkips };
    }
    if (compressionState.override) console.log('  [compression] override: ' + compressionState.override);
    const htmlCfg = (compressionState.config && compressionState.config.html) || {};
    if (htmlCfg.enabled !== false && htmlCfg.collapseWhitespace === false) {
      console.warn('  [WARN] compression.html.collapseWhitespace=false 不受支持：minify-html 始终折叠安全空白，本次构建保持折叠');
    }
    const steps = [];
    if (compressionPlan.htmlAggressive) steps.push('HTML 激进选项');
    if (compressionPlan.cssMergeInlineStyles || compressionPlan.cssDedupe) {
      const css = await runCssEnhancements();
      cssSkips.count = css.skipped;
      cssSkips.details = css.skippedDetails;
      if (css.pages > 0 || css.cssFiles > 0) {
        const parts = [];
        if (css.blocksMerged > 0) parts.push('合并 style 块 ×' + css.blocksMerged + '（' + css.pages + ' 个页面）');
        if (css.rulesCollapsed > 0 || css.declsDropped > 0) {
          parts.push('去重规则 ×' + css.rulesCollapsed + '、声明 ×' + css.declsDropped
            + (css.cssFiles > 0 ? '（含 ' + css.cssFiles + ' 个 CSS 文件）' : ''));
        }
        parts.push('节省 ' + formatBytes(css.bytesSaved));
        console.log('  [compression] CSS：' + parts.join('；'));
        steps.push('CSS 合并去重');
      }
      if (css.skipped > 0) console.log('  [compression] CSS：跳过 ' + css.skipped + ' 个解析异常文件，保留原文件（不计入失败账本；明细见 report.txt）');
    }
    if (compressionPlan.jsonCompact) {
      const count = await compactJsonInDir(ctx.distDir);
      if (count > 0) steps.push('JSON 去空白 ×' + count);
    }
    if (compressionPlan.jsMinify) {
      const runtime = await compressRuntimeBootstrap();
      if (runtime) {
        for (const item of runtime.files) {
          console.log('  [compression] runtime 压缩：' + item.name + ' → ' + item.newName
            + '（' + formatBytes(item.before) + ' → ' + formatBytes(item.after) + '）');
        }
        console.log('  [compression] runtime 压缩合计：' + formatBytes(runtime.beforeTotal) + ' → ' + formatBytes(runtime.afterTotal)
          + '，更新 ' + runtime.refsUpdated + ' 个 HTML 引用，耗时 ' + runtime.ms + 'ms');
        steps.push('runtime 压缩 ×' + runtime.files.length);
      }
    }
    if (compressionPlan.jsObfuscate) {
      const result = await obfuscateBundles();
      if (result) {
        for (const item of result.files) {
          console.log('  [compression] JS 混淆：' + item.name + ' → ' + item.newName
            + '（' + formatBytes(item.before) + ' → ' + formatBytes(item.after) + '）');
        }
        console.log('  [compression] JS 混淆合计：' + formatBytes(result.beforeTotal) + ' → ' + formatBytes(result.afterTotal)
          + '，更新 ' + result.refsUpdated + ' 个 HTML 引用，耗时 ' + result.ms + 'ms（preset=' + compressionPlan.jsObfuscatePreset + '，seed=' + compressionPlan.jsObfuscateSeed + '）');
        steps.push('JS 混淆 ×' + result.files.length);
      } else {
        console.log('  [compression] JS 混淆：无可处理的自研 bundle 或依赖缺失（见告警）');
      }
    }
    console.log('  [compression] ' + (steps.length ? '已执行增强: ' + steps.join('、') : '无增强步骤执行（基线压缩已完成）'));
    return { cssSkips };
  }

  // 无头对比验证（增强完成后、cacheBust 之前）：失败且 fallbackOnFailure=true 时用基线快照
  // 覆写 dist（回退未压缩产物）并以非阻断记录进入构建报告；false 时保留压缩产物且阻断构建。
  // 端口/进程清理由 verifyCompression 内部无条件执行，结束后校验端口释放。
  function reportedPorts(report) {
    const servers = (report && report.servers) || [];
    return servers.length ? servers.map((server) => server.role + ':' + server.port).join('，') : '-';
  }

  async function runCompressionVerification(baseline, chromePath) {
    let report;
    try {
      report = await verifyCompression({
        distDir: ctx.distDir,
        baselineDir: baseline.dir,
        chromePath,
        obfuscateEnabled: compressionPlan.jsObfuscate === true,
        bootstrapAssertions: compressionPlan.jsMinify === true || compressionPlan.jsObfuscate === true,
        profileDir: ctx.compressionVerifyProfileDir,
        cwd: path.resolve(__dirname, '..', '..')
      });
    } catch (err) {
      report = {
        version: 1,
        status: 'failed',
        checkedAt: new Date().toISOString(),
        pages: [],
        failures: [{ kind: 'internal', detail: String((err && err.stack) || err) }],
        fallback: null
      };
    }
    if (report.status === 'skipped') {
      console.warn('  [WARN] 压缩无头对比已跳过：' + (report.reason || '未知原因') + '（构建继续）');
    } else if (report.status === 'passed') {
      console.log('  [compression-verify] PASS：' + (report.pages || []).length + ' 页断言通过（'
        + (report.durationsMs || 0) + 'ms，端口 ' + reportedPorts(report) + '，释放 '
        + (report.portsReleased === false ? '异常' : '正常') + '）');
    } else {
      const summary = summarizeFailures(report.failures);
      if (compressionPlan.fallbackOnFailure === true) {
        let restored = null;
        try {
          restored = restoreBaselineSnapshot(baseline.dir, ctx.distDir);
        } catch (err) {
          report.fallback = { applied: false, error: err.message };
        }
        if (restored) {
          const evidence = compareSnapshotBytes(baseline.dir, ctx.distDir);
          report.fallback = {
            applied: true,
            restored: restored.restored,
            removed: restored.removed,
            bytesIdentical: evidence.match,
            mismatches: evidence.mismatches.slice(0, 5)
          };
          const message = '压缩无头对比失败：' + summary + '；已回退未压缩产物（恢复 ' + restored.restored
            + ' 个文件、移除 ' + restored.removed + ' 个增强产物，逐字节复核 '
            + (evidence.match ? '一致' : '不一致') + '）';
          console.warn('  [WARN] ' + message);
          ctx.recordBuildFailure('compression-verify', message, { fatal: false });
          if (!evidence.match) {
            console.error('  [ERROR] 回退后仍与基线不一致：' + evidence.mismatches.slice(0, 5).join('、'));
            ctx.recordBuildFailure('compression-verify', '回退后与基线不一致：' + evidence.mismatches.slice(0, 5).join('、'));
          }
        } else {
          console.error('  [ERROR] 压缩无头对比失败且回退失败：' + summary + '；' + report.fallback.error);
          ctx.recordBuildFailure('compression-verify', '压缩验证失败且回退失败：' + summary + '；' + report.fallback.error);
        }
      } else {
        const message = '压缩无头对比失败（verify.fallbackOnFailure=false，保留压缩产物）：' + summary;
        console.error('  [ERROR] ' + message);
        ctx.recordBuildFailure('compression-verify', message);
      }
    }
    writeVerifyReport(verifyReportPath(), report);
    const keepBaseline = String(process.env.SYNAPSE_COMPRESSION_BASELINE_KEEP || '') === '1';
    if (!keepBaseline) {
      try { fs.rmSync(baseline.dir, { recursive: true, force: true }); }
      catch (err) { console.warn('  [WARN] 压缩基线快照清理失败 ' + baseline.dir + ': ' + err.message); }
    }
  }

  // Run all three minifiers (HTML, CSS, JS) across the dist/ directory.
  // Each skips gracefully if its package is missing or the feature is disabled.
  async function minifyAll(config) {
    console.log('[11/14] Minifying assets...');
    refreshCompressionState();
    reportCompressionIssues();
    // 前后快照仅服务 dist/report.txt 的体积对照，不改变压缩流程本身。
    const statsBefore = snapshotCompressionStats();
    await minifyHTMLInDir(ctx.distDir, config);
    await minifyInlineStylesInDir(ctx.distDir, config);
    await minifyCSSInDir(ctx.distDir, config);
    if (!ctx.bundleActive) await minifyJSInDir(path.join(ctx.distDir, 'assets', 'js'), config);
    // 基线快照紧贴增强阶段之前建立（内容 = 基线压缩后的字节）；无头验证在其后、cacheBust 之前，
    // 保证「哈希=最终字节」：一旦回退，参与内容哈希的就是回退后的产物。
    let baseline = null;
    let verifyChrome = null;
    if (shouldRunVerification()) {
      verifyChrome = resolveChromePath('');
      if (!verifyChrome) {
        console.warn('  [WARN] compression.verify.headless=true 但未探测到 Chrome：跳过无头对比验证（构建继续）');
        writeVerifyReport(verifyReportPath(), {
          version: 1,
          status: 'skipped',
          reason: 'chrome-not-found',
          checkedAt: new Date().toISOString(),
          pages: [],
          failures: []
        });
      } else {
        try {
          baseline = createBaselineSnapshot(ctx.distDir, compressionBaselineDir);
        } catch (err) {
          console.warn('  [WARN] 压缩基线快照创建失败，跳过无头验证：' + err.message);
          ctx.recordBuildFailure('compression-verify', '基线快照创建失败：' + err.message, { fatal: false });
          writeVerifyReport(verifyReportPath(), {
            version: 1,
            status: 'skipped',
            reason: 'baseline-snapshot-failed: ' + err.message,
            checkedAt: new Date().toISOString(),
            pages: [],
            failures: []
          });
        }
      }
    }
    const enhancements = await runCompressionEnhancements();
    if (baseline) await runCompressionVerification(baseline, verifyChrome);
    const types = [];
    if (config.site.build.minifyHTML) types.push('HTML');
    if (config.site.build.minifyCSS) types.push('CSS');
    if (config.site.build.minifyJS) types.push('JS');
    if (types.length)     console.log(`  Minified: ${types.join(', ')}`);
    else console.log('  [SKIP] Minification disabled');
    const stats = buildCompressionStats(statsBefore, snapshotCompressionStats());
    stats.cssSkips = enhancements.cssSkips;
    return stats;
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
    // 跳过：node_modules、og 目录、assets 目录、SW 固定路径；以及 PWA manifest 引用的固定文件名图标
    // （manifest.json 不参与路径重写，若对图标做哈希重命名会导致 manifest 引用 404）。
    // SW 文件名与图标文件名均从 site.pwa 派生（serviceWorker / manifest.icons[].src 的 basename）。
    const pwaCfg = config.site.pwa || {};
    const pwaManifest = pwaCfg.manifest || {};
    const swBaseName = path.basename(String(pwaCfg.serviceWorker || '/sw.js').split('?')[0].split('#')[0]);
    const iconBaseNames = new Set((Array.isArray(pwaManifest.icons) ? pwaManifest.icons : [])
      .map((icon) => (icon && typeof icon.src === 'string' ? path.basename(icon.src.split('?')[0].split('#')[0]) : ''))
      .filter(Boolean));
    const files = ctx.getAllFiles(ctx.distDir).filter(f => bustRegex.test(f) && !f.includes('node_modules') && !f.includes(path.sep + 'og' + path.sep) && !f.includes(path.sep + 'assets' + path.sep) && path.basename(f) !== swBaseName && !iconBaseNames.has(path.basename(f)));
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
      // v2 索引在生成期已预计算最终路径；此处保留兜底重写（不影响文件名与内容哈希一致性检查）。
      const jsonIndexes = ctx.getAllFiles(ctx.distDir).filter(f => /(^|\/)search-index(\.[0-9a-f]+)?\.json$/i.test(f));
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

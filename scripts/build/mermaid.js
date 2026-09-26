'use strict';
// Mermaid 构建期渲染接线模块（scripts/build/mermaid.js）。
// 职责：markdown 解析后从文章 HTML 收集 mermaid 块 → 全站汇总 → 一次 renderBatch
// → 回填为双主题内联 SVG；失败/无 Chrome 时保留客户端回退（article.hasMermaid 维持 true，
// layout.ejs 据此懒加载 vendor 并由 __mmStart 接管）。缓存目录 .cache/mermaid（不入库）。
const path = require('path');
const { extractMermaidBlocks, replaceMermaidBlocks, createMermaidRenderer } = require('../lib/mermaid-render');

function createMermaidModule(ctx) {
  // 返回 { blocks, rendered, cached, failed, skipped } 统计；不抛出（渲染故障一律走回退）。
  async function renderArticlesMermaid(config, articles) {
    const stats = { blocks: 0, rendered: 0, cached: 0, failed: 0, skipped: '' };
    const cfg = (config.features && config.features.mermaid) || {};
    if (cfg.enabled === false) { stats.skipped = 'disabled'; return stats; }
    if (cfg.mode === 'client') { stats.skipped = 'client-mode'; return stats; }
    const darkMode = cfg.darkMode !== false;
    const targets = [];
    for (const article of articles || []) {
      if (!article || !article.hasMermaid) continue;
      const blocks = extractMermaidBlocks(article.content || '');
      if (!blocks.length) continue;
      targets.push({ article, blocks, slots: [] });
    }
    if (!targets.length) { stats.skipped = 'no-blocks'; return stats; }

    const batch = [];
    for (const target of targets) {
      for (const block of target.blocks) {
        const lightIndex = batch.length;
        batch.push({ code: block.code, theme: cfg.lightTheme || 'default' });
        let darkIndex = -1;
        if (darkMode) {
          darkIndex = batch.length;
          batch.push({ code: block.code, theme: cfg.darkTheme || 'dark' });
        }
        target.slots.push({ lightIndex, darkIndex });
      }
    }
    stats.blocks = targets.reduce((sum, t) => sum + t.blocks.length, 0);

    const renderer = createMermaidRenderer({
      cacheDir: path.join(ctx.rootDir, '.cache', 'mermaid'),
      logger: console,
      chromePath: cfg.chromePath || '',
      // 单块渲染超时来自 features.mermaid.renderTimeoutMs；缺省时回退 lib 内置默认（与 schema 同值）。
      timeoutMs: cfg.renderTimeoutMs
    });
    const results = await renderer.renderBatch(batch);

    for (const target of targets) {
      const blockResults = target.slots.map((slot) => {
        const light = results[slot.lightIndex] || { error: 'missing-result' };
        const dark = slot.darkIndex >= 0 ? (results[slot.darkIndex] || { error: 'missing-result' }) : null;
        const failed = !light.svg || (darkMode && (!dark || !dark.svg));
        if (failed) return { error: light.error || (dark && dark.error) || 'render-failed' };
        if (light.cached) stats.cached += 1;
        if (dark && dark.cached) stats.cached += 1;
        return { svg: light.svg, svgDark: dark ? dark.svg : null };
      });
      target.article.content = replaceMermaidBlocks(target.article.content, blockResults, {
        darkMode,
        size: cfg.size || {},
        nonce: ctx.cspNonce || ''
      });
      const pending = (target.article.content.match(/data-mm-pending="1"/g) || []).length;
      stats.failed += pending;
      stats.rendered += target.blocks.length - pending;
      target.article.hasMermaid = pending > 0;
    }
    console.log('  mermaid: ' + stats.rendered + ' rendered / ' + stats.cached
      + ' cached / ' + stats.failed + ' failed (SSR 模式，失败块回退客户端)');
    return stats;
  }

  return { renderArticlesMermaid };
}

module.exports = { createMermaidModule };

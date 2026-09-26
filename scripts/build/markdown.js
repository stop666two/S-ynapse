'use strict';
// Markdown 渲染器（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 依赖 marked 单例与 lib/utils 转义辅助直连 require，无编排器注入项。
const { marked } = require('marked');
const { escapeAttr, escapeHtml, safeSlug } = require('../lib/utils');

function createMarkdownModule() {
  // Configure the marked Markdown renderer with custom handlers for:
  // - Image: responsive <picture> tags with WebP sources (when mediaManifest is available)
  // - Link: external links get target="_blank" + rel="noopener noreferrer"
  // - Heading: h2-h4 get anchor links (slugified IDs) for ToC navigation
  // - Code: language-labeled <pre> blocks with optional line numbers
  // Called once per build before article/page parsing.
  function setupMarkedRenderer(config, mediaManifest) {
    const F = config.features || {};
    const imgLazy = (F.imageLazy && F.imageLazy.enabled !== false);
    const usePicture = config.site.build.usePictureTag !== false;
    const showLineNumbers = !!(F.codeBlock && (F.codeBlock.lineNumbers || F.codeBlock.showLineNumbers));
    const extTarget = config.site.build.externalLinksTarget || '_blank';
    const extRel = config.site.build.externalLinksRel || 'noopener noreferrer';
    const siteUrl = (config.site.url || '').replace(/\/+$/, '');

    // Math-guard extension: captures KaTeX-style math spans (*before* supSub / other
    // inline extensions) so that superscript/subscript syntax inside formulas stays
    // untouched for client-side auto-render (KaTeX).
    // - Block level:  $$ ... $$ (may span lines)
    // - Inline level: $ ... $, \( ... \), \[ ... \]
    marked.use({
      extensions: [
        {
          name: 'mathGuardBlock',
          level: 'block',
          start(src) {
            // Block formulas must start a line (^$$) — not appear mid-line
            // or inside inline code spans.
            const m = /^\$\$/m.exec(src);
            return m ? m.index : undefined;
          },
          tokenizer(src) {
            const m = /^\$\$[\s\S]*?\$\$/.exec(src);
            if (m) return { type: 'mathGuardBlock', raw: m[0] };
            return undefined;
          },
          renderer(token) { return token.raw; }
        },
        {
          name: 'mathGuardInline',
          level: 'inline',
          start(src) {
            // Skip backtick-wrapped inline code spans: math delimiters inside
            // `code` must stay untouched for marked's code tokenizer.
            let inCode = false;
            for (let i = 0; i < src.length; i++) {
              if (src[i] === '`') {
                while (i < src.length && src[i] === '`') i++;
                inCode = !inCode;
                i--;
                continue;
              }
              if (inCode) continue;
              if (src[i] === '$' || src[i] === '\\') return i;
            }
            return undefined;
          },
          tokenizer(src) {
            const m = /^(?:\$\$(?!\s)[^\n]*?\$\$|\$(?!\$)(?:\\.|[^$\\\n])+\$(?!\d)|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/.exec(src);
            if (m) return { type: 'mathGuardInline', raw: m[0] };
            return undefined;
          },
          renderer(token) { return token.raw; }
        }
      ]
    });

    // Superscript / subscript extension (marked 12 has no built-in ^x^ / ~x~ syntax):
    marked.use({
      extensions: [{
        name: 'supSub',
        level: 'inline',
        start(src) {
          const m = src.match(/[\^~]/);
          return m ? m.index : undefined;
        },
        tokenizer(src) {
          const match = /^([~^])([^~^\n]+?)\1/.exec(src);
          if (match) {
            return {
              type: 'supSub',
              raw: match[0],
              text: match[2],
              up: match[1] === '^'
            };
          }
          return undefined;
        },
        renderer(token) {
          const body = escapeHtml(token.text);
          return token.up ? `<sup>${body}</sup>` : `<sub>${body}</sub>`;
        }
      }]
    });

    marked.use({
      renderer: {
        // Task-list checkbox with accessible name (WCAG label):
        checkbox(checked) {
          return `<input type="checkbox" disabled${checked ? ' checked' : ''} aria-label="任务">`;
        },
        // Image renderer with responsive fallback chain:
        // 1. If usePicture + manifest: <picture> with WebP + size variants + original fallback
        // 2. If manifest only (picture disabled): <img> with original path from manifest
        // 3. No manifest: raw <img> with the href as-is
        image(href, title, text) {
          if (!href) return '';
          const alt = text || '';
          const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
          const _perf = (typeof config !== 'undefined' && config.site && config.site.performance) || {};
          const decoding = _perf.imageDecoding ? ` decoding="${_perf.imageDecoding}"` : '';
          const loading = imgLazy ? ' loading="lazy"' : '';
          const decodedHref = href.replace(/&amp;/g, '&');
          if (usePicture && mediaManifest) {
            const normHref = decodedHref.replace(/^\//, '');
            const entry = mediaManifest[normHref];
            if (entry && entry.variants && Object.keys(entry.variants).length > 0) {
              const lqipAttr = entry.lqip ? ` data-lqip="${escapeAttr(entry.lqip)}"` : '';
              const iwAttr = entry.width ? ` data-iw="${entry.width}"` : '';
              const dimAttr = (parseInt(entry.width, 10) && parseInt(entry.height, 10))
                ? ` width="${parseInt(entry.width, 10)}" height="${parseInt(entry.height, 10)}"` : '';
              const webpSources = [];
              const avifSources = [];
              const origSources = [];
              const sizesAttr = (_perf.imageSizes && _perf.imageSizes !== 'auto') ? _perf.imageSizes : '(max-width: 768px) 100vw, 768px';
              for (const [key, val] of Object.entries(entry.variants)) {
                const fmt = key.split('-').pop();
                const escaped = escapeAttr(val);
                if (fmt === 'webp') webpSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}" type="image/webp">`);
                else if (fmt === 'avif') avifSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}" type="image/avif">`);
                else origSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}"${fmt === 'original' ? '' : ` type="image/${fmt}"`}>`);
              }
              const fallbackSrc = escapeAttr(entry.original || decodedHref);
              let html = '<picture>\n';
              html += avifSources.join('\n');
              if (avifSources.length && (webpSources.length || origSources.length)) html += '\n';
              html += webpSources.join('\n');
              if (webpSources.length && origSources.length) html += '\n';
              html += origSources.join('\n') + '\n';
              html += `  <img src="${fallbackSrc}" alt="${escapeAttr(alt)}"${titleAttr}${loading}${decoding}${lqipAttr}${iwAttr}${dimAttr}>\n`;
              html += '</picture>';
              return html;
            }
          }
          if (mediaManifest) {
            const norm = decodedHref.replace(/^\//, '');
            const entry = mediaManifest[norm];
            if (entry && entry.original) {
              const lqipAttr = entry.lqip ? ` data-lqip="${escapeAttr(entry.lqip)}"` : '';
              const iwAttr = entry.width ? ` data-iw="${entry.width}"` : '';
              const dimAttr = (parseInt(entry.width, 10) && parseInt(entry.height, 10))
                ? ` width="${parseInt(entry.width, 10)}" height="${parseInt(entry.height, 10)}"` : '';
            return `<img src="${escapeAttr(entry.original)}" alt="${escapeAttr(alt)}"${titleAttr}${loading}${decoding}${lqipAttr}${iwAttr}${dimAttr}>`;
            }
          }
          return `<img src="${escapeAttr(decodedHref)}" alt="${escapeAttr(alt)}"${titleAttr}${loading}${decoding}>`;
        },

        // Link renderer — adds target="_blank" + rel="noopener noreferrer" to external links.
        // Internal links (starts with site URL or relative) render as-is.
        // If href is empty, returns the link text unwrapped (safe fallback).
        link(href, title, text) {
          if (!href) return text || '';
          const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
          const isExternal = /^https?:\/\//.test(href) && !href.startsWith(siteUrl);
          let extra = '';
          if (isExternal) {
            extra += ` target="${escapeAttr(extTarget)}" rel="${escapeAttr(extRel)}"`;
          }
          return `<a href="${escapeAttr(href)}"${titleAttr}${extra}>${text}</a>`;
        },

        // Heading renderer — generates anchor-linked headings for h2-h4.
        // h1 (page title) and h5-h6 do not get anchor links.
        // The anchor uses safeSlug() on the stripped text for URL-friendly IDs.
        heading(text, level) {
          if (level < 2 || level > 4) return `<h${level}>${text}</h${level}>`;
          const id = safeSlug(text.replace(/<[^>]+>/g, ''));
          return `<h${level} id="${escapeAttr(id)}"><a href="#${escapeAttr(id)}" class="heading-anchor">#</a>${text}</h${level}>`;
        },

        // Code block renderer — wraps in <pre><code> with language class.
        // lineNumbers → pre.line-numbers（Prism line-numbers 插件在客户端渲染行号列）;
        // wrapLongLines → pre.wrap-lines（软换行替代横向滚动）。
        // The data-language attribute drives the CSS ::before label in layout.ejs.
        code(text, lang) {
          const preCls = [];
          if (showLineNumbers) preCls.push('line-numbers');
          if (F.codeBlock && F.codeBlock.wrapLongLines) preCls.push('wrap-lines');
          const preClsAttr = preCls.length ? ` class="${preCls.join(' ')}"` : '';
          const rawLang = lang ? String(lang).trim() : '';
          const langName = rawLang.split(/\s+/)[0] || '';
          let sizeAttrs = '';
          if (langName === 'mermaid') {
            const norm = v => (/^[0-9.]+$/.test(v) ? v + 'px' : v);
            const wm = rawLang.match(/(?:^|\s)w=([0-9.]+(?:px|%|vw|vh|rem)?)(?=\s|$)/);
            const hm = rawLang.match(/(?:^|\s)h=([0-9.]+(?:px|%|vw|vh|rem)?)(?=\s|$)/);
            if (wm) sizeAttrs += ` data-w="${escapeAttr(norm(wm[1]))}"`;
            if (hm) sizeAttrs += ` data-h="${escapeAttr(norm(hm[1]))}"`;
          }
          const langAttr = langName ? ` class="language-${escapeAttr(langName)}"` : '';
          const langLabel = langName ? ` data-language="${escapeAttr(langName)}"` : '';
          return `<pre${preClsAttr}${langLabel}${sizeAttrs}><code${langAttr}>${escapeHtml(text)}</code></pre>`;
        }
      }
    });
  }

  return { setupMarkedRenderer };
}

module.exports = { createMarkdownModule };

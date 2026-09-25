'use strict';
// EJS 模板渲染（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createRenderModule(ctx) 注入模板目录、构建期 nonce、hooks 与构建错误收集器。
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function createRenderModule(ctx) {
  // Read an EJS template file from templates/ directory. Returns raw string or null.
  function getTemplate(name) {
    const filePath = path.join(ctx.templatesDir, name);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  }

  // 给最终 HTML 中所有 <script> 标签注入构建期 nonce（已有 nonce 属性则跳过）。
  // 假设：模板产出里 "<script" 只出现在真实脚本标签起始处，且标签属性值内不含 ">"
  // （当前模板满足；若将来引入含 "<script" 字样的字符串/注释需改用 DOM 解析）。
  function injectScriptNonce(html) {
    if (!html || typeof html !== 'string') return html;
    return html.replace(/<script\b(?![^>]*\bnonce\s*=)[^>]*>/gi, function (tag) {
      const tail = tag.slice(-2) === '/>' ? '/>' : '>';
      const head = tag.slice(0, tag.length - tail.length);
      return head + ' nonce="' + ctx.cspNonce + '"' + tail;
    });
  }

  // 给最终 HTML 中所有内联 <style> 块注入与 <script> 同一枚构建期 nonce（已有 nonce 则跳过）。
  // 仅作用于内联 <style> 元素（style-src-elem 语境）；外链 <link rel="stylesheet"> 不在此列。
  // 内联 style="..." 属性不受 nonce 约束（CSP 规范中属性不支持 nonce），由 style-src-attr 放行。
  function injectStyleNonce(html) {
    if (!html || typeof html !== 'string') return html;
    return html.replace(/<style\b(?![^>]*\bnonce\s*=)[^>]*>/gi, function (tag) {
      const tail = tag.slice(-2) === '/>' ? '/>' : '>';
      const head = tag.slice(0, tag.length - tail.length);
      return head + ' nonce="' + ctx.cspNonce + '"' + tail;
    });
  }

  // Render an EJS template inside the layout template.
  // 1. Render inner template (e.g. index.ejs) → body HTML
  // 2. Wrap body in layout.ejs with merged data
  // 3. Run hooks.transformHTML if available
  // Returns full HTML string, or null on failure.
  // Compose the final HTML <title> for a page based on seo.titleTemplate in site.json5.
  // Placeholders: {site} {subtitle} {title}. Falls back to '{title} | {site}' (index: just site title).
  function applyTitleTemplate(config, pageType, pageTitle, lang) {
    const tplSrc = (config.site.seo && config.site.seo.titleTemplate) || null;
    const fallback = pageType === 'index' ? '{site}' : '{title} | {site}';
    const tpl = tplSrc ? (tplSrc[pageType] || tplSrc.default || fallback) : fallback;
    const site = (lang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || '');
    const subtitle = (lang === 'en' && config.site.subtitleEn) ? config.site.subtitleEn : (config.site.subtitle || '');
    let out = tpl.replace(/\{site\}/g, site).replace(/\{subtitle\}/g, subtitle);
    if (pageTitle) out = out.replace(/\{title\}/g, pageTitle);
    else out = out.replace(/\{title\}/g, site);
    return out.trim();
  }

  function renderPage(templateName, data, layoutTemplate, cfg) {
    const templateStr = getTemplate(templateName);
    if (!templateStr) {
      console.error(`  [ERROR] Template not found: ${templateName}`);
      ctx.recordBuildFailure('render', `Template not found: ${templateName}`);
      return null;
    }
    try {
      const rawTitle = (typeof data.title !== 'undefined' && data.title) ? data.title : null;
      const pageTitleFinal = applyTitleTemplate(cfg, data.currentPage || 'index', rawTitle, data.lang);
      const bodyContent = ejs.render(templateStr, data, { filename: path.join(ctx.templatesDir, templateName) });
      let result;
      if (layoutTemplate) {
        result = ejs.render(layoutTemplate, { ...data, pageTitleFinal, body: bodyContent }, { filename: path.join(ctx.templatesDir, 'layout.ejs') });
      } else {
        result = bodyContent;
      }
      if (ctx.hooks && ctx.hooks.transformHTML) {
        result = ctx.hooks.transformHTML(result, { template: templateName, ...data }) || result;
      }
      // nonce 注入放在 hooks.transformHTML 之后，确保最终串与 CSP 同源
      return injectStyleNonce(injectScriptNonce(result));
    } catch (err) {
      console.error(`  [ERROR] Failed to render template ${templateName}: ${err.message}`);
      ctx.recordBuildFailure('render', `Failed to render template ${templateName}: ${err.message}`);
      return null;
    }
  }

  return { getTemplate, injectScriptNonce, injectStyleNonce, applyTitleTemplate, renderPage };
}

module.exports = { createRenderModule };

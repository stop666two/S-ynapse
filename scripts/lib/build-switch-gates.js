'use strict';
// 构建类配置开关的统一判定（审查 R-33 接线）。
// 背景：features.gallery.enabled / features.autoSummary.enabled / features.mediaAudit.enabled /
// features.exportBackup.enabled 四个键此前只有 features.json5 注释与 schema 默认值，生产代码从不读取，
// 用户写 false 毫无效果。此模块把「键 → 行为」收敛为可单测的纯函数，消费方只调用函数，
// 不再各自内联字面量判断，避免再次出现「有键无消费」。
// 统一语义：键缺失 = 默认开（历史行为）；仅显式 false 才关闭（与项目既有 `x !== false` 惯例一致）。

// features.gallery.enabled：图库页总开关。
// 与 site.build.generateGallery 是「与」关系：后者是构建期页面族闸门，前者是图库模块总开关；
// 任一显式 false 都不产出 /{lang}/gallery/（页面、sitemap 条目、站内入口一起消失）。
function galleryPageEnabled(config) {
  const features = (config && config.features) || {};
  const gallery = features.gallery;
  if (gallery && gallery.enabled === false) return false;
  const build = (config && config.site && config.site.build) || {};
  return build.generateGallery !== false;
}

// features.autoSummary.enabled：frontmatter 没有 excerpt 时，是否用正文自动生成摘要。
// false = 只用 frontmatter excerpt；缺失即空串（卡片/meta/feed/搜索索引的其它字段不受影响）。
function autoSummaryEnabled(features) {
  const autoSummary = (features && features.autoSummary) || {};
  return autoSummary.enabled !== false;
}

// features.mediaAudit.enabled：npm run audit:media 总开关（false = 跳过审计，exit 0）。
function mediaAuditEnabled(features) {
  const mediaAudit = (features && features.mediaAudit) || {};
  return mediaAudit.enabled !== false;
}

// features.exportBackup.enabled：npm run export 总开关（false = 拒绝执行，非零退出码）。
function exportBackupEnabled(features) {
  const exportBackup = (features && features.exportBackup) || {};
  return exportBackup.enabled !== false;
}

// 站内图库 URL 判定：/gallery、/gallery/、/zh/gallery/、/en/gallery/?x=1 都算；
// 外链（含协议相对 //host/gallery）不算——那是站点所有者的外部链接，剪掉会改变语义。
// RESERVED_ROUTE_SEGMENTS 已禁止文章 slug 取 gallery，因此不会误伤文章路由。
function isGalleryUrl(url) {
  const raw = String(url == null ? '' : url).trim();
  if (!raw) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return false;
  if (raw.startsWith('//')) return false;
  const pathname = raw.split('#')[0].split('?')[0].replace(/\/+$/, '');
  return /(^|\/)gallery$/.test(pathname);
}

// 导航菜单裁剪：features.gallery.enabled=false 时移除指向图库的菜单项，
// 否则导航入口直达 404（site.json5 的 generateGallery 注释早已提示「需另行移除入口」）。
function pruneGalleryMenuItems(menu) {
  if (!Array.isArray(menu)) return menu;
  return menu.filter(function (item) { return !item || !isGalleryUrl(item.url); });
}

// 页脚链接裁剪：bottomLinks.items 与 columnItems.items[].links 里指向图库的条目一并移除。
function pruneGalleryFooterLinks(footer) {
  if (!footer) return footer;
  const copy = JSON.parse(JSON.stringify(footer));
  const keep = function (link) { return !link || !isGalleryUrl(link.url); };
  if (copy.bottomLinks && Array.isArray(copy.bottomLinks.items)) {
    copy.bottomLinks.items = copy.bottomLinks.items.filter(keep);
  }
  if (copy.columnItems && Array.isArray(copy.columnItems.items)) {
    copy.columnItems.items = copy.columnItems.items.map(function (column) {
      if (!column || !Array.isArray(column.links)) return column;
      return Object.assign({}, column, { links: column.links.filter(keep) });
    });
  }
  return copy;
}

module.exports = {
  galleryPageEnabled,
  autoSummaryEnabled,
  mediaAuditEnabled,
  exportBackupEnabled,
  isGalleryUrl,
  pruneGalleryMenuItems,
  pruneGalleryFooterLinks
};

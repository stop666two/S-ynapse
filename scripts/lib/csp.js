// csp.js —— CSP 指令构建期裁剪
//
// 背景：security.json5 的 csp.directives 是「全功能超集」（含评论/统计/CDN/字体等
// 可选能力所需域名）。构建时按实际启用的功能裁剪，避免为未启用能力保留攻击面
// （最小权限原则）。同一函数被 _headers 生成（build.js）与 Worker 配置生成
// （generate-security-config.js）共用，保证静态层与边缘层指令完全一致。
//
// 裁剪规则（仅针对已知可选域名，其余值原样保留）：
//   · https://giscus.app          → 仅当评论启用且 provider='giscus' 且相关开关未关闭
//   · https://cdn.jsdelivr.net    → 仅当 theme.externalAssets 中确有引用该域的资源
//   · https://fonts.googleapis.com→ 仅当 externalAssets.styles 引用 Google Fonts
//   · https://fonts.gstatic.com   → 同上，或 externalAssets.fontPreloads 引用 gstatic
// （https://static.cloudflareinsights.com 与 https://cloudflareinsights.com 不裁剪：
//   Pages 平台可能自动注入统计信标，域名不可由站点代码单方面判定为未使用。）
//
// 契约：纯函数。不修改入参；返回新对象；被裁空的指令整条删除（CSP 允许省略）。
'use strict';

const GISCUS = 'https://giscus.app';
const JSDELIVR = 'https://cdn.jsdelivr.net';
const GFONTS = 'https://fonts.googleapis.com';
const GSTATIC = 'https://fonts.gstatic.com';

/** 外部资源引用串（styles/scripts/fontPreloads 拼接，用于子串匹配域名）。 */
function externalBlob(externalAssets) {
  const a = externalAssets || {};
  return []
    .concat(Array.isArray(a.styles) ? a.styles : [], Array.isArray(a.scripts) ? a.scripts : [], Array.isArray(a.fontPreloads) ? a.fontPreloads : [])
    .filter(function (v) { return typeof v === 'string'; })
    .join(' ');
}

/**
 * 裁剪 CSP 指令。
 * @param {Object} directives 原始指令对象（key → string[]）
 * @param {{giscusNeeded?: boolean, externalAssets?: Object}} [context] 功能开关上下文；
 *   缺省视为全部可选域名不使用（最严格）。
 * @returns {Object} 新指令对象（已裁剪；空指令被移除）
 */
function trimCspDirectives(directives, context) {
  const src = directives && typeof directives === 'object' ? directives : {};
  const ctx = context || {};
  const blob = externalBlob(ctx.externalAssets);
  const needs = {
    [GISCUS]: ctx.giscusNeeded === true,
    [JSDELIVR]: blob.indexOf(JSDELIVR) > -1,
    [GFONTS]: blob.indexOf(GFONTS) > -1,
    [GSTATIC]: blob.indexOf(GSTATIC) > -1 || blob.indexOf(GFONTS) > -1
  };
  const out = {};
  Object.keys(src).forEach(function (key) {
    const vals = Array.isArray(src[key]) ? src[key] : [];
    const kept = vals.filter(function (v) {
      return !(v in needs) || needs[v];
    });
    if (kept.length > 0) out[key] = kept;
  });
  return out;
}

module.exports = { trimCspDirectives };

// 运行期注入 <style> 的唯一入口：生产 CSP 的 style-src 不含 'unsafe-inline'，
// 只放行构建期 nonce（scripts/build/security-files.js 的 applyCspNonce 追加 'nonce-…'）。
// 脚本创建的 <style> 必须在插入前复制同一枚 nonce，否则整段样式被 style-src-elem 拒绝——
// 主题预设换肤、guard 的 iOS/选择样式都因此静默失效，而本地预览不走 CSP 看不出来。
// 同源写法先例：js/domains/core/seamless-nav.js 为 speculationrules script 复制 nonce。
export function injectStyle(id, css) {
  let el = id ? document.getElementById(id) : null;
  if (!el) {
    el = document.createElement('style');
    if (id) el.id = id;
    document.head.appendChild(el);
  }
  // 无 nonce 时（本地预览 / 未启用 CSP）保持既有行为：只写内容，不设属性。
  const nonceEl = document.querySelector('script[nonce]') || document.querySelector('style[nonce]');
  if (nonceEl) {
    const n = nonceEl.nonce || nonceEl.getAttribute('nonce') || '';
    if (n) el.nonce = n;
  }
  el.textContent = css;
  return el;
}

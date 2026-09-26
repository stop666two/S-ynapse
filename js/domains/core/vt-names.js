// 共享元素过渡名（view-transition-name）：模板以 data-vt 输出，运行期经 CSSOM 写入元素 style。
// 约束：CSP style-src-attr 不支持 nonce，属性语境一律拒绝内联 style；CSSOM 写入不受该指令限制。
// 时序：软导航交换 content-wrapper 后需重扫，故注册到 __SOFTNAV_HOOKS__。
export function init() {
  function apply() {
    const list = document.querySelectorAll('[data-vt]');
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      const name = el.getAttribute('data-vt');
      if (!name) continue;
      try {
        el.style.setProperty('view-transition-name', name);
      } catch (e) { /* 忽略：个别浏览器不支持该属性时按无共享元素降级 */ }
    }
  }
  apply();
  if (Array.isArray(window.__SOFTNAV_HOOKS__)) window.__SOFTNAV_HOOKS__.push(apply);
}

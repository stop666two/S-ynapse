---
title: 建站手记（二）· 主题与排版
slug: series-2
date: 2026-07-12 08:00:00
series: 建站手记
tags: [系列, 主题, 测试]
categories: [随笔]
description: 系列第二篇：主题预设、明暗模式、黄金分割排版与图标细节。
featuredImage: /media/test-photo-4.jpg
---

# 建站手记（二）· 主题与排版

系列第二篇。文末应显示「上一集 / 下一集」双入口。

## 主题预设

站点内置多套配色预设，切换只改 CSS 变量，不重新构建：

- 亮色与暗色各自维护一套色板；
- 强调色、链接色、卡片阴影都走变量；
- 主题记忆保存在本地，刷新不丢失。

## 排版的三个决定

1. **字号阶梯**用黄金比逐级放大，标题层级一眼可辨；
2. **正文行长**控制在 72ch 以内，中文约 38–42 字更舒适；
3. **代码与正文**使用不同等宽/无衬线组合，边界清晰。

> 排版不是装饰，而是阅读速度的控制器。

## 一个主题切换的最小实现

```js
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('s-theme', mode);
}
document.querySelector('.dark-toggle').addEventListener('click', () => {
  const now = document.documentElement.getAttribute('data-theme');
  applyTheme(now === 'dark' ? 'light' : 'dark');
});
```

![主题照片示例](/media/test-photo-4.jpg "明暗两种模式下都要检查对比度")

上一集：[建站手记（一）](/zh/series-1/)。下一集：[建站手记（三）](/zh/series-3/)。

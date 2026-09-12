---
title: Site Building Notes (2) · Theme & Typography
slug: series-2
date: 2026-07-12 08:00:00
series: Site Building Notes
tags: [series, theme, test]
categories: [essay]
description: Part two — theme presets, dark mode, golden-ratio typography and icon details.
featuredImage: /media/test-photo-4.jpg
---

# Site Building Notes (2) · Theme & Typography

Part two of the series. Both "previous / next" links should appear below.

## Theme Presets

The site ships several color presets; switching only rewrites CSS variables, no rebuild needed:

- Light and dark maintain separate palettes;
- Accent, link and shadow colors all come from variables;
- The choice is remembered locally and survives refreshes.

## Three Typography Decisions

1. **Type scale** grows by the golden ratio so heading levels read at a glance;
2. **Measure** stays under 72ch for comfortable reading;
3. **Code vs. prose** use different mono/sans pairings for a clear boundary.

> Typography is not decoration; it is the throttle of reading speed.

## Minimal Theme Toggle

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

![Sample theme photo](/media/test-photo-4.jpg "Check contrast in both light and dark modes")

Previous: [Site Building Notes (1)](/en/series-1/). Next: [Site Building Notes (3)](/en/series-3/).

---
title: 代码块大全
slug: code-showcase
date: 2026-08-02 14:00:00
tags: [js, ts, 代码块, 测试]
categories: [技术]
description: 12 种语言的代码块渲染验收：行号、语言标签、终端提示符、diff 行着色、超长行横向滚动、复制与下载。
featuredImage: /media/test-photo-3.webp
---

# 代码块大全

本文覆盖代码块的全部渲染形态：行号列、语言胶囊、终端提示符前缀（bash/powershell/console）、diff 增删行着色、超长行横向滚动、无语言纯文本块，以及复制/下载按钮。

## JavaScript

```js
const cache = new Map();
export async function loadConfig(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`加载失败: ${res.status}`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}
```

## TypeScript

```ts
interface Article {
  slug: string;
  title: string;
  tags: string[];
  date: Date;
}

function sortByDate(list: Article[]): Article[] {
  return [...list].sort((a, b) => b.date.getTime() - a.date.getTime());
}
```

## Python

```python
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Post:
    slug: str
    words: int

def total_words(posts: list[Post]) -> int:
    return sum(p.words for p in posts)

if __name__ == "__main__":
    print(total_words([Post("a", 120), Post("b", 300)]))
```

## Bash（终端提示符）

```bash
npm run build
node scripts/security-verify.js
rg -n "TODO" articles/ | wc -l
```

## PowerShell（终端提示符）

```powershell
Get-ChildItem articles/zh -Filter *.md | Measure-Object
node .tmp-scripts/run-build.js
```

## JSON5

```json5
// 站点片段示例（允许注释与尾逗号）
{
  site: {
    title: "S-ynapse",
    lang: "zh-CN",
    performance: { imageDecoding: "async", lazyLoad: true },
  },
}
```

## YAML

```yaml
deploy:
  target: cloudflare
  pages:
    prod: https://example.com
  steps:
    - build
    - verify
    - upload
```

## SQL

```sql
SELECT tag, COUNT(*) AS posts
FROM article_tags
WHERE published = 1
GROUP BY tag
ORDER BY posts DESC
LIMIT 10;
```

## Diff（增删行着色）

```diff
- const timeout = 3000;
+ const timeout = 5000;
  function retry(fn, times) {
-   for (let i = 0; i < times; i++) fn();
+   for (let i = 0; i < times; i++) {
+     try { return fn(); } catch (e) { /* 继续重试 */ }
+   }
  }
```

## HTML

```html
<picture>
  <source srcset="/media/test-photo-1.webp" type="image/webp">
  <img src="/media/test-photo-1.jpg" alt="示例图" loading="lazy" decoding="async">
</picture>
```

## CSS

```css
.post-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

## Markdown

```markdown
## 小标题

- **重点**：行内代码 `npm run build`
- [链接](https://example.com)
```

## 超长行（横向滚动）

```js
const veryLongLine = "这是一个非常非常长的字符串，用于验证代码块在超出容器宽度时会提供横向滚动而不是把页面撑破；abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz";
```

## 无语言纯文本

```text
无语言标记的纯文本块也应获得行号，并且不显示语言标签。
第二行：验证行号对齐。
第三行：验证等宽字体。
```

> 复制按钮会把当前块内容写入剪贴板并播放描边动画；下载按钮导出为对应扩展名的文本文件。

更多交互路径见 [欢迎与全站导航](/zh/hello-world/) 与 [图表与数学公式](/zh/diagrams-math/)。

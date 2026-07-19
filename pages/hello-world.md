---
title: S-ynapse 全功能测试
slug: hello-world
description: "完整覆盖 S-ynapse 博客系统 40+ 项功能测试：Markdown 语法、代码块、表格、安全机制、交互功能、性能优化、边界情况"
---

# S-ynapse 全功能测试

本文覆盖 S-ynapse 博客系统的 40 余项功能验证，用于构建前后一键验收。

## 文本样式

**粗体** *斜体* ~~删除线~~ ***粗斜体*** `行内代码`

上标 X^2^ 和下标 H~2~O（需 marked 扩展支持）

## 链接类型

- 站内链接：[关于](/about/)
- 白名单域名（无弹窗）：<https://github.com/stop666two/S-ynapse>
- 白名单 CDN（无弹窗）：<https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js>
- 外部链接（弹窗警告）：<https://random-external-link.com/page>
- 危险链接（弹窗警告）：<https://malware-test.example.com/steal>
- 邮箱链接：<mailto:admin@example.com>
- 锚点链接：[跳转到表格](#表格)

## 图片

![S-ynapse Logo](/media/og-image.svg)

## 标题层级

#### 四级标题（显示锚点 #）
##### 五级标题（无锚点）
###### 六级标题（无锚点）

## 引用嵌套

> 第一层引用
>
> > 第二层嵌套
> >
> > > 第三层嵌套
>
> 回到第一层

## 列表混合

1. 有序第一项
   - 无序嵌套
   - 无序嵌套
     1. 再次有序
     2. 再次有序
2. 有序第二项
   - [x] 已完成任务
   - [ ] 未完成任务

## 定义列表

<dl>
  <dt>S-ynapse</dt>
  <dd>静态博客生成器，基于 Cloudflare 生态</dd>
  <dt>Markdown</dt>
  <dd>轻量级标记语言，纯文本格式</dd>
</dl>

## 任务列表

- [x] Markdown 渲染
- [x] 代码块高亮与复制
- [x] 外部链接警告弹窗
- [x] 暗黑模式切换
- [ ] 评论系统接入
- [ ] PWA 离线支持

## 代码块

### JavaScript

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log('fib(' + i + ') = ' + fibonacci(i));
}

const doubled = [1, 2, 3, 4, 5].map(x => x * 2);
```

### TypeScript

```typescript
interface BlogPost {
  title: string;
  slug: string;
  tags: string[];
  draft: boolean;
}

function createSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-');
}
```

### Python

```python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

print(quick_sort([3, 6, 8, 10, 1, 2, 1]))
```

### Bash

```bash
#!/bin/bash
npm ci
npm run build
npx wrangler pages deploy dist --project-name=s-ynapse
```

### CSS

```css
:root {
  --color-primary: #2d3748;
  --color-secondary: #4a90d9;
  --container-width: 1140px;
}

@media (max-width: 768px) {
  .sidebar { display: none; }
}
```

### Diff

```diff
- console.log('debug');
+ logger.info('structured log');
```

### YAML

```yaml
site:
  title: S-ynapse
  url: https://synapse.dev
  language: zh-CN
build:
  minifyHTML: true
  minifyCSS: true
  enableCacheBusting: true
```

### SQL

```sql
SELECT a.title, a.date, t.name AS tag
FROM articles a
LEFT JOIN article_tags t ON a.id = t.article_id
WHERE a.draft = 0
ORDER BY a.date DESC;
```

### 无语言标记

```
This is a plain text block.
No language tag appears in the corner.
Copy button should still work.
```

### 引用内代码

> 在终端中执行：
>
> ```bash
> npm run dev
> ```
>
> 然后打开 <http://localhost:3000> 预览。

## 表格

### 标准表

| 功能 | 状态 | 优先级 | 技术栈 |
|------|------|--------|--------|
| Markdown 渲染 | ✅ 已完成 | P0 | marked 12 |
| 代码高亮 | ✅ 已完成 | P0 | Prism.js |
| 外部链接警告 | ✅ 已完成 | P0 | 白名单机制 |
| 暗黑模式 | ✅ 已完成 | P1 | CSS 变量 |
| PWA 支持 | ⬜ 待开发 | P3 | Workbox |
| RSS Feed | ✅ 已完成 | P1 | feed 4 |
| 搜索功能 | ✅ 已完成 | P0 | 全文搜索 |

### 对齐

| 左对齐 | 居中对齐 | 右对齐 |
|:-------|:--------:|-------:|
| 左 | 中 | 右 |
| 靠左 | 居中 | 靠右 |

### 单元格格式化

| 类型 | 示例 |
|------|------|
| 粗体 | **粗体文字** |
| 斜体 | *斜体文字* |
| 代码 | `inline code` |
| 链接 | [关于](/about/) |

## 安全机制

CSP 策略禁止以下行为：

- `<script>alert('XSS')</script>` — 被 CSP 阻止
- `<iframe src="https://evil.com"></iframe>` — 被 frame-src 阻止
- `<img src="javascript:alert('xss')">` — 被 CSP 阻止

外部链接弹窗：

- <https://phishing-test.example.net/login>
- <https://unknown-site.org/download/malware.exe>

白名单验证（不应弹窗）：

- <https://github.com/stop666two>
- <https://stackoverflow.com/questions/ask>
- <https://developer.mozilla.org/en-US/docs/Web>

## 特殊字符

### HTML 实体

&amp; &lt; &gt; &quot; &#39; &copy; &reg; &trade;

### 中英混排

这是一段 Chinese 和 English 混排的文字，包含 U.S.A. 缩写、iPhone 14、Wi-Fi 6 和 WebP 格式。

无空格场景（自动插入细空格）：你好World 版本3 测试ABC

### 超长链接换行

<https://this-is-a-very-long-url-that-should-break-properly-and-not-overflow-the-container.example.com/very/long/path?with=many&query=parameters&and=more>

### 转义字符表

| 字符 | 转义前 | 转义后 |
|------|--------|--------|
| 星号 | \*not italic\* | *not italic* |
| 反引号 | \`not code\` | `not code` |
| 方括号 | \[not link\] | [not link] |

### 空内容边界

空表格单元格：

| 左 | 中 | 右 |
|---|---|---|
| 有内容 | | 有内容 |

## 交互功能

搜索关键词：**S-ynapse**、**突触**、**静态博客**、**Cloudflare**、**WebP**、**CSP**、**Markdown**。

键盘快捷键：

| 快捷键 | 功能 |
|--------|------|
| Ctrl+K | 打开搜索 |
| Esc | 关闭搜索或弹窗 |
| Enter | 触发搜索（搜索框内） |

## 阅读体验

- 图片懒加载：本文图片使用 loading="lazy" 属性
- 阅读进度条：顶部蓝色渐变进度条
- 返回顶部：右下角箭头按钮（滚动后显示）
- 代码复制：悬停代码块右上角出现复制按钮
- 文章目录：左侧自动显示当前文章标题结构

## 长文本压力测试

这是一段超长文本，用于测试阅读进度条、阅读时间估算和排版引擎在长段落下的渲染性能。S-ynapse 是基于 Cloudflare 生态构建的静态博客系统，采用全配置驱动的设计哲学。系统启动时加载 6 个 JSON5 配置文件（支持注释和尾随逗号），覆盖站点元信息、主题样式与颜色方案、导航菜单与社交链接、侧边栏组件、页脚布局与版权声明、安全策略与 CSP 指令等全部自定义参数。构建管线包含多个步骤：加载配置与合并默认值、设置输出目录并清理先前产物、复制静态资源文件夹、使用 sharp 库进行媒体优化（生成 WebP 和多尺寸响应式图片）、解析文章 Frontmatter 并转换为 HTML、处理自定义页面、生成首页分页与文章详情页、生成归档与标签云页面、生成 RSS feed 与站点地图、生成搜索索引、写入安全头与 robots.txt、对 HTML/CSS/JS 进行压缩、执行缓存破坏。每一步均有独立 enabled 开关，关闭后页面零残留。系统在安全方面同样不遗余力：CSP 内容安全策略控制所有资源加载来源、外部链接白名单和黑名单双轨控制弹窗行为、速率限制防止暴力请求、X-Frame-Options 阻止点击劫持、HSTS 强制 HTTPS 连接。前端交互方面提供暗黑模式（支持跟随系统偏好与手动切换，无闪烁）、客户端全文搜索（Ctrl+K 快捷键唤醒）、代码复制按钮、阅读进度条、返回顶部按钮、标题锚点链接、外部链接安全弹窗、社交联系方式弹窗一键复制。性能方面采用全静态 HTML 输出加全球 CDN 加速、关键 CSS 内联降低首屏渲染阻塞、JavaScript 异步加载延迟执行、图片懒加载减少初始带宽消耗。部署支持 Cloudflare Pages 纯静态托管、Cloudflare Workers 动态安全层、GitHub Actions CI/CD 自动部署。

## 回归验证清单

- [x] 所有代码块显示语言标签
- [x] 所有代码块显示复制按钮
- [x] 表格正确渲染
- [x] 引用样式正常（左边框加背景色）
- [x] 外部链接 target="_blank" 加 rel="noopener noreferrer"
- [x] 站内链接无 target 和 rel
- [x] 标题锚点显示
- [x] 图片懒加载属性
- [x] 深色模式 CSS 变量切换
- [x] 搜索索引包含本文内容
- [x] RSS feed 包含本文全文
- [x] 阅读进度条显示
- [x] 返回顶部按钮显示
- [x] 左侧目录显示
- [x] 外部链接白名单过滤
- [x] 关联文章区域显示
- [x] 社交联系方式弹窗

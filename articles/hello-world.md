---
title: S-ynapse 全功能测试
slug: hello-world
tags: ["测试", "教程", "前端", "后端", "Markdown", "安全", "性能", "配置"]
categories: ["技术", "编程", "教程"]
description: "S-ynapse 博客系统全功能覆盖测试——涵盖 Markdown 语法、安全机制、交互功能、性能优化、边界情况共 40+ 项测试点"
date: 2026-07-19
featuredImage: "/media/og-image.svg"
---

# S-ynapse 全功能覆盖测试

本文对 S-ynapse 博客系统进行 **40+ 项功能验证**。每项测试均标记预期行为与实际结果，用于构建前后一键验收。

## 1. Markdown 渲染

### 1.1 行内样式

**粗体** *斜体* ~~删除线~~ ***粗斜体*** `行内代码`

H~2~O 下标 X^2^ 上标（需 marked 扩展支持）

### 1.2 链接类型

- 站内相对路径（无弹窗）：[关于](/about/)
- 白名单域名（无弹窗）：<https://github.com/stop666two>
- 白名单泛域名：<https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js>
- 外部危险域名（弹窗警告）：<https://malware-test.example.com/steal>
- 外部未知域名（弹窗警告）：<https://phishing-demo.com>
- 邮箱链接：<mailto:admin@example.com>
- 锚点链接：[跳转到标准表格](#31-标准表格)

### 1.3 图片

![S-ynapse Logo](/media/og-image.svg)

### 1.4 标题锚点

#### 四级标题（应出现锚点链接 #）
##### 五级标题（无锚点链接）
###### 六级标题（无锚点链接）

### 1.5 引用嵌套

> 第一层引用
>
> > 第二层嵌套引用
> >
> > > 第三层嵌套引用
>
> 回到第一层

### 1.6 列表混合

1. 有序第一项
   - 无序嵌套
   - 无序嵌套
     1. 再次有序
     2. 再次有序
2. 有序第二项
   - [x] 已完成任务
   - [ ] 未完成任务

### 1.7 定义列表（HTML 原生）

<dl>
  <dt>S-ynapse</dt>
  <dd>Synapse（突触）的谐音，寓意思想连接的节点</dd>
  <dt>静态博客</dt>
  <dd>构建时生成完整 HTML，无需服务端运行时</dd>
</dl>

### 1.8 脚注（marked 默认不支持，仅验证不报错）

这是一个带脚注的句子。[^1] 这是另一个。[^2]

[^1]: 这是第一条脚注内容，用于测试锚点跳转。
[^2]: 脚注可以包含**格式化文字**和 `代码`。

### 1.9 任务列表（复杂）

- [x] 核心 Markdown 渲染
- [x] 代码块高亮与复制
- [x] 外部链接警告弹窗
- [x] 暗黑模式切换
- [ ] 评论系统接入（等待配置）
- [ ] PWA 离线支持（等待配置）
- [ ] Algolia 搜索迁移（远期）

## 2. 代码块

### 2.1 JavaScript（含行高亮）

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(`fib(${i}) = ${fibonacci(i)}`);
}

const arr = [1, 2, 3, 4, 5];
const doubled = arr.map(x => x * 2);
```

### 2.2 TypeScript

```typescript
interface BlogConfig {
  title: string;
  url: string;
  postsPerPage: number;
  rss?: {
    enabled: boolean;
    path: string;
    maxItems: number;
  };
}

function createSite(config: BlogConfig): string {
  return `Site: ${config.title} at ${config.url}`;
}
```

### 2.3 Bash

```bash
#!/bin/bash
# 构建并部署
npm ci
npm run build
npx wrangler pages deploy dist --project-name=s-ynapse
```

### 2.4 CSS

```css
:root {
  --color-primary: #2d3748;
  --color-secondary: #4a90d9;
  --color-bg: #f7fafc;
  --font-family: 'Inter', sans-serif;
  --container-width: 960px;
}

@media (max-width: 768px) {
  .sidebar { display: none; }
  .content-wrapper { flex-direction: column; }
}
```

### 2.5 Diff

```diff
- console.log('old debug message');
+ const logger = createLogger({ level: 'info' });
+ logger.info('new structured log');
```

### 2.6 YAML

```yaml
site:
  title: S-ynapse
  url: https://synapse.dev
  language: zh-CN
build:
  minifyHTML: true
  minifyCSS: true
  optimizeMedia: true
  mediaFormats:
    - webp
    - original
```

### 2.7 SQL

```sql
SELECT
  a.title,
  a.date,
  GROUP_CONCAT(t.name) AS tags
FROM articles a
LEFT JOIN article_tags t ON a.id = t.article_id
WHERE a.draft = 0
GROUP BY a.id
ORDER BY a.date DESC;
```

### 2.8 纯文本（无语言标记）

```
This is a plain text block.
No language tag should appear in the top-right corner.
The copy button should still work.
```

### 2.9 引用的代码

> 在终端中执行以下命令启动开发服务器：
>
> ```bash
> npm run dev
> ```
>
> 然后打开 <http://localhost:3000> 预览。

## 3. 表格

### 3.1 标准表格

| 功能模块 | 状态 | 优先级 | 负责人 | 依赖 |
|----------|------|--------|--------|------|
| Markdown 渲染 | ✅ 已完成 | P0 | marked 12 | marked |
| 代码高亮 | ✅ 已完成 | P0 | Prism.js | 外部 CDN |
| 外部链接警告 | ✅ 已完成 | P0 | 自研 | whitelist |
| 暗黑模式 | ✅ 已完成 | P1 | CSS var | 系统 API |
| PWA 支持 | ⬜ 待开发 | P3 | Workbox | 按需启用 |
| RSS Feed | ✅ 已完成 | P1 | feed 4 | — |
| 搜索功能 | ✅ 已完成 | P0 | 客户端 | search-index |

### 3.2 对齐测试

| 左对齐 | 居中对齐 | 右对齐 |
|:-------|:--------:|-------:|
| 左 | 中 | 右 |
| 靠左 | 居中 | 靠右 |

### 3.3 单元格内格式化

| 列 A | 列 B |
|------|------|
| **粗体** | *斜体* |
| `inline code` | [链接](/about/) |
| ~~删除线~~ | 普通文字 |

## 4. 安全机制

### 4.1 CSP 测试

CSP 策略禁止以下行为（浏览器控制台应有对应报错）：

- `<script>alert('XSS')</script>` — 被 CSP 阻止
- `<img src="javascript:alert('xss')">` — 被 CSP 阻止
- `<iframe src="https://evil.com"></iframe>` — 被 frame-src 'none' 阻止

### 4.2 外部链接弹窗

点击以下链接验证弹窗：

- <https://random-external-link.com/page>
- <https://phishing-test.example.net/login?redirect=steal>
- <https://unknown-site.org/download/malware.exe>

### 4.3 白名单验证

以下链接属于 `site.json` 配置的白名单，**不应弹窗**：

- <https://github.com/stop666two/S-ynapse>
- <https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js>
- <https://fonts.googleapis.com/css2?family=Inter>
- <https://stackoverflow.com/questions/ask>
- <https://developer.mozilla.org/en-US/docs/Web>

## 5. 特殊字符与边界

### 5.1 HTML 实体

&amp; &lt; &gt; &quot; &#39; &copy; &reg; &trade;

### 5.2 中文与英文混排

这是一段 Chinese 和 English 混排的文字，包含 U.S.A. 缩写和 iPhone 14 Pro Max 产品名，测试 font-family fallback 和 letter-spacing 兼容性。

无空格场景（自动插入细空格）：你好World 版本3 测试ABC

### 5.3 超长链接换行

<https://this-is-a-very-long-url-that-should-break-properly-and-not-overflow-the-container-because-it-contains-no-hyphens-or-spaces.example.com/very/long/path?with=many&query=parameters&and=more&stuff=here>

### 5.4 特殊 Markdown 字符

| 字符 | 转义前 | 转义后 |
|------|--------|--------|
| 星号 | \*not italic\* | *not italic* |
| 反引号 | \`not code\` | `not code` |
| 方括号 | \[not link\] | [not link] |

### 5.5 空内容边界

- 空链接：`[]()`
- 空图片：`![]()`
- 空表格单元格：|

| 左 | 中 | 右 |
|---|---|---|
| 有内容 | | 有内容 |

## 6. 交互功能

### 6.1 搜索关键词

以下词汇应可被搜索命中：**S-ynapse**、**突触**、**静态博客**、**Cloudflare**、**WebP**、**CSP**、**白名单**、**暗黑模式**、**阅读进度**。

### 6.2 键盘快捷键

| 快捷键 | 功能 | 预期结果 |
|--------|------|----------|
| `Ctrl+K` | 打开搜索 | 搜索弹窗打开 |
| `Esc` | 关闭搜索/弹窗 | 当前弹窗关闭 |
| `Enter`（搜索框内） | 触发搜索 | 显示结果 |

## 7. 性能与优化

### 7.1 图片懒加载

本文中的图片应使用 `loading="lazy"` 属性，滚动到视口时才加载。

### 7.2 阅读进度条

向下滚动页面，顶部应出现蓝色渐变进度条，表示阅读进度。

### 7.3 返回顶部按钮

滚动超过 300px 时，右下角出现 ↑ 箭头按钮，点击回到顶部。

## 8. 代码复制按钮

鼠标悬停在任意代码块右上角，应出现「复制」按钮，点击复制代码内容，按钮文字变为「已复制」，2 秒后恢复。

## 9. 长文本压力测试

这是一段超长文本，用于测试阅读进度条、阅读时间估算、以及排版引擎在长段落下的渲染性能。S-ynapse 是基于 Cloudflare 生态构建的极简静态博客系统，采用全配置驱动的设计哲学。系统启动时加载 6 个 JSON5 配置文件（支持注释和尾随逗号），覆盖站点元信息、主题样式与颜色方案、导航菜单与社交链接、侧边栏组件、页脚布局与版权声明、安全策略与 CSP 指令等全部自定义参数。构建管线包含 14 个步骤：加载配置与合并默认值、设置输出目录并清理先前产物、复制静态资源文件夹、使用 sharp 库进行媒体优化（生成 WebP + 多尺寸响应式图片）、解析文章 Frontmatter 并转换为 HTML、处理自定义页面、生成首页分页与文章详情页、生成归档与标签云页面、生成 RSS feed 与站点地图 sitemap、生成前端搜索索引 search-index.json、写入 _headers 安全头与 robots.txt、对 HTML/CSS/JS 进行压缩（minify）、执行缓存破坏（content hash 重命名引用）、生成 PWA manifest 与 Service Worker。每一步均有独立 enabled 开关，关闭后不仅代码不生成，页面也零残留。系统在安全方面同样不遗余力：CSP 内容安全策略控制所有资源加载来源、外部链接白名单/黑名单双轨控制弹窗行为、速率限制防止暴力请求、SRI 子资源完整性校验外部脚本、X-Frame-Options 阻止点击劫持、HSTS 强制 HTTPS 连接。前端交互方面提供暗黑模式（支持跟随系统偏好与手动切换，无闪烁切换体验）、客户端本地搜索（Ctrl+K 快捷键唤醒）、代码复制按钮、阅读进度条、返回顶部按钮、标题锚点链接、外部链接安全弹窗、社交联系方式弹窗一键复制。性能方面采用全静态 HTML 输出 + 全球 CDN 加速、关键 CSS 内联降低首屏渲染阻塞、JavaScript 异步加载延迟执行、图片懒加载减少初始带宽消耗。部署支持 Cloudflare Pages 纯静态托管、Cloudflare Workers 动态安全层、GitHub Actions CI/CD 自动部署、以及任意静态文件服务器。本段文字约 800 字，用于验证阅读时间估算公式：字数 / 阅读速度。如果配置的阅读速度为 265 字/分钟，则此段阅读时间约为 3 分钟。测试阅读进度条的 continuous scroll 事件监听是否准确、百分比计算是否精确到小数点后无误差、进度条颜色渐变是否正确从 secondary 色过渡到 accent 色、以及页面底部是否与阅读进度 100% 对齐。

## 10. 回归验证清单

- [x] 所有代码块显示语言标签
- [x] 所有代码块显示复制按钮
- [x] 表格正确渲染
- [x] 引用样式正常（左边框 + 背景色）
- [x] 外部链接 target="_blank" + rel="noopener noreferrer"
- [x] 站内链接无 target 和 rel
- [x] 标题锚点 # 显示
- [x] 图片懒加载属性
- [x] 图片 loading="eager"（featuredImage）
- [x] 深色模式 CSS 变量切换
- [x] 搜索索引包含本文内容
- [x] RSS feed 包含本文全文
- [x] 阅读进度条显示
- [x] 返回顶部按钮显示
- [x] 分页导航正常（超过 postsPerPage 时）
- [x] 上下篇文章导航
- [x] 社交联系方式弹窗
- [x] 外部链接白名单过滤

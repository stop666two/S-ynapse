---
title: S-ynapse 功能测试文章
slug: hello-world
tags: ["技术", "教程", "前端", "后端", "运维", "生活"]
categories: ["编程", "技术"]
description: "这是一篇用于测试 S-ynapse 博客系统所有功能的文章，包含代码块、表格、引用、外部链接、图片等"
date: 2026-07-13
featuredImage: "/media/og-image.svg"
---

# S-ynapse 功能测试文章

本文用于测试 S-ynapse 博客系统的全部功能。

## 文本样式

**粗体文字** *斜体文字* ~~删除线文字~~ `行内代码`

## 外部链接测试

点击以下链接测试安全警告功能：

- **白名单链接（不会弹窗）**：<https://github.com/yourname>
- **外部链接（会弹警告）**：<https://evil-phishing-site.com/login>
- **另一个外部链接**：<https://unknown-example.com/download>
- **本站链接（不会弹窗）**：</getting-started/>

## 代码块

### JavaScript

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Generate first 10 Fibonacci numbers
for (let i = 0; i < 10; i++) {
  console.log(`fib(${i}) = ${fibonacci(i)}`);
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

### HTML

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Hello World</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>
```

### 无语言标记的普通代码块

```
This is a plain code block without language specification.
It should still render properly with the copy button.
```

## 表格

| 功能 | 状态 | 优先级 | 备注 |
|------|------|--------|------|
| Markdown 渲染 | ✅ 已完成 | 高 | marked 12 |
| 代码高亮 | ✅ 已完成 | 高 | Prism.js |
| 外部链接警告 | ✅ 已完成 | 高 | 白名单/黑名单 |
| 暗黑模式 | ✅ 已完成 | 中 | system/手动 |
| PWA 支持 | ⬜ 待开发 | 低 | 按需启用 |
| RSS Feed | ✅ 已完成 | 中 | 全文输出 |
| 搜索功能 | ✅ 已完成 | 高 | 客户端搜索 |

## 引用

> 这是一段普通的引用文字。
> 它可以跨越多行显示。
>
> 引用内部也可以包含 **格式化** 文字。

> 安全提示：不要点击来路不明的链接，谨防钓鱼诈骗。

## 列表

### 有序列表

1. 安装依赖：`npm install`
2. 构建站点：`npm run build`
3. 启动服务器：`npm run serve`
4. 打开浏览器访问 `http://localhost:3000`

### 无序列表

- 极简设计
- 全配置驱动
- 高性能静态输出
- 安全加固
  - CSP 内容安全策略
  - SRI 子资源完整性
  - HTTP 安全响应头

### 任务列表

- [x] 项目初始化
- [x] 构建脚本开发
- [x] 模板系统
- [x] 配置文件
- [x] 示例文章
- [ ] 评论系统配置
- [ ] PWA 启用

## 图片

![S-ynapse Logo](/media/og-image.svg)

## 分割线

---

## 嵌套内容

### 引用内的代码块

> 在终端中运行以下命令：
>
> ```bash
> npm run build
> ```
>
> 然后查看 `dist/` 目录。

### 列表内的代码

配置文件中设置站点信息：

```json
{
  "title": "S-ynapse",
  "description": "个人技术博客"
}
```

## 键盘标记

按 <kbd>Ctrl</kbd> + <kbd>K</kbd> 打开搜索。

按 <kbd>Esc</kbd> 关闭搜索或弹窗。

## 长文本测试

这是一段很长的文本，用于测试博客系统的排版和阅读体验。S-ynapse 是一个基于 Cloudflare 生态的极简、安全、高性能的静态博客系统。它采用全配置驱动的设计理念，所有功能都通过 JSON 配置文件进行管理。每个可选功能都设有独立的 enabled 开关，关闭后不仅不会生成相关代码，页面也不会显示任何与该功能有关的内容，实现了真正的按需定制。系统在构建时自动生成静态 HTML，并对媒体资源进行优化拆分，生成 WebP 格式和多尺寸响应式图片。站点配置通过 6 个 JSON 配置文件集中管理，提供极为强大的自定义功能，涵盖站点元信息、主题样式、导航、侧边栏、页脚、安全策略、构建行为、SEO、社交集成、性能调优等上百项参数。

## 多级标题测试

### 三级标题

这是三级标题下的内容。

#### 四级标题

这是四级标题下的内容。鼠标悬停在本标题左侧可以看到锚点链接。

##### 五级标题

五级标题没有锚点链接功能。

## 完整工作流

本文展示了 S-ynapse 的大部分核心功能：

1. **内容渲染** — Markdown 转 HTML（代码块、表格、引用、列表）
2. **安全功能** — 外部链接警告弹窗、CSP 安全头
3. **交互功能** — 暗黑模式切换、搜索（Ctrl+K）、代码复制按钮
4. **阅读体验** — 阅读进度条、返回顶部按钮、标题锚点链接
5. **性能优化** — 图片懒加载、响应式图片、CSS/JS 压缩

点击本文中的外部链接即可触发安全警告弹窗，体验完整的拦截流程。

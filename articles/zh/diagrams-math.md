---
title: 图表与数学公式
slug: diagrams-math
date: 2026-08-18 10:30:00
tags: [Mermaid, KaTeX, 测试]
categories: [技术]
description: Mermaid 五种图表（流程图/时序图/状态图/甘特图/饼图）与 KaTeX 行内、块级、括号定界公式的渲染验收。
featuredImage: /media/test-photo-2.png
---

# 图表与数学公式

本文验证 **Mermaid 图表**与 **KaTeX 公式**在明暗两种主题下的渲染与重绘。切换右上角主题按钮，图表应自动以对应配色重绘。

## 流程图

```mermaid
flowchart TD
    A[Markdown 源文件] --> B{是否含 mermaid}
    B -- 是 --> C[加载 mermaid.min.js]
    B -- 否 --> D[跳过图表渲染]
    C --> E[客户端渲染 SVG]
    E --> F[监听主题切换]
    F --> G[重新渲染配图]
    D --> H[输出静态页面]
    G --> H
```

## 时序图

```mermaid
sequenceDiagram
    participant U as 访客
    participant P as 页面脚本
    participant S as 本地搜索索引
    U->>P: 按下 Ctrl+K
    P->>S: 读取 search-index.json
    S-->>P: 返回候选列表
    P-->>U: 弹出搜索面板
    U->>P: 输入关键词
    P-->>U: 实时高亮匹配结果
```

## 状态图

```mermaid
stateDiagram-v2
    [*] --> 亮色
    亮色 --> 暗色: 点击主题按钮
    暗色 --> 亮色: 点击主题按钮
    亮色 --> 跟随系统: 定时策略
    跟随系统 --> 暗色: 日落后
    暗色 --> 跟随系统: 日出后
```

## 甘特图

```mermaid
gantt
    title 测试文章编写排期
    dateFormat  YYYY-MM-DD
    section 内容
    入口与导航        :done,    a1, 2026-06-10, 5d
    图表与公式        :done,    a2, 2026-06-15, 4d
    代码块大全        :active,  a3, 2026-06-19, 6d
    长文压力测试      :          a4, 2026-06-25, 8d
    section 验收
    明暗主题校验      :          a5, 2026-07-03, 3d
    移动端验收        :          a6, after a5, 2d
```

## 饼图

```mermaid
pie title 文章标签占比（示例）
    "测试" : 42
    "技术" : 28
    "Mermaid" : 18
    "其他" : 12
```

## 行内公式

质能方程 $E = mc^2$；欧拉恒等式 $e^{i\pi} + 1 = 0$；一元二次求根公式 $x_{1,2} = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$。括号定界写法同样有效：\(a^2 + b^2 = c^2\)。

## 块级公式

$$
\frac{\partial}{\partial t} \Psi = \frac{i\hbar}{2m} \nabla^2 \Psi
$$

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}, \qquad \lim_{x \to 0} \frac{\sin x}{x} = 1
$$

方括号定界：

\[
f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\, e^{2\pi i \xi x} \, d\xi
\]

## 组合矩阵

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
\begin{pmatrix} x \\ y \end{pmatrix}
=
\begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}
$$

公式与图表的联调说明见 [欢迎与全站导航](/zh/hello-world/)；代码渲染见 [代码块大全](/zh/code-showcase/)。

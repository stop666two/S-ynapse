---
title: KaTeX 数学公式测试
slug: math-katex
date: 2026-08-21 09:30:00
tags: [JavaScript, 测试]
categories: [技术]
---

# KaTeX 数学公式测试

这篇文章用于验证 KaTeX 数学公式渲染：行内公式与块级公式两种形式。

## 行内公式

质能方程 $E = mc^2$ 是行内公式的经典例子。欧拉恒等式 $e^{i\pi} + 1 = 0$ 同样常用。

## 块级公式

勾股定理：

$$a^2 + b^2 = c^2$$

正态分布的概率密度函数：

$$f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}$$

欧拉公式（纯数学部分）：

$$
e^{i\theta} = \cos\theta + i\sin\theta
$$

## 定界符说明

本博客的公式渲染支持四组定界符：`$...$`（行内）、`$$...$$`（块级）、`\(...\)`（行内，mathGuard 扩展）与 `\[...\]`（块级）。行内代码与代码块内的 `$` 不会被误渲染；`\$` 转义输出字面美元符。

反斜杠定界符实测：行内 \(E = mc^2\)，块级 \[ \Phi(x) = \frac{1}{\sqrt{2\pi}} \int_{-\infty}^{x} e^{-t^2/2}\,dt \]。

## 矩阵

$$\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}$$

## 不要渲染代码块

以下代码块中的内容不应被渲染为公式：

```javascript
const answer = 42; // $not_math$
```

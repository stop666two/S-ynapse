---
title: KaTeX Math Test
slug: math-katex
date: 2026-08-21 09:30:00
tags: [javascript, test]
categories: [tech]
---

# KaTeX Math Test

This article verifies KaTeX math rendering: inline formulas and block formulas.

## Inline Formulas

The mass–energy equation $E = mc^2$ is a classic example of an inline formula. Euler's identity $e^{i\pi} + 1 = 0$ is also common.

## Block Formulas

The Pythagorean theorem:

$$a^2 + b^2 = c^2$$

The probability density function of the normal distribution:

$$f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}$$

Euler's formula (pure math part):

$$
e^{i\theta} = \cos\theta + i\sin\theta
$$

## Delimiter Notes

The blog's math rendering supports four delimiter pairs: `$...$` (inline), `$$...$$` (block), `\(...\)` (inline, mathGuard extension) and `\[...\]` (block). `$` inside inline code or code blocks will not be wrongly rendered; `\$` escapes to a literal dollar sign.

Backslash delimiters verified: inline \(E = mc^2\), block \[ \Phi(x) = \frac{1}{\sqrt{2\pi}} \int_{-\infty}^{x} e^{-t^2/2}\,dt \].

## Matrix

$$\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}$$

## Code Blocks Are Not Rendered

The following code block must not be rendered as a formula:

```javascript
const answer = 42; // $not_math$
```

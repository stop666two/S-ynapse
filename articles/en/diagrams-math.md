---
title: Diagrams & Math
slug: diagrams-math
date: 2026-08-18 10:30:00
tags: [mermaid, katex, test]
categories: [tech]
description: Rendering acceptance for five Mermaid diagram types (flowchart, sequence, state, gantt, pie) and KaTeX inline/block/delimiter formulas.
featuredImage: /media/test-photo-2.png
---

# Diagrams & Math

This page verifies **Mermaid diagrams** and **KaTeX formulas** in both light and dark themes. Toggle the theme button at top right — diagrams should re-render with matching colors.

## Flowchart

```mermaid
flowchart TD
    A[Markdown source] --> B{Contains mermaid}
    B -- yes --> C[Load mermaid.min.js]
    B -- no --> D[Skip diagram rendering]
    C --> E[Render SVG on the client]
    E --> F[Listen for theme changes]
    F --> G[Re-render with new palette]
    D --> H[Ship static pages]
    G --> H
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as Visitor
    participant P as Page script
    participant S as Local search index
    U->>P: Press Ctrl+K
    P->>S: Read search-index.json
    S-->>P: Return candidates
    P-->>U: Open search panel
    U->>P: Type keywords
    P-->>U: Highlight matches live
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Light
    Light --> Dark: click theme button
    Dark --> Light: click theme button
    Light --> Auto: scheduled policy
    Auto --> Dark: after sunset
    Dark --> Auto: after sunrise
```

## Gantt Chart

```mermaid
gantt
    title Test article schedule
    dateFormat  YYYY-MM-DD
    section Content
    Entrance & nav   :done,    a1, 2026-06-10, 5d
    Diagrams & math  :done,    a2, 2026-06-15, 4d
    Code showcase    :active,  a3, 2026-06-19, 6d
    Long stress test :          a4, 2026-06-25, 8d
    section Review
    Theme checks     :          a5, 2026-07-03, 3d
    Mobile checks    :          a6, after a5, 2d
```

## Pie Chart

```mermaid
pie title Sample tag distribution
    "test" : 42
    "tech" : 28
    "mermaid" : 18
    "other" : 12
```

## Inline Formulas

Mass–energy $E = mc^2$; Euler's identity $e^{i\pi} + 1 = 0$; the quadratic formula $x_{1,2} = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$. Delimiter form works too: \(a^2 + b^2 = c^2\).

## Block Formulas

$$
\frac{\partial}{\partial t} \Psi = \frac{i\hbar}{2m} \nabla^2 \Psi
$$

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}, \qquad \lim_{x \to 0} \frac{\sin x}{x} = 1
$$

Bracket delimiter:

\[
f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\, e^{2\pi i \xi x} \, d\xi
\]

## Matrix Composition

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
\begin{pmatrix} x \\ y \end{pmatrix}
=
\begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}
$$

See [Welcome & Site Map](/en/hello-world/) for how these pages interlink, and [Code Blocks Showcase](/en/code-showcase/) for rendering samples.

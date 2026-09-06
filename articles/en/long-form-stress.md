---
title: Long-Form Stress Test & TOC Depth
slug: long-form-stress
tags: ["performance", "test"]
categories: ["tech"]
description: "Extremely long article: deep heading structures, reading progress bar, reading time estimation and long-paragraph rendering stress"
date: 2026-08-02 11:00
---

# Long-Form Stress Test & TOC Depth

This article stress-tests long-form rendering: hundreds of text paragraphs, heading depth beyond four levels, TOC sidebar active tracking, the reading progress bar, and reading-time estimation.

## Section 1: Background

The core value of a static blog is its instant first screen and low maintenance cost. In long-form scenarios, interactions such as the reading progress bar, TOC highlighting, and back-to-top must stay smooth under a large DOM node count. This section's text is used to build up scroll height and trigger the reading progress bar and TOC scroll detection.

A few purely layout-focused paragraphs are added here: typography is a craft of whitespace, rhythm, and information hierarchy. Good typography keeps readers oriented across hundreds of lines. The left TOC highlights the current section as you scroll, the top progress bar shows the remaining reading percentage, and the back-to-top button in the bottom-right corner appears after scrolling a certain distance.

## Section 2: Deeply Nested Chapters

### 2.1 Why nesting happens

Long topics are often split into subsections, and subsections into sub-subsections. This line sits under `2.1`, at heading level 3; its sub-chapters below can reach level 4, testing TOC indentation and anchor scrolling.

### 2.2 TOC boundaries

Level 4 headings are indented deepest in the TOC; if a heading text is too long, the TOC should wrap rather than overflow. Levels 5 and 6 do not appear in the TOC, keeping only the unavailable page-anchor state.

## Section 3: Data Tables & Stats

This paragraph simulates a cluster of tables in a long article. Tables, code blocks, and images together form the long-form stress sources, verifying the render engine's stability under mixed content.

| ID | Type | Chars | Note |
|------|------|--------|------|
| A-01 | Paragraph | 2600 | First paragraph |
| A-02 | TOC axis | 1200 | First screen |
| B-01 | Table | 800 | Mixed |
| B-02 | Code | 1400 | Highlighted |
| C-01 | Blockquote | 600 | Nested |

## Section 4: Code Block Stress

```javascript
// 长文压测:生成一万次随机数并聚合统计,确保代码块高亮与复制按钮在长文场景可用
const samples = [];
for (let i = 0; i < 10000; i++) samples.push(Math.random() * 100);
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
console.log('mean =', mean.toFixed(2));
```

```sql
SELECT category, COUNT(*) AS n
FROM posts
GROUP BY category
HAVING COUNT(*) > 3
ORDER BY n DESC;
```

## Section 5: Long Paragraph Filling

To trigger visible changes in the reading progress bar, several medium-length paragraphs are added here. The content revolves around the long-form reading experience: reading is not linear; readers jump between sections; the TOC and anchors are designed for exactly this non-linear reading. The back-to-top button in the bottom-right corner is hidden at the top and fades in after scrolling past 300 pixels; combined with the reading mode button, the sidebar can be hidden so content fills the main column.

Keep filling paragraphs. Keep filling paragraphs. Keep filling paragraphs. Reading time is estimated at an average of XX words per minute; since the estimate only counts text — not code blocks or tables — it is a bit optimistic for technical articles.

## Section 6: Conclusion & Regression Checklist

Acceptance criteria for the long-form stress test:

- [x] TOC generated correctly with scroll highlighting
- [x] Reading progress bar updates on scroll
- [x] Back-to-top button works
- [x] Code block highlighting and copy stay smooth
- [x] Pagination and archive unaffected

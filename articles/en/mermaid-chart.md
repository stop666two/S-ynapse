---
title: Mermaid Flowchart Test
slug: mermaid-chart
date: 2026-08-22 10:00:00
tags: [javascript, test]
categories: [tech]
---

# Mermaid Flowchart Test

This article verifies the on-demand loading and rendering of Mermaid charts.

## Flowchart

```mermaid
flowchart TD
    A[开始] --> B{是否有效}
    B -- 是 --> C[处理]
    B -- 否 --> D[报错]
    C --> E[结束]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as 用户
    participant S as 服务
    U->>S: 请求数据
    S-->>U: 返回响应
```

## Traditional Code Blocks Unaffected

```javascript
function add(a, b) {
  return a + b;
}
```

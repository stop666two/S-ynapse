---
title: Mermaid 流程图测试
slug: mermaid-chart
date: 2026-08-22 10:00:00
tags: [JavaScript, 测试]
categories: [技术]
---

# Mermaid 流程图测试

这篇文章验证 Mermaid 图表的按需加载与渲染。

## 流程图

```mermaid
flowchart TD
    A[开始] --> B{是否有效}
    B -- 是 --> C[处理]
    B -- 否 --> D[报错]
    C --> E[结束]
```

## 时序图

```mermaid
sequenceDiagram
    participant U as 用户
    participant S as 服务
    U->>S: 请求数据
    S-->>U: 返回响应
```

## 传统代码块不受影响

```javascript
function add(a, b) {
  return a + b;
}
```

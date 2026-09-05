---
title: 空元数据文章
slug: no-metadata-check
date: 2026-07-25 08:30
---

# 空元数据文章

这篇文章刻意不写 tags、categories、description 字段,验证缺省逻辑:标题取文件名、摘要自动生成、标签分类为空列表时各页面不报错。

## 缺省行为

- tags 为空数组 → 标签云、详情页标签区不显示
- categories 为空数组 → 分类页不出现此条目
- description 缺省 → 使用站点描述
- 链接锚点、上一篇下一篇仍然正常

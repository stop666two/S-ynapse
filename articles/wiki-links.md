---
title: 双链与 wiki 链接测试
slug: wiki-links
date: 2026-08-23 11:00:00
tags: [JavaScript, 测试]
categories: [技术]
---

# 双链与 wiki 链接测试

这篇文章验证 `[[双链语法]]` 的解析行为，包括站内文章互相引用、按 slug 引用、外链与未知目标。

## 站内文章引用

链接到已发布的文章标题：[[hello-world]] 应该转为 hello-world 的文章链接。按标题大小写不敏感：[[HELLO-WORLD]] 同样命中。

## 按 slug 引用

站内 slug 同样可引用：[[static-site-architecture]] 指向同 slug 的文章。

## 自定义显示文本

可以自定义显示文本：[[hello-world|这条链接显示自定义文字]]。

## 外部链接

外部 URL 匿名链接：[[https://developer.mozilla.org/|MDN]] 与 [[https://developer.mozilla.org/]] 应生成为外部链接。

## 未知目标

不存在的目标：[[不存在的文章标题]] 回退为纯文本，不产生链接，也不会报错。

## 反向引用说明

当前版本只做单向前向链接，标题与 slug 映射在构建时扫描全部文章后预生成。

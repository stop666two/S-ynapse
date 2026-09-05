---
title: 链接与社交组件测试
slug: links-and-social
tags: ["链接", "导航"]
categories: ["教程", "随笔"]
description: "外部链接白名单、危险协议过滤、锚点与社交链接弹窗的综合验证"
date: 2026-04-10 15:00
---

# 链接与社交组件测试

验证外链安全提示、协议过滤与锚点导航的完整链路。

## GitHub 白名单链接

[项目仓库](https://github.com/stop666two/S-ynapse) —— 白名单命中,点击直接跳转。

[分支列表](https://github.com/stop666two/S-ynapse/branches) —— 子路径同样命中。

## 危险协议过滤

下方链接在构建时若含 `javascript:` 或 `data:` 协议,应被渲染器剥离为纯文本:

[javascript 测试](javascript:alert(1))

[data URI 测试](data:text/html;base64,PGh0bWw+)

## 锚点与站内导航

- [站点说明](/pages/about/)
- [回到文章头部](#本地图片管线测试) —— 站内锚点不应触发外链弹窗
- [mailto 链接](mailto:test@example.com) —— 邮件客户端,不应触发浏览器弹窗

## 关联文章推荐

与本文共享 `教程`/`随笔` 标签的文章应出现在推荐位。

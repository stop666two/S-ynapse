---
title: 建站手记（三）· 发布与自动化
slug: series-3
date: 2026-07-19 08:00:00
series: 建站手记
tags: [系列, 部署, 测试]
categories: [随笔]
description: 系列终篇：构建校验、安全回归、发布清单与回滚预案。
featuredImage: /media/test-photo-5-large.jpg
---

# 建站手记（三）· 发布与自动化

系列最后一篇。文末系列面板应显示「共 3 篇 · 当前第 3 篇」并只提供「上一集」入口。

## 发布前必跑的三件事

- [x] `npm run build` 零错误、零警告
- [x] `npm test` 全部通过
- [x] `node scripts/security-verify.js` 通过

## 用脚本串起来

```bash
node scripts/build.js
npm test
node scripts/security-verify.js
```

## 回滚预案

| 场景 | 动作 | 恢复时间 |
| --- | --- | --- |
| 内容错误 | `git revert` 对应提交 | < 5 分钟 |
| 主题异常 | 切回预设或禁用功能开关 | < 2 分钟 |
| 部署故障 | 重发上一版本构建产物 | < 10 分钟 |

> 发布不是终点，能回滚的发布才是。

![发布检查清单配图](/media/test-photo-5-large.jpg "大图用于检验媒体管线与懒加载")

上一集：[建站手记（二）](/zh/series-2/)。回到入口：[欢迎与全站导航](/zh/hello-world/)。

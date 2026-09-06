---
title: Links & Social Components Test
slug: links-and-social
tags: ["link", "navigation"]
categories: ["tutorial", "essay"]
description: "Comprehensive verification of external link whitelisting, dangerous protocol filtering, anchors and social link popups"
date: 2026-04-10 15:00
---

# Links & Social Components Test

Verifies the complete chain of external link security prompts, protocol filtering, and anchor navigation.

## GitHub Whitelisted Links

[Project repository](https://github.com/stop666two/S-ynapse) — whitelist hit, clicking navigates directly.

[Branch list](https://github.com/stop666two/S-ynapse/branches) — sub-paths also hit.

## Dangerous Protocol Filtering

The links below, if they contain a `javascript:` or `data:` protocol at build time, should be stripped by the renderer to plain text:

[javascript test](javascript:alert(1))

[data URI test](data:text/html;base64,PGh0bWw+)

## Anchors & In-site Navigation

- [Site description](/pages/about/)
- [Back to article top](#本地图片管线测试) — in-site anchors should not trigger the external link popup
- [mailto link](mailto:test@example.com) — mail client, should not trigger a browser popup

## Related Article Recommendations

Articles sharing the `tutorial`/`essay` tags with this article should appear in the recommendation slots.

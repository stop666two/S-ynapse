---
title: Site Building Notes (3) · Publishing & Automation
slug: series-3
date: 2026-07-19 08:00:00
series: Site Building Notes
tags: [series, deploy, test]
categories: [essay]
description: Final part — build checks, security regression, release checklist and rollback plan.
featuredImage: /media/test-photo-5-large.jpg
---

# Site Building Notes (3) · Publishing & Automation

The final part of the series. The series panel below should show "3 parts · current part 3" and only offer a "previous" link.

## Three Things To Run Before Shipping

- [x] `npm run build` with zero errors and warnings
- [x] `npm test` all green
- [x] `node scripts/security-verify.js` passing

## Chain Them With a Script

```bash
node scripts/build.js
npm test
node scripts/security-verify.js
```

## Rollback Plan

| Scenario | Action | Recovery time |
| --- | --- | --- |
| Content mistake | `git revert` the commit | < 5 min |
| Theme regression | fall back to a preset or flip a feature flag | < 2 min |
| Deploy failure | re-publish the previous build | < 10 min |

> Shipping is not the goal; a shippable release you can roll back is.

![Release checklist illustration](/media/test-photo-5-large.jpg "Large image for checking the media pipeline and lazy loading")

Previous: [Site Building Notes (2)](/en/series-2/). Back to the hub: [Welcome & Site Map](/en/hello-world/).

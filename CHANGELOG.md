# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- 修复 Markdown 内嵌原始 HTML 的存储型 XSS：新增 `sanitizeHtml` 白名单净化，`script/iframe/object/embed/svg/math/form` 等活动内容整块移除，`on*` 事件属性与 `style` 属性一律剥离，`javascript:`/`data:` URI 过滤，仅保留安全标签（含 `<dl>` 定义列表等既有内容所需标签）— `scripts/lib/utils.js`
- 修复搜索索引写入内联脚本的注入：`searchData` 序列化时转义 `<`（`escapeJsonForScript`），杜绝 `</script>` 标签逃逸 — `scripts/build.js`
- 修复 structuredData (ld+json) 标题/描述拼接注入：改为 JSON 结构化序列化并转义 `<` — `templates/layout.ejs`
- 修复社交联系方式弹窗 `onclick` 属性中的 JS 字符串注入：改为 `data-*` 属性 + 事件委托 — `templates/layout.ejs`
- 修复搜索结果为 `innerHTML` 注入：改为 DOM API 构建（`textContent`） — `templates/layout.ejs`
- 修复本地预览服务器路径遍历：`--serve` 下通过 `path.resolve` + 前缀校验隔离 `dist/` 目录 — `scripts/build.js`
- 清理 CSP 遗留示例域：移除 `connect-src` 中的 `https://api.example.com` — `security.json`

### Changed
- HTML 压缩器从 `html-minifier` 4.0.0（已停止维护，存在 REDoS）替换为 `@minify-html/node` 0.18.1
- `sharp` 0.33.5 → 0.35.4（修复 libvips CVE-2026-33327/33328/35590/35591）
- `wrangler` 4.112.0 → 4.129.0（devDependency）
- 新增 `engines.node: >=20.9.0` 声明（sharp 0.35 硬性要求）
- CI 构建节点 Node 20 → 24 LTS；新增主分支 `npm audit --audit-level=high` 门禁与 `npm test`
- 新增 `npm run verify:security` 集成安全回归脚本（注入恶意文章真实构建验证 dist 输出）

### Added
- 新增 `scripts/security-verify.js` 集成安全验证
- 新增 `sanitizeHtml` / `escapeJsonForScript` 单元测试（`scripts/build.test.js`）
- 新增 CHANGELOG.md
- 新增全套构建测试资产：10 篇覆盖性文章（草稿/纯英文/长文/空元数据/多分类/关联推荐/表格嵌套/链接协议/代码高亮/架构说明）与 5 张程序化生成的本地图片（`scripts/generate-test-media.js` 可再生成）
- 修复本地图片响应式管线：`media-manifest.json` 的键值补全 `/media/` 前缀，`<picture>`/WebP/多尺寸 `srcset` 恢复生效
- 新增 `content-policy.json` 内容策略：`media/`（图片白名单 + SVG 消毒）、`videos/`（视频排除制）、`assets/`（素材白名单）三目录构建期过滤；可执行文件/脚本源码/渲染型文档一律拦截，被拦文件不进入 `dist/`（线上访问 404）并在构建报告中逐条列出 — `scripts/lib/content-policy.js`
- `sanitizeHtml` 放行站内 `<video>`/`<audio>`：媒体 `src` 仅允许站点本地路径（无协议/相对），绝对 URL 与协议相对 URL 被剥离
- 本地预览服务器（`--serve`）：404 回退页现在返回真实 `404` 状态码（此前恒为 200）；扩展 MIME 表覆盖视频/音频/字体/文档类型

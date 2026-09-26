# 增量构建设计方案

> **状态**：页面级最小增量（指纹缓存 + 跳过未变页面 + `--full`）已实现并经隔离夹具验证（见文末「当前实现与验证状态」）。配置与口径见 `docs/config-reference.md` §3.95 与 `scripts/lib/incremental.js`。
> 本文保留远期「步骤级增量」设计（文章解析/聚合页/静态复制的细粒度跳过），当前未实现——页面渲染已是全管线耗时大头，步骤级收益待内容规模到 100+ 篇后评估。
> 当前全量构建约 3-7 秒，对中小站点（< 100 篇文章）性能可接受。

## 目标

Watch 模式下，文件变更时只重建受影响的文件，而非全量重建。

## 当前问题

每次 watch 触发都执行完整的 `build()` 管线（14 步）。对于小站点影响不大，但随内容增多重建时间线性增长：
- 50 篇文章 ≈ 2-3 秒
- 200 篇文章 ≈ 估计 8-12 秒
- 500 篇文章 ≈ 估计 20-30 秒

## 设计方案

### 文件变更类型与对应操作

| 变更文件 | 影响范围 | 重建策略 |
|----------|----------|----------|
| `articles/*.md` | 单篇文章 + 首页 + RSS + Sitemap + 搜索索引 | 只处理该文章，重新生成相关聚合页 |
| `pages/*.md` | 单个自定义页面 + 文章页脚公告栏 | 只处理变更页，重新生成引用它的文章 |
| `templates/*.ejs` | 所有页面 | 重新渲染所有页面（跳过 1-5 步） |
| `static/*` | 复制的静态文件 | 只复制变更文件 |
| `media/*` | 图片优化 | 只优化变更图片 |
| `*.json` (配置) | 全部 | 全量重建 |

### 核心改动

1. **文件哈希缓存** — `dist/.build-cache.json` 记录每个源文件的 mtime + 哈希
2. **增量管线** — `build()` 函数接收 `changedFiles` 参数，跳过未变更步骤
3. **文章增量** — 只重新处理哈希变化的文章，已有文章从缓存读取
4. **聚合页增量** — 当新增/删除文章时，只重新生成首页/归档/标签/分类/RSS/Sitemap
5. **pages 增量** — pages/ 目录内容变更时，只重生成对应的自定义页面和受影响的文章页脚

### 架构调整

```
build(changedFiles) {
  if (!changedFiles || 任何 .json 变更) 执行完整 14 步

  增量模式:
    step 1:   加载配置（缓存），跳过
    step 2-3: 仅处理变更的 static/media
    step 4:   仅处理新增/变更的图片
    step 5:   仅处理新增/变更的文章，其余从缓存加载
    step 6:   仅重生成变更的自定义页面；若文章列表变化则全量重生成
    step 7-14: 若文章/页面列表变化则全量，否则跳过
}
```

### 缓存格式

```json
{
  "files": {
    "articles/hello-world.md": {
      "mtime": 1720000000000,
      "hash": "abc123",
      "output": {
        "slug": "hello-world",
        "url": "/hello-world/"
      }
    },
    "pages/disclaimer.md": {
      "mtime": 1720000000000,
      "hash": "def456",
      "output": {}
    }
  },
  "builtAt": 1720000000000
}
```

### 实现要点

- 文件哈希使用 `crypto.createHash('md5')`（与 cacheBust 函数相同算法）
- `changedFiles` 参数由 chokidar watch 回调传入
- 缓存存储在 `dist/` 中，构建间持久化
- 缓存失效条件：mtime 变更或内容哈希变更

### 未实现原因

- 需要较大重构：当前 `build()` 函数没有模块化步骤追踪，增量逻辑需要将每个步骤拆分为独立函数
- 现有全量构建约 2-3 秒，对当前规模可接受
- 待站点内容增长到 100+ 篇文章时再实现
- `processCustomPages` 和 `generatePages` 紧耦合，拆分增量逻辑需要先解耦

## 关联文件

| 文件 | 作用 |
|------|------|
| `scripts/build.js` | 主构建脚本，增量逻辑需在此实现 |
| `scripts/lib/utils.js` | 工具函数（哈希计算可复用 crypto） |
| `site.json5` | 构建配置（`build.enableCacheBusting` 已提供哈希计算基础设施） |

---

## 当前实现与验证状态（页面级最小增量）

已由隔离夹具 runner 验证（`.tmp-scripts/run-w6.js`，夹具与覆盖文件运行时生成、不入库；端口 3329 全释放）：

| 场景 | 结果 |
|---|---|
| 冷缓存首轮 `--incremental` | skipped=0，rebuilt=33（全量渲染） |
| 无变更次轮 | skipped=33，rebuilt=0；HTML mtime 不变（真正复用而非重写） |
| 改单页 `pages/about.md` | rebuilt=1；仅目标页 mtime 与页面指纹变化，另一语言同 slug 页复用 |
| 改一篇文章 | rebuilt=20 / skipped=13；文章页 mtime 变化，另一语言页面全部跳过（mtime/指纹不变） |
| `--full` | 强制全量并清理 dist，全部页面重写 |

**过程中修复的两个阻塞缺陷**（此前使「跳过」在产物层面被抵消或失效；全量构建产物与修复前逐字节等价）：

1. `scripts/build/minify.js → cacheBust` 非幂等：增量模式不清空 dist 时，已内容寻址文件被重复追加哈希并连锁改写全部 HTML。现按「文件名已带本轮内容哈希」跳过。
2. `scripts/build/pages.js` 曾把完整 `customPages` 注入 `baseData`（无模板消费点），`scripts/build.js` 把完整 `pagesContent` 注入每页数据（实际仅 `post.ejs` 文章页脚按 `articleFooter.source` 取用）。现移除前者、后者仅投影文章页脚单键。

**已知边界（未实现）**：修改一篇文章仍会重建该语言全部页面——文章列表（`langData.articles`）参与每页指纹；进一步按模板数据投影或步骤级增量按本文「设计方案」评估。

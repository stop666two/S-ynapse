// dist/build-report.html 纯渲染函数的单测：区块完整性、关键统计、转义、容错与静态约束。
// 构建产物的唯一人读报告（旧纯文本摘要已并入本报告），区块 id 与标题文本被 build-smoke 复用。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  renderBuildReportHtml,
  formatDuration,
  formatBytes,
  formatReduction,
  PHASE_LABELS
} = require('./lib/build-report-html');

const PHASE_KEYS = [
  'config', 'preflight', 'distStatic', 'media', 'articles', 'pages', 'feeds',
  'og', 'search', 'security', 'assetsPwa', 'compression', 'cacheBust', 'report'
];

function category(overrides) {
  return Object.assign({
    filesBefore: 10,
    filesAfter: 10,
    rawBefore: 100000,
    rawAfter: 90000,
    gzipBefore: 30000,
    gzipAfter: 27000,
    changed: 8,
    added: 0,
    removed: 0,
    skipped: 2,
    exempt: 1
  }, overrides || {});
}

function fullInput() {
  return {
    generatedAt: '2026-09-27T01:00:00.000Z',
    startedAt: '2026-09-27T00:59:45.000Z',
    finishedAt: '2026-09-27T01:00:00.000Z',
    version: '1.2.0',
    commit: 'abc1234',
    nodeVersion: 'v24.9.0',
    totalMs: 12570,
    phases: PHASE_KEYS.map((key, i) => ({ key, ms: (i + 1) * 100 })).concat([{ key: 'other', ms: 5590 }]),
    build: { articles: 42, customPages: 3, tags: 12, categories: 5, outputSize: '12.3 MB', configKeys: 12 },
    policy: { copied: 2, blocked: [{ path: 'assets/secret.txt', reason: '扩展名不在白名单' }] },
    artifacts: {
      html: { pages: 84, rawMaxKb: 120, rawMedianKb: 31, gzipMaxKb: 34, gzipMedianKb: 9.5 },
      css: { files: 120, rawKb: 400, gzipKb: 80 },
      js: {
        groups: [
          { key: 'app', files: 1, rawKb: 150, gzipKb: 55 },
          { key: 'deferred', files: 1, rawKb: 60, gzipKb: 20 },
          { key: 'shared', files: 1, rawKb: 25, gzipKb: 8 },
          { key: 'runtime', files: 1, rawKb: 4, gzipKb: 1.5 }
        ],
        files: 4,
        rawKb: 239,
        gzipKb: 84.5
      },
      vendor: { files: 10, rawKb: 900, gzipKb: 300 },
      fonts: { files: 62, rawKb: 1200 },
      media: { count: 140, top: [{ path: '/media/hero.png', kb: 320 }, { path: '/media/cover.jpg', kb: 210 }] },
      og: { count: 42, top: [{ path: '/og/zh/post.jpg', kb: 90 }] }
    },
    budget: {
      ok: false,
      warnOnly: true,
      items: [
        { key: 'htmlKb', label: 'HTML(单页 gzip 最大)', value: 34, limit: 28, ok: false },
        { key: 'requests', label: '单页静态请求(最大)', value: 9, limit: 12, ok: true }
      ]
    },
    compression: {
      active: true,
      verificationRan: true,
      cssSkips: {
        count: 2,
        details: [
          { file: 'zh/example/index.html', reason: 'HTML 标签配平检查失败（script/style/svg/noscript）' },
          { file: 'assets/css/site.css', reason: 'CSS 大括号未闭合' }
        ]
      },
      enhancements: {
        steps: ['CSS 合并去重', 'JSON 去空白 ×1', 'runtime 压缩 ×1'],
        css: { pages: 80, blocksMerged: 96, rulesCollapsed: 13, declsDropped: 0, cssFiles: 2, bytesSaved: 12345, skipped: 2 },
        jsonCompacted: 1,
        runtime: { files: 1, before: 5000, after: 2000 }
      },
      categories: {
        html: category({ filesAfter: 84, filesBefore: 84, rawBefore: 3300000, rawAfter: 3100000, gzipBefore: 900000, gzipAfter: 830000 }),
        css: category({ rawBefore: 200000, rawAfter: 194000, gzipBefore: 50000, gzipAfter: 49000 }),
        js: category({ rawBefore: 190000, rawAfter: 190000, gzipBefore: 60000, gzipAfter: 60000, changed: 0, skipped: 10 }),
        json: category({ filesBefore: 20, filesAfter: 20, rawBefore: 80000, rawAfter: 70000, gzipBefore: 20000, gzipAfter: 18000, changed: 2, skipped: 18 })
      }
    },
    verify: {
      ran: true,
      report: {
        status: 'passed',
        pages: [{}, {}, {}, {}, {}, {}],
        durationsMs: 7400,
        portsReleased: true,
        checkedAt: '2026-09-27T01:00:10.000Z'
      }
    },
    cacheHits: {
      media: { optimized: 140, reused: 120, failed: 0 },
      og: { made: 10, reused: 32, failed: 0, skippedDrafts: 1 },
      fonts: { downloaded: 3, reused: 59, files: 62 },
      mermaid: { rendered: 8, cached: 5, failed: 0, skipped: '' },
      covers: { made: 4, reused: 9, failed: 0 }
    },
    warnings: [{ stage: 'og', message: '示例告警' }],
    failures: [{ stage: 'feed', message: 'feed 生成失败' }],
    pages: ['zh/index.html', 'zh/about/index.html', 'en/index.html']
  };
}

describe('renderBuildReportHtml 完整渲染', () => {
  it('输出全部区块与元信息', () => {
    const html = renderBuildReportHtml(fullInput());
    for (const id of ['meta', 'phases', 'artifacts', 'budget', 'compression', 'cache', 'warnings', 'failures', 'pages']) {
      assert.ok(html.includes('id="' + id + '"'), 'missing section id: ' + id);
    }
    assert.ok(html.includes('构建报告'));
    assert.ok(html.includes('1.2.0'), 'version must render');
    assert.ok(html.includes('abc1234'), 'commit must render');
    assert.ok(html.includes('v24.9.0'), 'node version must render');
    assert.ok(html.includes('2026-09-27T00:59:45.000Z'), 'startedAt must render');
    assert.ok(html.includes('2026-09-27T01:00:00.000Z'), 'finishedAt must render');
    assert.ok(html.includes('总耗时'));
  });

  it('渲染 14 步阶段耗时 + 其它', () => {
    const html = renderBuildReportHtml(fullInput());
    for (const key of PHASE_KEYS) {
      assert.ok(PHASE_LABELS[key], 'label must exist for ' + key);
      assert.ok(html.includes(PHASE_LABELS[key]), 'missing phase label: ' + PHASE_LABELS[key]);
    }
    assert.ok(html.includes(PHASE_LABELS.other));
    assert.ok(html.includes('14 步'), 'phase section must state the 14-step pipeline');
    assert.ok((html.match(/1\.00s/g) || []).length >= 1, 'durations must be formatted');
  });

  it('渲染产物体积（HTML 页数、分组、Top N）', () => {
    const html = renderBuildReportHtml(fullInput());
    assert.ok(html.includes('HTML 页数'));
    assert.ok(html.includes('84'));
    assert.ok(html.includes('raw 最大'));
    assert.ok(html.includes('gzip 最大 / 中位'));
    for (const label of ['CSS', 'JS', 'app', 'deferred', 'shared', 'runtime', 'vendor', '字体', '媒体图片', 'OG']) {
      assert.ok(html.includes(label), 'missing artifact group: ' + label);
    }
    assert.ok(html.includes('/media/hero.png'));
    assert.ok(html.includes('/og/zh/post.jpg'));
    assert.ok(html.includes('文件 62；raw 1200.0KB</td>'),
      '二进制体积组（字体等）不得把缺失的 gzip 渲染为 0.0KB');
  });

  it('渲染性能预算逐项实测与阈值', () => {
    const html = renderBuildReportHtml(fullInput());
    assert.ok(html.includes('OVER'));
    assert.ok(html.includes('HTML(单页 gzip 最大)'));
    assert.ok(html.includes('34.0KB / 28.0KB'));
    assert.ok(html.includes('OK'));
    assert.ok(html.includes('9 / 12'));
    assert.ok(html.includes('存在超限项'));
  });

  it('渲染压缩统计、规范增强与节省字节', () => {
    const html = renderBuildReportHtml(fullInput());
    assert.ok(html.includes('压缩增强: 启用'));
    assert.ok(html.includes('HTML: 文件 84（变更 8 / 新增 0 / 移除 0）'));
    assert.ok(html.includes('gzip 878.9KB → 810.5KB（节省 7.78%）'));
    assert.ok(html.includes('CSS 合并/去重跳过: 2 项'));
    assert.ok(html.includes('合并 style 块 ×96'));
    assert.ok(html.includes('去重规则 ×13'));
    assert.ok(html.includes('节省 12.1KB'));
    assert.ok(html.includes('JSON 去空白 ×1'));
    assert.ok(html.includes('runtime 压缩 ×1'));
  });

  it('渲染缓存命中（media/og/fonts/mermaid/covers）', () => {
    const html = renderBuildReportHtml(fullInput());
    assert.ok(html.includes('媒体优化 reused 120'));
    assert.ok(html.includes('OG reused 32'));
    assert.ok(html.includes('字体 reused 59'));
    assert.ok(html.includes('mermaid cached 5'));
    assert.ok(html.includes('自动封面 reused 9'));
  });

  it('渲染告警与失败（含阶段）', () => {
    const html = renderBuildReportHtml(fullInput());
    assert.ok(html.includes('[og] 示例告警'));
    assert.ok(html.includes('[feed] feed 生成失败'));
  });

  it('渲染页面清单全部路径', () => {
    const html = renderBuildReportHtml(fullInput());
    assert.ok(html.includes('zh/index.html'));
    assert.ok(html.includes('zh/about/index.html'));
    assert.ok(html.includes('en/index.html'));
    assert.ok(html.includes('页面清单（3）'));
  });

  it('可折叠区块、暗色适配、无外部依赖、无内联脚本', () => {
    const html = renderBuildReportHtml(fullInput());
    assert.ok((html.match(/<details\b/g) || []).length >= 8, 'sections must be collapsible');
    assert.ok(html.includes('prefers-color-scheme: dark'), 'dark mode must be supported');
    assert.ok(!/<script\b/i.test(html), 'report must not carry inline scripts');
    assert.ok(!/<link\b[^>]*href=["']https?:/i.test(html), 'report must not load external styles');
    assert.ok(!/src=["']https?:/i.test(html), 'report must not load external resources');
  });
});

describe('renderBuildReportHtml 转义与容错', () => {
  it('告警文本中的 HTML 被转义，不产生注入', () => {
    const input = fullInput();
    input.warnings = [{ stage: 'x', message: '<script>alert(1)</script> & <img src=x>' }];
    input.pages = ['zh/<evil>/index.html'];
    const html = renderBuildReportHtml(input);
    assert.ok(!/<script\b/i.test(html), 'warning must not inject a script tag');
    assert.ok(html.includes('&lt;script&gt;'), 'warning text must be escaped');
    assert.ok(html.includes('&lt;evil&gt;'), 'page path must be escaped');
  });

  it('无参数调用不抛错且输出全部区块', () => {
    const html = renderBuildReportHtml();
    for (const id of ['meta', 'phases', 'artifacts', 'budget', 'compression', 'cache', 'warnings', 'failures', 'pages']) {
      assert.ok(html.includes('id="' + id + '"'), 'missing section id on empty input: ' + id);
    }
    assert.ok(html.includes('未记录'));
  });

  it('缺失预算/压缩/验证时标注未记录或未运行', () => {
    const html = renderBuildReportHtml({});
    assert.ok(html.includes('perfBudget 未记录'));
    assert.ok(html.includes('压缩增强: 未记录'));
    assert.ok(html.includes('本轮未运行'));
    assert.ok(html.includes('（无）'), 'empty warnings/failures must render explicitly');
  });

  it('输入含自有 __proto__ 键时不污染输出', () => {
    const input = { totalMs: 10 };
    Object.defineProperty(input, '__proto__', {
      value: { version: 'INHERITED' },
      enumerable: true,
      writable: true,
      configurable: true
    });
    const html = renderBuildReportHtml(input);
    assert.ok(html.includes('总耗时'));
    assert.ok(!html.includes('INHERITED'), 'inherited keys must not leak into the report');
  });
});

describe('格式化函数边界', () => {
  it('formatDuration', () => {
    assert.strictEqual(formatDuration(999), '999ms');
    assert.strictEqual(formatDuration(1000), '1.00s');
    assert.strictEqual(formatDuration(NaN), '未记录');
    assert.strictEqual(formatDuration(undefined), '未记录');
  });

  it('formatBytes', () => {
    assert.strictEqual(formatBytes(0), '0 B');
    assert.strictEqual(formatBytes(2048), '2.0KB');
    assert.strictEqual(formatBytes(2 * 1048576), '2.00MB');
    assert.strictEqual(formatBytes(null), '未记录');
  });

  it('formatReduction', () => {
    assert.strictEqual(formatReduction(100, 50), '节省 50.00%');
    assert.strictEqual(formatReduction(100, 150), '增加 50.00%');
    assert.strictEqual(formatReduction(0, 10), '未记录');
    assert.strictEqual(formatReduction(100, 100), '节省 0.00%');
  });
});

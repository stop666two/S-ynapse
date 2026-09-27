// dist/report.txt 纯渲染函数的单测：段渲染、缺失容错、失败/回退/跳过分支与格式化边界。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  renderBuildReportText,
  formatDuration,
  formatBytes,
  formatReduction
} = require('./lib/build-report-text');

const SECTION_MARKERS = ['[阶段耗时]', '[压缩统计]', '[无头验证]', '[告警]', '[预算与目标]'];

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
    totalMs: 12570,
    phases: [
      { key: 'config', ms: 800 },
      { key: 'preflight', ms: 40 },
      { key: 'pages', ms: 2300 },
      { key: 'media', ms: 900 },
      { key: 'og', ms: 1200 },
      { key: 'compression', ms: 1500 },
      { key: 'cacheBust', ms: 120 },
      { key: 'pwa', ms: 30 },
      { key: 'report', ms: 90 },
      { key: 'other', ms: 5590 }
    ],
    compression: {
      active: true,
      verificationRan: true,
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
    warnings: [{ stage: 'og', message: '示例告警' }],
    failures: [],
    budget: {
      ok: false,
      warnOnly: true,
      items: [
        { key: 'htmlKb', label: 'HTML(单页 gzip 最大)', value: 34, limit: 28, ok: false },
        { key: 'requests', label: '单页静态请求(最大)', value: 9, limit: 12, ok: true }
      ]
    }
  };
}

describe('renderBuildReportText 完整渲染', () => {
  it('输出全部固定段标与头部', () => {
    const text = renderBuildReportText(fullInput());
    assert.ok(text.startsWith('S-YNAPSE 构建摘要（report.txt）'), 'must start with the summary header');
    for (const marker of SECTION_MARKERS) assert.ok(text.includes(marker), 'missing section marker: ' + marker);
    assert.ok(text.includes('生成时间(UTC): 2026-09-27T01:00:00.000Z'));
    assert.ok(text.includes('总耗时: 12.57s'));
    assert.ok(text.includes('压缩增强: 启用'));
  });

  it('渲染阶段耗时（标签映射与秒/毫秒格式）', () => {
    const text = renderBuildReportText(fullInput());
    assert.ok(text.includes('配置加载与校验: 800ms'));
    assert.ok(text.includes('页面生成: 2.30s'));
    assert.ok(text.includes('其它构建步骤（打包/索引/头等）: 5.59s'));
  });

  it('渲染四类压缩统计与节省率', () => {
    const text = renderBuildReportText(fullInput());
    assert.ok(text.includes('HTML: 文件 84（变更 8 / 新增 0 / 移除 0）'));
    assert.ok(text.includes('gzip 878.9KB → 810.5KB（节省 7.78%）'));
    assert.ok(text.includes('JS: 文件 10'), 'JS category line must render');
    assert.ok(text.includes('跳过 18；豁免 1'));
    assert.ok(text.includes('失败:（无）'));
  });

  it('压缩目标段标注达标/未达', () => {
    const text = renderBuildReportText(fullInput());
    assert.ok(text.includes('HTML gzip: 节省 7.78%（目标 ≥ 10.00%，未达）'));
    assert.ok(text.includes('JS gzip（混淆关态）: 节省 0.00%（目标 ≥ 20.00%，未达）'));
  });

  it('渲染验证摘要、告警与预算结论', () => {
    const text = renderBuildReportText(fullInput());
    assert.ok(text.includes('状态: 通过；断言页数 6；验证耗时 7.40s；端口释放 正常'));
    assert.ok(text.includes('- [og] 示例告警'));
    assert.ok(text.includes('OVER HTML(单页 gzip 最大): 34.0KB / 28.0KB'));
    assert.ok(text.includes('OK   单页静态请求(最大): 9 / 12'));
    assert.ok(text.includes('结论: 存在超限项（仅提醒）'));
  });
});

describe('renderBuildReportText 缺失容错', () => {
  it('无参数调用不抛错并输出全部段标', () => {
    const text = renderBuildReportText();
    for (const marker of SECTION_MARKERS) assert.ok(text.includes(marker), 'missing section marker: ' + marker);
    assert.ok(text.includes('总耗时: 未记录'));
    assert.ok(text.includes('状态: 本轮未运行'));
    assert.ok(text.includes('（无）'), 'empty warnings must render explicitly');
  });

  it('压缩统计缺失时逐类标注未记录', () => {
    const text = renderBuildReportText({ compression: null });
    for (const label of ['HTML:', 'CSS:', 'JS:', 'JSON:']) assert.ok(text.includes(label + ' 未记录'), label + ' must be marked as not recorded');
  });

  it('预算缺失时标注未记录', () => {
    const text = renderBuildReportText({ budget: null });
    assert.ok(text.includes('perfBudget 门禁: 未记录（未启用或未收集）'));
  });
});

describe('renderBuildReportText 失败与回退分支', () => {
  it('失败+回退成功时渲染回退明细', () => {
    const input = fullInput();
    input.verify = {
      ran: true,
      report: {
        status: 'failed',
        failures: [{ kind: 'dom', page: '/zh/', detail: '结构不一致' }],
        fallback: { applied: true, restored: 110, removed: 3, bytesIdentical: true }
      }
    };
    const text = renderBuildReportText(input);
    assert.ok(text.includes('状态: 失败；失败摘要: dom@/zh/：结构不一致') || text.includes('状态: 失败；失败摘要: dom@/zh/: 结构不一致'));
    assert.ok(text.includes('回退: 已应用（恢复 110 / 移除 3 / 逐字节复核 一致）'));
  });

  it('跳过时渲染原因、回退失败时渲染错误', () => {
    const skipped = renderBuildReportText({ verify: { ran: true, report: { status: 'skipped', reason: 'chrome-not-found' } } });
    assert.ok(skipped.includes('状态: 跳过（chrome-not-found）'));
    const failed = renderBuildReportText({
      verify: { ran: true, report: { status: 'failed', failures: [], fallback: { applied: false, error: '磁盘只读' } } }
    });
    assert.ok(failed.includes('回退: 失败（磁盘只读）'));
  });

  it('压缩阶段失败进入压缩统计，其余阻断失败进入告警段', () => {
    const input = fullInput();
    input.failures = [
      { stage: 'compression', message: 'JSON bad.json: 解析失败' },
      { stage: 'feed', message: 'feed 生成失败' }
    ];
    const text = renderBuildReportText(input);
    const compressionIndex = text.indexOf('[压缩统计]');
    const verifyIndex = text.indexOf('[无头验证]');
    assert.ok(text.indexOf('- [compression] JSON bad.json') > compressionIndex && text.indexOf('- [compression] JSON bad.json') < verifyIndex,
      'compression failure must stay inside the compression section');
    assert.ok(text.includes('- [阻断][feed] feed 生成失败'));
  });

  it('压缩关闭态渲染关闭与未运行', () => {
    const input = fullInput();
    input.compression = { active: false, categories: input.compression.categories };
    input.verify = { ran: false, report: null };
    const text = renderBuildReportText(input);
    assert.ok(text.includes('压缩增强: 关闭'));
    assert.ok(text.includes('状态: 本轮未运行'));
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

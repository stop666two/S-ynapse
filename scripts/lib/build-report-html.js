'use strict';

// dist/build-report.html（唯一构建报告）的纯 HTML 渲染：输入为构建期收集的结构化数据，
// 输出单文件、无外部依赖、无内联脚本的静态页面。本模块不触碰文件系统；
// 所有字段缺失一律按「未记录 / 未运行 /（无）」容错，所有动态文本经 HTML 转义。
// 构建接线见 scripts/build/report.js（写入 dist/build-report.html；位于压缩与 cacheBust
// 之后，天然豁免 compression.exclude）。

const { escapeHtml, copyOwnProperties } = require('./utils');
const { summarizeFailures } = require('./compression-verify');

// 压缩阶段失败若出现在失败清单中，附上阶段标签即可（失败清单独立成块）。
const NOT_RECORDED = '未记录';

// 构建管线 14 步（阶段计时键 → 中文标签）；other 为未单独计时的残差。
const PHASE_LABELS = {
  config: '配置加载与校验',
  preflight: '内容预校验',
  distStatic: '产物初始化与静态资产',
  media: '媒体优化',
  articles: '文章处理与封面/图表',
  pages: '页面生成',
  feeds: '字体/订阅源/站点地图',
  og: 'OG 图生成',
  search: '搜索索引与提交',
  security: '安全文件与重定向',
  assetsPwa: 'JS 资产与 PWA',
  compression: '压缩增强（含无头验证）',
  cacheBust: '缓存指纹（cacheBust）',
  report: '报告生成',
  other: '其它构建步骤'
};

const PHASE_ORDER = [
  'config', 'preflight', 'distStatic', 'media', 'articles', 'pages', 'feeds',
  'og', 'search', 'security', 'assetsPwa', 'compression', 'cacheBust', 'report', 'other'
];

const CATEGORY_LABELS = { html: 'HTML', css: 'CSS', js: 'JS', json: 'JSON' };
const JS_GROUP_LABELS = { app: 'app（应用主包）', deferred: 'deferred（交互懒载）', shared: 'shared（共享 chunk）', runtime: 'runtime（引导脚本）' };

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return NOT_RECORDED;
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return NOT_RECORDED;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(2) + 'MB';
}

function formatKb(kb) {
  if (!Number.isFinite(kb)) return NOT_RECORDED;
  return kb.toFixed(1) + 'KB';
}

// 体积变化：before/after 均为字节数；返回「节省 X%（或 增加 X%）」，before 不可用时返回「未记录」。
function reductionValue(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return null;
  return ((before - after) / before) * 100;
}

function formatReduction(before, after) {
  const pct = reductionValue(before, after);
  if (pct === null) return NOT_RECORDED;
  return pct >= 0 ? '节省 ' + pct.toFixed(2) + '%' : '增加 ' + Math.abs(pct).toFixed(2) + '%';
}

function formatTarget(before, after, targetPct) {
  const pct = reductionValue(before, after);
  if (pct === null) return NOT_RECORDED + '（目标 ≥ ' + targetPct.toFixed(2) + '%）';
  return formatReduction(before, after) + '（目标 ≥ ' + targetPct.toFixed(2) + '%，'
    + (pct >= targetPct ? '达标' : '未达') + '）';
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' ? value : {};
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function numOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return escapeHtml(value === null || value === undefined ? '' : String(value));
}

// 行内 KV 行：<tr><th>标签</th><td>值</td></tr>
function row(label, valueHtml) {
  return '<tr><th>' + text(label) + '</th><td>' + valueHtml + '</td></tr>';
}

function plainRow(label, value) {
  return row(label, text(value));
}

function listSection(items, render) {
  if (!items.length) return '<p class="empty">（无）</p>';
  return '<ul class="list">' + items.map(render).join('') + '</ul>';
}

function renderMeta(data) {
  const build = objectOrEmpty(data.build);
  const rows = [
    plainRow('版本', data.version || NOT_RECORDED),
    plainRow('commit', data.commit || NOT_RECORDED),
    plainRow('Node', data.nodeVersion || process.version),
    plainRow('构建开始(UTC)', data.startedAt || NOT_RECORDED),
    plainRow('构建结束(UTC)', data.finishedAt || NOT_RECORDED),
    plainRow('生成时间(UTC)', data.generatedAt || NOT_RECORDED),
    plainRow('总耗时', formatDuration(numOrNull(data.totalMs))),
    plainRow('输出体积', build.outputSize || NOT_RECORDED),
    plainRow('已发布文章', numOrNull(build.articles) === null ? NOT_RECORDED : build.articles),
    plainRow('自定义页面', numOrNull(build.customPages) === null ? NOT_RECORDED : build.customPages),
    plainRow('标签 / 分类', (numOrNull(build.tags) === null ? NOT_RECORDED : build.tags) + ' / ' + (numOrNull(build.categories) === null ? NOT_RECORDED : build.categories)),
    plainRow('配置键数', numOrNull(build.configKeys) === null ? NOT_RECORDED : build.configKeys)
  ];
  return '<section id="meta"><h2>构建元信息</h2><table class="kv">' + rows.join('') + '</table></section>';
}

function renderPhases(data) {
  const phases = arrayOrEmpty(data.phases);
  const byKey = new Map();
  for (const phase of phases) {
    if (!phase || typeof phase.key !== 'string') continue;
    byKey.set(phase.key, numOrNull(phase.ms));
  }
  const rows = PHASE_ORDER.map((key) => {
    const ms = byKey.has(key) ? byKey.get(key) : null;
    return '<tr><td>' + text(PHASE_LABELS[key] || key) + '</td><td class="num">'
      + text(formatDuration(ms)) + '</td></tr>';
  }).join('');
  return '<details id="phases" open><summary>阶段耗时（14 步管线 + 其它）</summary>'
    + '<table class="grid"><thead><tr><th>阶段</th><th>耗时</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
}

function sizeTriple(size) {
  if (!size || numOrNull(size.files) === null) return NOT_RECORDED;
  const gzip = numOrNull(size.gzipKb);
  return '文件 ' + size.files + '；raw ' + formatKb(numOrNull(size.rawKb))
    + (gzip === null ? '' : '；gzip ' + formatKb(gzip));
}

function renderTopList(top) {
  const items = arrayOrEmpty(top);
  if (!items.length) return '<p class="empty">（无）</p>';
  return '<ul class="list">' + items.map((item) => {
    const p = objectOrEmpty(item);
    return '<li><code>' + text(p.path || '') + '</code> — ' + text(formatKb(numOrNull(p.kb))) + '</li>';
  }).join('') + '</ul>';
}

function renderArtifacts(data) {
  const artifacts = objectOrEmpty(data.artifacts);
  const html = objectOrEmpty(artifacts.html);
  const css = objectOrEmpty(artifacts.css);
  const js = objectOrEmpty(artifacts.js);
  const vendor = objectOrEmpty(artifacts.vendor);
  const fonts = objectOrEmpty(artifacts.fonts);
  const media = objectOrEmpty(artifacts.media);
  const og = objectOrEmpty(artifacts.og);
  const rows = [
    plainRow('HTML 页数', numOrNull(html.pages) === null ? NOT_RECORDED : html.pages),
    plainRow('HTML raw 最大 / 中位', formatKb(numOrNull(html.rawMaxKb)) + ' / ' + formatKb(numOrNull(html.rawMedianKb))),
    plainRow('HTML gzip 最大 / 中位', formatKb(numOrNull(html.gzipMaxKb)) + ' / ' + formatKb(numOrNull(html.gzipMedianKb))),
    plainRow('CSS', sizeTriple(css)),
    plainRow('JS 合计', sizeTriple(js))
  ];
  for (const group of arrayOrEmpty(js.groups)) {
    const g = objectOrEmpty(group);
    rows.push(plainRow('JS ' + (JS_GROUP_LABELS[g.key] || g.key), sizeTriple(g)));
  }
  rows.push(plainRow('vendor（第三方库）', sizeTriple(vendor)));
  rows.push(plainRow('字体', sizeTriple(fonts)));
  rows.push(plainRow('媒体图片', numOrNull(media.count) === null ? NOT_RECORDED : '数量 ' + media.count + '（Top ' + arrayOrEmpty(media.top).length + '）'));
  rows.push(plainRow('OG 图', numOrNull(og.count) === null ? NOT_RECORDED : '数量 ' + og.count + '（Top ' + arrayOrEmpty(og.top).length + '）'));
  const policy = objectOrEmpty(data.policy);
  rows.push(plainRow('内容策略拦截 / 受保护复制', arrayOrEmpty(policy.blocked).length + ' / ' + (numOrNull(policy.copied) === null ? NOT_RECORDED : policy.copied)));
  return '<details id="artifacts" open><summary>产物体积与统计</summary>'
    + '<table class="kv">' + rows.join('') + '</table>'
    + '<h3>图片体积 Top</h3>' + renderTopList(media.top)
    + '<h3>OG 体积 Top</h3>' + renderTopList(og.top)
    + '</details>';
}

function renderBudget(data) {
  const budget = data.budget && typeof data.budget === 'object' ? data.budget : null;
  const items = budget ? arrayOrEmpty(budget.items) : [];
  if (!budget || items.length === 0) {
    return '<details id="budget" open><summary>性能预算</summary><p class="empty">perfBudget 未记录（未启用或未收集）</p></details>';
  }
  const rows = items.map((raw) => {
    const item = objectOrEmpty(raw);
    const value = item.key === 'requests' ? String(Math.round(numOrNull(item.value) || 0)) : formatKb(numOrNull(item.value));
    const limit = item.key === 'requests' ? String(Math.round(numOrNull(item.limit) || 0)) : formatKb(numOrNull(item.limit));
    const status = item.ok ? '<span class="good">OK</span>' : '<span class="bad">OVER</span>';
    return '<tr><td>' + status + '</td><td>' + text(item.label || item.key || '') + '</td><td class="num">'
      + text(value + ' / ' + limit) + '</td></tr>';
  }).join('');
  const verdict = budget.ok
    ? '全部达标'
    : '存在超限项' + (budget.warnOnly === false ? '（阻断构建）' : '（仅提醒）');
  return '<details id="budget" open><summary>性能预算（实测 vs 阈值）</summary>'
    + '<table class="grid"><thead><tr><th>状态</th><th>项目</th><th>实测 / 阈值</th></tr></thead><tbody>'
    + rows + '</tbody></table><p>结论: ' + text(verdict) + '</p></details>';
}

function formatCategoryLine(key, category) {
  const label = CATEGORY_LABELS[key] || key;
  if (!category || !Number.isFinite(category.filesAfter)) return label + ': ' + NOT_RECORDED;
  const counts = '文件 ' + category.filesAfter
    + '（变更 ' + category.changed + ' / 新增 ' + category.added + ' / 移除 ' + category.removed + '）';
  const raw = 'raw ' + formatBytes(category.rawBefore) + ' → ' + formatBytes(category.rawAfter)
    + '（' + formatReduction(category.rawBefore, category.rawAfter) + '）';
  const gzip = 'gzip ' + formatBytes(category.gzipBefore) + ' → ' + formatBytes(category.gzipAfter)
    + '（' + formatReduction(category.gzipBefore, category.gzipAfter) + '）';
  return label + ': ' + counts + '；' + raw + '；' + gzip + '；跳过 ' + category.skipped + '；豁免 ' + category.exempt;
}

function renderCssSkips(cssSkips) {
  const input = cssSkips && typeof cssSkips === 'object' ? cssSkips : null;
  if (!input || !Number.isFinite(input.count)) return '<p class="empty">CSS 合并/去重跳过: ' + NOT_RECORDED + '</p>';
  if (input.count === 0) return '<p class="empty">CSS 合并/去重跳过:（无）</p>';
  const details = arrayOrEmpty(input.details);
  return '<p>CSS 合并/去重跳过: ' + text(input.count) + ' 项（保留原文件；不计入失败账本）</p>'
    + listSection(details, (raw) => {
      const item = objectOrEmpty(raw);
      return '<li><code>' + text(item.file || '') + '</code>: ' + text(item.reason || '') + '</li>';
    });
}

function renderEnhancements(enhancements) {
  const e = objectOrEmpty(enhancements);
  const css = objectOrEmpty(e.css);
  const lines = [];
  if (numOrNull(css.blocksMerged) !== null) {
    lines.push('合并 style 块 ×' + css.blocksMerged + '（' + (numOrNull(css.pages) || 0) + ' 个页面）');
  }
  if (numOrNull(css.rulesCollapsed) !== null || numOrNull(css.declsDropped) !== null) {
    lines.push('去重规则 ×' + (numOrNull(css.rulesCollapsed) || 0) + '、声明 ×' + (numOrNull(css.declsDropped) || 0)
      + (numOrNull(css.cssFiles) ? '（含 ' + css.cssFiles + ' 个 CSS 文件）' : ''));
  }
  if (numOrNull(css.bytesSaved) !== null && css.bytesSaved > 0) lines.push('CSS 节省 ' + formatBytes(css.bytesSaved));
  if (numOrNull(e.jsonCompacted) !== null) lines.push('JSON 去空白 ×' + e.jsonCompacted);
  const runtime = objectOrEmpty(e.runtime);
  if (numOrNull(runtime.files) !== null) {
    lines.push('runtime 压缩 ×' + runtime.files + '（' + formatBytes(numOrNull(runtime.before)) + ' → ' + formatBytes(numOrNull(runtime.after)) + '）');
  }
  const obfuscate = objectOrEmpty(e.obfuscate);
  if (numOrNull(obfuscate.files) !== null) {
    lines.push('JS 混淆 ×' + obfuscate.files + '（' + formatBytes(numOrNull(obfuscate.before)) + ' → ' + formatBytes(numOrNull(obfuscate.after)) + '）');
  }
  const steps = arrayOrEmpty(e.steps);
  if (lines.length === 0 && steps.length === 0) return '<p class="empty">增强步骤明细: ' + NOT_RECORDED + '</p>';
  return '<p>增强步骤: ' + text(steps.length ? steps.join('、') : '（无）') + '</p>'
    + (lines.length ? listSection(lines, (line) => '<li>' + text(line) + '</li>') : '');
}

function renderVerifySummary(verify) {
  const input = verify && typeof verify === 'object' ? verify : {};
  if (input.ran !== true) return '本轮未运行（压缩增强未启用、verify.headless=false 或 serve/watch）';
  const report = input.report && typeof input.report === 'object' ? input.report : null;
  if (!report) return '结果文件缺失（.cache/compression-verify/last.json 未产出）';
  if (report.status === 'passed') {
    const pages = arrayOrEmpty(report.pages).length;
    const released = report.portsReleased === false ? '异常' : '正常';
    return '通过；断言页数 ' + pages + '；验证耗时 ' + formatDuration(numOrNull(report.durationsMs))
      + '；端口释放 ' + released + '；检查时间(UTC) ' + (report.checkedAt || NOT_RECORDED);
  }
  if (report.status === 'skipped') return '跳过（' + (report.reason || '原因未记录') + '）';
  let line = '失败；失败摘要: ' + summarizeFailures(report.failures);
  const fallback = report.fallback;
  if (fallback && fallback.applied === true) {
    line += '；回退已应用（恢复 ' + fallback.restored + ' / 移除 ' + fallback.removed
      + ' / 逐字节复核 ' + (fallback.bytesIdentical ? '一致' : '不一致') + '）';
  } else if (fallback && fallback.applied === false) {
    line += '；回退失败（' + (fallback.error || '原因未记录') + '）';
  } else {
    line += '；回退未触发（或压缩产物已保留）';
  }
  return line;
}

function renderCompression(data) {
  const compression = data.compression && typeof data.compression === 'object' ? data.compression : null;
  const active = compression
    ? (compression.active === true ? '启用' : compression.active === false ? '关闭' : NOT_RECORDED)
    : NOT_RECORDED;
  const lines = ['压缩增强: ' + active];
  for (const key of ['html', 'css', 'js', 'json']) {
    lines.push(formatCategoryLine(key, compression && compression.categories ? compression.categories[key] : null));
  }
  const htmlCat = compression && compression.categories ? compression.categories.html : null;
  const jsCat = compression && compression.categories ? compression.categories.js : null;
  lines.push('压缩目标（本阶段口径：基线压缩前 → 增强/压缩后）:');
  lines.push('HTML gzip: ' + (htmlCat ? formatTarget(htmlCat.gzipBefore, htmlCat.gzipAfter, 10) : NOT_RECORDED + '（目标 ≥ 10.00%）'));
  lines.push('JS gzip（混淆关态）: ' + (jsCat ? formatTarget(jsCat.gzipBefore, jsCat.gzipAfter, 20) : NOT_RECORDED + '（目标 ≥ 20.00%）'));
  return '<details id="compression" open><summary>压缩统计与无头验证</summary>'
    + listSection(lines, (line) => '<li>' + text(line) + '</li>')
    + renderEnhancements(compression ? compression.enhancements : null)
    + renderCssSkips(compression ? compression.cssSkips : null)
    + '<p class="verify">无头验证: ' + text(renderVerifySummary(data.verify)) + '</p></details>';
}

function cacheLine(label, hit, detail) {
  const counts = objectOrEmpty(hit);
  const reused = numOrNull(counts.reused);
  if (reused === null) return label + ' reused ' + NOT_RECORDED + (detail || '');
  return label + ' reused ' + reused + (detail || '');
}

function renderCache(data) {
  const cache = objectOrEmpty(data.cacheHits);
  const media = objectOrEmpty(cache.media);
  const og = objectOrEmpty(cache.og);
  const fonts = objectOrEmpty(cache.fonts);
  const mermaid = objectOrEmpty(cache.mermaid);
  const covers = objectOrEmpty(cache.covers);
  const mediaDetail = numOrNull(media.optimized) === null ? '' : '（新优化 ' + media.optimized + '）';
  const ogDetail = numOrNull(og.made) === null ? '' : '（新生成 ' + og.made + '）';
  const fontsDetail = numOrNull(fonts.downloaded) === null ? '' : '（新下载 ' + fonts.downloaded + '，共 ' + fonts.files + ' 个文件）';
  const mermaidCached = numOrNull(mermaid.cached);
  const mermaidDetail = numOrNull(mermaid.rendered) === null ? '' : '（新渲染 ' + mermaid.rendered + '）';
  const coversDetail = numOrNull(covers.made) === null ? '' : '（新生成 ' + covers.made + '）';
  const lines = [
    cacheLine('媒体优化', media, mediaDetail),
    cacheLine('OG', og, ogDetail),
    cacheLine('字体', fonts, fontsDetail),
    mermaidCached === null ? 'mermaid cached ' + NOT_RECORDED + mermaidDetail : 'mermaid cached ' + mermaidCached + mermaidDetail,
    cacheLine('自动封面', covers, coversDetail)
  ];
  return '<details id="cache"><summary>缓存命中</summary>'
    + listSection(lines, (line) => '<li>' + text(line) + '</li>') + '</details>';
}

function renderEntries(entries, prefix) {
  const list = arrayOrEmpty(entries);
  if (!list.length) return '<p class="empty">（无）</p>';
  return '<ul class="list">' + list.map((raw) => {
    const entry = objectOrEmpty(raw);
    const stage = entry.stage ? '[' + entry.stage + '] ' : '[?] ';
    return '<li>' + text(prefix + stage + (entry.message || '')) + '</li>';
  }).join('') + '</ul>';
}

function renderWarnings(data) {
  return '<details id="warnings" open><summary>告警清单</summary>' + renderEntries(data.warnings, '') + '</details>';
}

function renderFailures(data) {
  const failures = arrayOrEmpty(data.failures);
  return '<details id="failures" open><summary>失败清单（含阶段）</summary>'
    + renderEntries(failures, '[阻断]') + '</details>';
}

function renderPages(data) {
  const pages = arrayOrEmpty(data.pages);
  return '<details id="pages"><summary>页面清单（' + pages.length + '）</summary>'
    + listSection(pages, (page) => '<li><code>' + text(page) + '</code></li>') + '</details>';
}

const STYLE = [
  ':root{--fg:#1f2937;--fg2:#6b7280;--bg:#ffffff;--card:#f9fafb;--border:#e5e7eb;--good:#16a34a;--warn:#d97706;--bad:#dc2626}',
  '@media (prefers-color-scheme: dark){:root{--fg:#e5e7eb;--fg2:#9ca3af;--bg:#111827;--card:#1f2937;--border:#374151;--good:#4ade80;--warn:#fbbf24;--bad:#f87171}}',
  'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:920px;margin:2rem auto;padding:0 1rem;color:var(--fg);background:var(--bg);line-height:1.5}',
  'h1{font-size:1.5rem}h2{font-size:1.15rem;margin:1.25rem 0 .5rem}h3{font-size:1rem;margin:1rem 0 .25rem}',
  'details{border:1px solid var(--border);border-radius:6px;margin:.75rem 0;padding:.5rem .75rem;background:var(--card)}',
  'summary{cursor:pointer;font-weight:600}',
  'table{border-collapse:collapse;width:100%;margin:.5rem 0;font-size:.92rem}',
  'th,td{text-align:left;padding:.3rem .5rem;border-bottom:1px solid var(--border);vertical-align:top}',
  '.kv th{width:16rem;color:var(--fg2);font-weight:500}.num{text-align:right;white-space:nowrap}',
  '.list{margin:.25rem 0 .5rem;padding-left:1.4rem}.list li{margin:.15rem 0}',
  'code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.88em;word-break:break-all}',
  '.good{color:var(--good);font-weight:600}.bad{color:var(--bad);font-weight:600}.empty{color:var(--fg2)}',
  '.generated{color:var(--fg2);font-size:.9rem}'
].join('');

/**
 * 渲染 dist/build-report.html 全文。
 * @param {object} [input] 构建期收集的报告数据（全部字段可缺失）
 * @returns {string} 完整 HTML 文档
 */
function renderBuildReportHtml(input) {
  const data = copyOwnProperties({}, input || {});
  const lang = data.lang || 'zh';
  const title = '构建报告' + (data.siteTitle ? ' - ' + data.siteTitle : '');
  const colors = objectOrEmpty(data.colors);
  const colorOverrides = [];
  if (/^#[0-9a-f]{6}$/i.test(String(colors.good || ''))) colorOverrides.push('--good:' + colors.good);
  if (/^#[0-9a-f]{6}$/i.test(String(colors.warn || ''))) colorOverrides.push('--warn:' + colors.warn);
  const colorCss = colorOverrides.length ? ':root{' + colorOverrides.join(';') + '}' : '';
  const body = [
    '<h1>构建报告</h1>',
    '<p class="generated">生成时间(UTC): ' + text(data.generatedAt || NOT_RECORDED) + '</p>',
    renderMeta(data),
    renderPhases(data),
    renderArtifacts(data),
    renderBudget(data),
    renderCompression(data),
    renderCache(data),
    renderWarnings(data),
    renderFailures(data),
    renderPages(data)
  ].join('\n');
  const nonce = typeof data.nonce === 'string' && data.nonce ? ' nonce="' + escapeHtml(data.nonce) + '"' : '';
  return '<!DOCTYPE html><html lang="' + escapeHtml(String(lang)) + '"><head><meta charset="UTF-8">'
    + '<meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + escapeHtml(title) + '</title>'
    + '<style' + nonce + '>' + STYLE + colorCss + '</style></head><body>\n' + body + '\n</body></html>';
}

module.exports = {
  renderBuildReportHtml,
  formatDuration,
  formatBytes,
  formatReduction,
  PHASE_LABELS
};

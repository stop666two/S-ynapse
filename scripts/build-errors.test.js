const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createBuildErrorCollector, resolveExitCode, formatFailures, formatWarnings } = require('./lib/build-errors');

describe('build-errors collector', () => {
  it('starts empty', () => {
    const c = createBuildErrorCollector();
    assert.strictEqual(c.hasErrors, false);
    assert.strictEqual(c.hasWarnings, false);
    assert.deepStrictEqual(c.entries, []);
  });

  it('records failures in order with stage and message', () => {
    const c = createBuildErrorCollector();
    c.add('render', 'article page failed: x');
    c.add('feed', 'rss failed: y');
    assert.strictEqual(c.hasErrors, true);
    assert.deepStrictEqual(c.entries, [
      { stage: 'render', message: 'article page failed: x', fatal: true },
      { stage: 'feed', message: 'rss failed: y', fatal: true }
    ]);
  });

  it('non-fatal entries are recorded but keep the build successful', () => {
    const c = createBuildErrorCollector();
    c.add('compression-verify', '对比失败已回退', { fatal: false });
    assert.strictEqual(c.hasErrors, false);
    assert.strictEqual(c.hasWarnings, true);
    assert.deepStrictEqual(c.fatalEntries, []);
    assert.deepStrictEqual(c.warningEntries, [
      { stage: 'compression-verify', message: '对比失败已回退', fatal: false }
    ]);
    assert.strictEqual(resolveExitCode(c, {}), 0);
    c.add('feed', 'rss failed');
    assert.strictEqual(c.hasErrors, true);
    assert.strictEqual(resolveExitCode(c, {}), 1);
    assert.deepStrictEqual(c.fatalEntries.map((e) => e.stage), ['feed']);
  });

  it('returns a copy of entries so callers cannot mutate internal state', () => {
    const c = createBuildErrorCollector();
    c.add('media', 'sharp failed');
    c.entries.push({ stage: 'fake', message: 'injected' });
    c.entries.length = 0;
    assert.strictEqual(c.entries.length, 1);
  });

  it('resolveExitCode returns 1 when there are errors (no degraded mode)', () => {
    const c = createBuildErrorCollector();
    c.add('sitemap', 'boom');
    assert.strictEqual(resolveExitCode(c, {}), 1);
    assert.strictEqual(resolveExitCode(c, { allowDegraded: false }), 1);
  });

  it('resolveExitCode returns 0 when clean or when degraded is allowed', () => {
    const clean = createBuildErrorCollector();
    assert.strictEqual(resolveExitCode(clean, {}), 0);
    const failed = createBuildErrorCollector();
    failed.add('og', 'sharp failed');
    assert.strictEqual(resolveExitCode(failed, { allowDegraded: true }), 0);
  });

  it('formatFailures lists every failure with its stage', () => {
    const c = createBuildErrorCollector();
    c.add('render', 'page A failed');
    c.add('feed', 'rss failed');
    const out = formatFailures(c.entries);
    assert.ok(out.includes('[render] page A failed'));
    assert.ok(out.includes('[feed] rss failed'));
    assert.ok(out.includes('2'));
    assert.strictEqual(formatFailures([]), '');
  });

  it('formatWarnings labels non-blocking entries without the failure wording', () => {
    const out = formatWarnings([{ stage: 'compression-verify', message: '已回退' }]);
    assert.ok(out.includes('[compression-verify] 已回退'));
    assert.ok(out.includes('不阻断'));
    assert.ok(!out.includes('构建失败'));
    assert.strictEqual(formatWarnings([]), '');
  });
});

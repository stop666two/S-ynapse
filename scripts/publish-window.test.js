const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isScheduled, partitionByPublishTime } = require('./lib/publish-window');

describe('publish-window', () => {
  const now = new Date('2026-09-25T12:00:00Z');

  it('treats future-dated articles as scheduled', () => {
    assert.strictEqual(isScheduled({ date: '2026-09-26' }, now), true);
    assert.strictEqual(isScheduled({ date: '2026-12-31' }, now), true);
  });

  it('treats past and same-day articles as published', () => {
    assert.strictEqual(isScheduled({ date: '2026-09-24' }, now), false);
    assert.strictEqual(isScheduled({ date: '2020-01-01' }, now), false);
  });

  it('ignores articles without date or with invalid date', () => {
    assert.strictEqual(isScheduled({}, now), false);
    assert.strictEqual(isScheduled({ date: null }, now), false);
    assert.strictEqual(isScheduled({ date: 'not-a-date' }, now), false);
    assert.strictEqual(isScheduled(null, now), false);
  });

  it('partitions articles preserving input order', () => {
    const a = { id: 'a', date: '2026-01-01' };
    const b = { id: 'b', date: '2027-01-01' };
    const c = { id: 'c', date: '' };
    const r = partitionByPublishTime([a, b, c], now);
    assert.deepStrictEqual(r.published.map((x) => x.id), ['a', 'c']);
    assert.deepStrictEqual(r.scheduled.map((x) => x.id), ['b']);
  });

  it('handles empty and non-array input', () => {
    assert.deepStrictEqual(partitionByPublishTime([], now), { published: [], scheduled: [] });
    assert.deepStrictEqual(partitionByPublishTime(null, now), { published: [], scheduled: [] });
  });
});

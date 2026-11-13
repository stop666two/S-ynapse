const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { formatDate } = require('./lib/utils');

// 在子进程里设置 TZ 才能稳定复现「UTC 以西时区」的旧缺陷——
// 主测试进程的 TZ 由运行环境决定，CI 机器可能恰好在 UTC+8 而看不到问题。
function formatDateInTimezone(tz, dateStr, fmt) {
  const code = 'process.stdout.write(require("./lib/utils").formatDate('
    + JSON.stringify(dateStr) + ',' + JSON.stringify(fmt) + '))';
  return execFileSync(process.execPath, ['-e', code], {
    cwd: __dirname,
    env: Object.assign({}, process.env, { TZ: tz }),
    encoding: 'utf8'
  });
}

describe('formatDate date-only timezone handling', () => {
  // 审查 R-30：`new Date('2026-07-19')` 按 UTC 午夜解析，旧实现用本地 getter 读取，
  // 在 America/New_York 下返回 2026-07-18（卡片/文章头/归档整体退一天）。
  it('formats date-only input identically in western and eastern timezones', () => {
    assert.strictEqual(formatDateInTimezone('America/New_York', '2026-07-19', 'YYYY-MM-DD'), '2026-07-19');
    assert.strictEqual(formatDateInTimezone('Asia/Shanghai', '2026-07-19', 'YYYY-MM-DD'), '2026-07-19');
    assert.strictEqual(formatDateInTimezone('Pacific/Kiritimati', '2026-01-01', 'YYYY-MM-DD'), '2026-01-01');
  });

  it('drops the empty time part for date-only input', () => {
    assert.strictEqual(formatDateInTimezone('America/New_York', '2026-07-19', 'YYYY/MM/DD HH:mm'), '2026/07/19');
  });

  it('keeps local semantics for input with an explicit time component', () => {
    assert.strictEqual(formatDate('2026-07-19 14:30', 'YYYY-MM-DD HH:mm'), '2026-07-19 14:30');
    // 带偏移的 ISO 时间仍按本地时间渲染（既有语义，不因本次修复改变）。
    assert.strictEqual(formatDateInTimezone('America/New_York', '2026-07-19T14:30:00Z', 'YYYY-MM-DD HH:mm'), '2026-07-19 10:30');
  });

  it('falls back to the raw string for unparsable input', () => {
    assert.strictEqual(formatDate('not-a-date', 'YYYY-MM-DD'), 'not-a-date');
  });
});

describe('dateParts archive grouping (R-30 sibling)', () => {
  // 审查 R-30：归档分组此前在 scripts/build/articles.js 里另写一份本地 getter，
  // 与 formatDate 不同源——负时区构建机上「卡片日期」与「归档年月」会互相错开。
  const { dateParts } = require('./lib/utils');
  function datePartsInTimezone(tz, dateStr) {
    const code = 'process.stdout.write(JSON.stringify(require("./lib/utils").dateParts('
      + JSON.stringify(dateStr) + ')))';
    return JSON.parse(execFileSync(process.execPath, ['-e', code], {
      cwd: __dirname,
      env: Object.assign({}, process.env, { TZ: tz }),
      encoding: 'utf8'
    }));
  }

  it('derives year/month from the same UTC basis as formatDate for date-only input', () => {
    assert.deepStrictEqual(datePartsInTimezone('America/New_York', '2026-01-01'), { year: 2026, month: 1 });
    assert.deepStrictEqual(datePartsInTimezone('America/New_York', '2026-12-31'), { year: 2026, month: 12 });
    assert.deepStrictEqual(datePartsInTimezone('Asia/Shanghai', '2026-07-19'), { year: 2026, month: 7 });
  });

  it('returns null for empty or unparsable input and keeps local semantics with a time component', () => {
    assert.strictEqual(dateParts(''), null);
    assert.strictEqual(dateParts(null), null);
    assert.strictEqual(dateParts('not-a-date'), null);
    assert.deepStrictEqual(dateParts('2026-07-19 14:30'), { year: 2026, month: 7 });
  });
});

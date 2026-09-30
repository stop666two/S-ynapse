'use strict';
// 属性测试示范（骨架）：证明 fast-check + 种子管理 + 失败留档基础设施可用。
// 覆盖既有纯函数 safeSlug / validateSlug 的核心不变量：不产生路径分隔符、不崩溃、幂等、确定性。
// 运行：npm run test:fuzz（默认 100 次迭代）；深度档 FC_NUM_RUNS=2000；复现：TEST_SEED=<种子> npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const fc = require('fast-check');
const { safeSlug, validateSlug } = require('./utils');
const { checkProperty, makeRng, numRuns } = require('./test-random');
const { generateLongText, generateTraversalSlug, generateXssPayload } = require('./test-payloads');
const { createTestSite, TMP_ROOT } = require('./test-site-builder');

// BMP 全域单元（含孤立代理、控制字符、RTL 覆盖等），确保边界输入进入属性。
const anyUnit = fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code));
const anyString = fc.string({ unit: anyUnit, maxLength: 40 });
const traversalString = fc.tuple(anyString, fc.constantFrom('/', '\\', '..'), anyString).map(([a, sep, b]) => a + sep + b);

describe('safeSlug 属性', () => {
  it('不产生路径分隔符 / ".." / 首尾连字符，且输出非空', () => {
    checkProperty('safeSlug-路径安全', fc, fc.property(anyString, (text) => {
      const slug = safeSlug(text);
      assert.doesNotMatch(slug, /[/\\]/, 'slug 不得含路径分隔符：' + JSON.stringify(slug));
      assert.ok(!slug.includes('..'), 'slug 不得含 ".."：' + JSON.stringify(slug));
      if (text.length > 0) assert.ok(slug.length > 0, '非空输入必须得到非空 slug');
      assert.ok(!slug.startsWith('-') && !slug.endsWith('-'), 'slug 不得有首尾连字符：' + JSON.stringify(slug));
      return true;
    }));
  });

  it('幂等：safeSlug(safeSlug(x)) === safeSlug(x)', () => {
    checkProperty('safeSlug-幂等', fc, fc.property(anyString, (text) => {
      const once = safeSlug(text);
      assert.strictEqual(safeSlug(once), once, 'slug 二次处理必须稳定：' + JSON.stringify(text));
      return true;
    }));
  });

  it('确定性：同一输入两次调用结果一致', () => {
    checkProperty('safeSlug-确定性', fc, fc.property(anyString, (text) => {
      assert.strictEqual(safeSlug(text), safeSlug(text));
      return true;
    }));
  });
});

describe('validateSlug 属性', () => {
  it('任意输入不崩溃且返回结构完整', () => {
    checkProperty('validateSlug-不变量', fc, fc.property(anyString, (raw) => {
      const result = validateSlug(raw);
      assert.strictEqual(typeof result.ok, 'boolean');
      if (result.ok) {
        assert.ok(result.slug.length > 0 && result.slug.length <= 120);
        assert.doesNotMatch(result.slug, /[/\\]/);
        assert.ok(!result.slug.includes('..'));
      } else {
        assert.strictEqual(typeof result.reason, 'string');
        assert.ok(result.reason.length > 0, '拒绝必须携带原因');
      }
      return true;
    }));
  });

  it('含路径分隔符或 ".." 的输入必须被拒绝', () => {
    checkProperty('validateSlug-拒绝遍历', fc, fc.property(traversalString, (raw) => {
      assert.strictEqual(validateSlug(raw).ok, false, '遍历串必须拒绝：' + JSON.stringify(raw));
      return true;
    }));
  });

  it('trim 后超过 120 字符的输入必须被拒绝', () => {
    checkProperty('validateSlug-长度上限', fc, fc.property(
      fc.string({ unit: anyUnit, minLength: 121, maxLength: 200 }),
      (raw) => {
        if (raw.trim().length > 120) {
          assert.strictEqual(validateSlug(raw).ok, false, '超长 slug 必须拒绝');
        }
        return true;
      }
    ));
  });
});

describe('随机基础设施', () => {
  it('载荷生成器对同一 rng 种子确定且形态正确', () => {
    const textA = generateLongText(makeRng(42), 64);
    const textB = generateLongText(makeRng(42), 64);
    assert.strictEqual(textA, textB);
    assert.strictEqual(textA.length, 64);
    const slugA = generateTraversalSlug(makeRng(7));
    const slugB = generateTraversalSlug(makeRng(7));
    assert.strictEqual(slugA, slugB);
    assert.strictEqual(typeof slugA, 'string');
    const xssA = generateXssPayload(makeRng(9));
    const xssB = generateXssPayload(makeRng(9));
    assert.strictEqual(xssA, xssB);
  });

  it('迭代次数读取 FC_NUM_RUNS，默认 100', () => {
    assert.strictEqual(numRuns({}), 100);
    assert.strictEqual(numRuns({ FC_NUM_RUNS: '2000' }), 2000);
    assert.strictEqual(numRuns({ FC_NUM_RUNS: '0' }), 100);
    assert.strictEqual(numRuns({ FC_NUM_RUNS: 'abc' }), 100);
    assert.ok(numRuns({}) >= 1);
  });

  it('临时站点夹具生成、列举与幂等清理', () => {
    const site = createTestSite({ articles: 2, pages: 1, media: true, mediaBroken: true, seed: 7 });
    try {
      assert.ok(site.root.startsWith(TMP_ROOT), '夹具必须位于 .tmp-test 内');
      for (const rel of ['site.json5', 'features.json5', 'articles/zh/test-article-1.md', 'articles/en/test-article-2.md', 'media/test-pixel.png', 'media/broken.png']) {
        assert.ok(fs.existsSync(path.join(site.root, rel)), '缺少夹具文件：' + rel);
      }
    } finally {
      assert.strictEqual(site.cleanup(), true);
    }
    assert.ok(!fs.existsSync(site.root), '清理后目录必须消失');
    assert.strictEqual(site.cleanup(), true, '重复清理必须幂等成功');
  });
});

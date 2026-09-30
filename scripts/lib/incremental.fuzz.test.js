'use strict';
// 增量指纹与缓存属性测试：
// 覆盖 asset-cache 的 buildCacheKey 确定性与区分度、缓存序列的 skip/rebuild 语义、
// pruneTo 保留策略；incremental 的 stableSerialize（键序无关/nonce 归一化/循环兜底）、
// hashContent/pageCacheKey 确定性与算法归一化、computeIncrementalContext 决策模型；
// 以及真实 cacheBust 在随机文件集上的内容寻址与幂等。
// 运行：npm run test:fuzz；复现：TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz。

const { before, after, describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const fc = require('fast-check');
const {
  buildCacheKey, configFingerprint, isFresh, getFresh, updateEntry, pruneTo
} = require('./asset-cache');
const {
  normalizeHashAlgo, hashContent, stableSerialize, pageCacheKey, computeIncrementalContext
} = require('./incremental');
const { createMinifyModule } = require('../build/minify');
const { getAllFiles } = require('../build/fs-utils');
const { checkProperty, checkPropertyAsync, stressEnabled } = require('./test-random');

const STRESS = stressEnabled();
const MAX_SEQUENCE = STRESS ? 80 : 20;

const statsArb = fc.record({
  mtimeMs: fc.double({ min: 0, max: 4102444800000, noNaN: true }),
  size: fc.nat({ max: 1000000000 })
});
const hashTextArb = fc.string({ maxLength: 12 });
const algoArb = fc.oneof(
  fc.constantFrom('sha1', 'sha256', 'md5', 'SHA1', 'SHA-256', 'MD5', 'bogus', ''),
  fc.constant(undefined)
);

describe('asset-cache 属性', () => {
  it('buildCacheKey：确定性；键相同当且仅当 floor(mtime)+size+configHash 相同', () => {
    checkProperty('buildCacheKey-区分度', fc, fc.property(
      statsArb, statsArb, hashTextArb, hashTextArb,
      (statsA, statsB, hashA, hashB) => {
        const keyA = buildCacheKey(statsA, hashA);
        assert.strictEqual(keyA, buildCacheKey(statsA, hashA), '必须确定');
        const same = buildCacheKey(statsA, hashA) === buildCacheKey(statsB, hashB);
        const expected = Math.floor(statsA.mtimeMs) === Math.floor(statsB.mtimeMs)
          && statsA.size === statsB.size && hashA === hashB;
        assert.strictEqual(same, expected, '仅当三要素（取整后的 mtime/size/config）全同才允许同键');
        return true;
      }
    ));
  });

  it('buildCacheKey：缺失或非法 stats 归一化为 0，空指纹稳定', () => {
    checkProperty('buildCacheKey-缺省归一', fc, fc.property(
      fc.oneof(fc.constant(undefined), fc.constant(null), fc.constant({}), fc.constant({ mtimeMs: NaN, size: 'x' }), fc.constant({ mtimeMs: Infinity, size: NaN })),
      (stats) => {
        const key = buildCacheKey(stats, undefined);
        assert.strictEqual(key, '0:0:', '缺失/非法字段必须按 0 处理：' + key);
        assert.strictEqual(key, buildCacheKey(stats, null));
        return true;
      }
    ));
  });

  it('变更序列：skip/rebuild 次数等于各 id 键值跳变次数，终态缓存等于最后一次键', () => {
    const stateArb = fc.record({
      id: fc.constantFrom('a', 'b', 'c'),
      mtimeMs: fc.integer({ min: 0, max: 1000000 }),
      size: fc.integer({ min: 0, max: 100000 }),
      configHash: fc.string({ maxLength: 6 })
    });
    checkProperty('asset-cache-变更序列', fc, fc.property(fc.array(stateArb, { minLength: 1, maxLength: MAX_SEQUENCE }), (sequence) => {
      const cache = {};
      const last = {};
      let rebuilds = 0;
      let transitions = 0;
      for (const state of sequence) {
        const key = buildCacheKey({ mtimeMs: state.mtimeMs, size: state.size }, state.configHash);
        if (!isFresh(cache, state.id, key)) {
          updateEntry(cache, state.id, key);
          rebuilds += 1;
        }
        if (last[state.id] !== key) transitions += 1;
        last[state.id] = key;
        assert.strictEqual(isFresh(cache, state.id, key), true, '处理后必须命中最新键');
        const recordCache = {};
        recordCache[state.id] = { key: key };
        assert.strictEqual(getFresh(recordCache, state.id, key).key, key, '记录形态与 getFresh 语义一致');
      }
      assert.deepStrictEqual(cache, last, '终态缓存必须逐 id 等于最后一次键');
      assert.strictEqual(rebuilds, transitions, 'rebuild 次数必须等于键跳变次数');
      return true;
    }));
  });

  it('pruneTo：只保留 validIds、已有条目原子保留、二次清理幂等', () => {
    const entryArb = fc.record({ id: fc.stringMatching(/^[a-z]{1,6}$/), key: fc.string({ maxLength: 10 }) });
    checkProperty('asset-cache-pruneTo', fc, fc.property(
      fc.array(entryArb, { maxLength: 12 }),
      fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 8 }),
      (entries, validIds) => {
        const cache = {};
        for (const entry of entries) cache[entry.id] = entry.key;
        const snapshot = Object.assign({}, cache);
        const returned = pruneTo(cache, validIds);
        assert.strictEqual(returned, cache, '必须原地返回同一对象');
        const keep = new Set(validIds);
        for (const id of Object.keys(cache)) assert.ok(keep.has(id), '不得保留无效 id：' + id);
        for (const id of validIds) {
          if (Object.prototype.hasOwnProperty.call(snapshot, id)) {
            assert.strictEqual(cache[id], snapshot[id], '有效 id 的值不得被改动');
          }
        }
        const afterFirst = Object.assign({}, cache);
        pruneTo(cache, validIds);
        assert.deepStrictEqual(cache, afterFirst, '二次清理必须幂等');
        return true;
      }
    ));
  });

  it('configFingerprint：同输入稳定、10 位十六进制、内容变化则可区分', () => {
    checkProperty('configFingerprint-稳定', fc, fc.property(fc.array(fc.jsonValue({ maxDepth: 3 }), { maxLength: 5 }), (parts) => {
      const a = configFingerprint(parts);
      const b = configFingerprint(parts);
      assert.strictEqual(a, b);
      assert.match(a, /^[0-9a-f]{10}$/);
      const changed = parts.concat(['extra']);
      assert.notStrictEqual(configFingerprint(changed), a, '内容变化必须改变指纹');
      return true;
    }));
  });
});

describe('stableSerialize 属性', () => {
  it('JSON 值往返：序列化产物解析后与 JSON 规范化结果一致', () => {
    checkProperty('stableSerialize-JSON 往返', fc, fc.property(fc.jsonValue({ maxDepth: 5 }), (value) => {
      const serialized = stableSerialize(value);
      assert.strictEqual(serialized, stableSerialize(value), '必须确定');
      assert.deepStrictEqual(JSON.parse(serialized), JSON.parse(JSON.stringify(value)));
      return true;
    }));
  });

  it('键序无关：同一键值对以不同插入顺序构造时序列化逐字节一致', () => {
    const dictArb = fc.dictionary(fc.stringMatching(/^[a-z][a-z0-9_]{0,6}$/), fc.jsonValue({ maxDepth: 3 }), { maxKeys: 6 });
    checkProperty('stableSerialize-键序', fc, fc.property(dictArb, (dict) => {
      const forward = {};
      const backward = {};
      for (const key of Object.keys(dict)) forward[key] = dict[key];
      for (const key of Object.keys(dict).reverse()) backward[key] = dict[key];
      assert.strictEqual(stableSerialize(forward), stableSerialize(backward));
      return true;
    }));
  });

  it('nonce 归一化：不同 nonce 的 CSP/属性两种形态归为同一占位符', () => {
    const nonceArb = fc.stringMatching(/^[a-z0-9]{1,12}$/);
    checkProperty('stableSerialize-nonce', fc, fc.property(nonceArb, nonceArb, (nonceA, nonceB) => {
      const first = stableSerialize({ csp: "default-src 'nonce-" + nonceA + "'", html: 'nonce="' + nonceA + '"' });
      const second = stableSerialize({ csp: "default-src 'nonce-" + nonceB + "'", html: 'nonce="' + nonceB + '"' });
      assert.strictEqual(first, second);
      const parsed = JSON.parse(first);
      assert.strictEqual(parsed.csp, "default-src 'nonce-*'");
      assert.strictEqual(parsed.html, 'nonce="*"');
      return true;
    }));
  });

  it('循环引用降级为占位符：对象自引用、数组自引用、互引与共享数组', () => {
    const object = {};
    object.self = object;
    assert.strictEqual(stableSerialize(object), '{"self":"[circular]"}');
    const array = [];
    array.push(array);
    assert.strictEqual(stableSerialize(array), '["[circular]"]');
    const shared = { value: 1 };
    assert.strictEqual(stableSerialize([shared, shared]), '[{"value":1},{"value":1}]', '非循环共享引用必须完整序列化');
    const left = [];
    const right = [left];
    left.push(right);
    assert.strictEqual(stableSerialize(left), '[["[circular]"]]');
  });

  it('不可序列化值：对象键被跳过、数组占位为 null', () => {
    assert.strictEqual(stableSerialize({ a: 1, b: undefined, c: function nope() {}, d: Symbol('s') }), '{"a":1}');
    assert.strictEqual(stableSerialize([1, undefined, function nope() {}]), '[1,null,null]');
    assert.strictEqual(stableSerialize(undefined), undefined);
    assert.strictEqual(stableSerialize(new Date('2026-01-01T00:00:00.000Z')), '"2026-01-01T00:00:00.000Z"');
    assert.strictEqual(stableSerialize(Buffer.from('ab')), JSON.stringify(Buffer.from('ab').toString('base64')));
  });
});

describe('incremental 指纹与决策属性', () => {
  it('normalizeHashAlgo：只允许 sha1/sha256/md5，未知输入回退 sha1', () => {
    checkProperty('normalizeHashAlgo-归一', fc, fc.property(algoArb, (algo) => {
      const normalized = normalizeHashAlgo(algo);
      assert.ok(['sha1', 'sha256', 'md5'].includes(normalized));
      if (typeof algo === 'string' && ['sha1', 'sha256', 'md5'].includes(algo.toLowerCase())) {
        assert.strictEqual(normalized, algo.toLowerCase());
      } else {
        assert.strictEqual(normalized, 'sha1');
      }
      return true;
    }));
  });

  it('hashContent：与 node:crypto 直接计算一致，长度随算法区分且确定', () => {
    const lengths = { sha1: 40, sha256: 64, md5: 32 };
    checkProperty('hashContent-一致', fc, fc.property(fc.string({ maxLength: 60 }), algoArb, (content, algo) => {
      const first = hashContent(content, algo);
      assert.strictEqual(first, hashContent(content, algo));
      const expected = crypto.createHash(normalizeHashAlgo(algo)).update(String(content)).digest('hex');
      assert.strictEqual(first, expected);
      assert.strictEqual(first.length, lengths[normalizeHashAlgo(algo)]);
      return true;
    }));
  });

  it('pageCacheKey：相同输入同键、relPath 或指纹变化即换键', () => {
    checkProperty('pageCacheKey-区分', fc, fc.property(
      fc.stringMatching(/^[a-z0-9/.-]{1,20}$/), fc.stringMatching(/^[a-z0-9/.-]{1,20}$/), hashTextArb, hashTextArb,
      (pathA, pathB, fingerprintA, fingerprintB) => {
        const base = pageCacheKey(pathA, fingerprintA, 'sha1');
        assert.strictEqual(base, pageCacheKey(pathA, fingerprintA, 'sha1'));
        if (pathA !== pathB) assert.notStrictEqual(pageCacheKey(pathB, fingerprintA, 'sha1'), base);
        if (fingerprintA !== fingerprintB) assert.notStrictEqual(pageCacheKey(pathA, fingerprintB, 'sha1'), base);
        return true;
      }
    ));
  });

  it('computeIncrementalContext：active/forceFull/requested 与配置和 argv 模型一致', () => {
    const incArb = fc.record({
      enabled: fc.boolean(),
      skipUnchanged: fc.boolean(),
      watch: fc.boolean(),
      fullFlag: fc.oneof(fc.constantFrom('--full', '--rebuild', ''), fc.constant(undefined)),
      fingerprintHash: algoArb
    });
    const featuresArb = fc.oneof(fc.constant(undefined), fc.record({ incrementalBuild: incArb }));
    const optionsArb = fc.record({
      argv: fc.array(fc.constantFrom('--full', '--incremental', '--rebuild', '--watch', 'build').map((flag) => String(flag)), { maxLength: 5 }),
      watchMode: fc.boolean()
    });
    checkProperty('computeIncrementalContext-模型', fc, fc.property(featuresArb, optionsArb, (features, options) => {
      const result = computeIncrementalContext(features, options);
      assert.deepStrictEqual(computeIncrementalContext(features, options), result, '决策必须确定');
      assert.strictEqual(typeof result.active, 'boolean');
      assert.strictEqual(typeof result.forceFull, 'boolean');
      assert.strictEqual(typeof result.requested, 'boolean');
      assert.ok(['sha1', 'sha256', 'md5'].includes(result.fingerprintHash));
      const inc = features && features.incrementalBuild;
      if (!inc) {
        assert.strictEqual(result.active, false);
        assert.strictEqual(result.requested, false);
        assert.strictEqual(result.forceFull, options.argv.includes('--full'));
        assert.strictEqual(result.fingerprintHash, 'sha1');
        return true;
      }
      const fullFlag = (inc.fullFlag == null ? '' : String(inc.fullFlag).trim()) || '--full';
      const forceFull = options.argv.includes(fullFlag) || options.argv.includes('--full');
      const requested = options.watchMode ? inc.watch !== false : options.argv.includes('--incremental');
      assert.strictEqual(result.forceFull, forceFull);
      assert.strictEqual(result.requested, requested);
      assert.strictEqual(result.active, inc.enabled !== false && inc.skipUnchanged !== false && !forceFull && requested);
      return true;
    }));
  });
});

describe('cacheBust 属性（真实文件系统）', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-incremental-fuzz-'));
  const CONFIG = { site: { build: { enableCacheBusting: true, cacheBustingPattern: '.*\\.(css|js|png|jpg|svg)$' } } };

  before(() => {
    fs.mkdirSync(root, { recursive: true });
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  function makeModule(distDir) {
    return createMinifyModule({
      distDir,
      cacheBustManifestPath: path.join(distDir, 'cache-bust-manifest.json'),
      bundleActive: true,
      getAllFiles,
      recordBuildFailure: () => {},
      minifyHtmlNode: null,
      CleanCSS: null,
      terser: null
    });
  }

  // cacheBust 用 console.log 汇报改名统计；批量属性运行期间静音，避免输出淹没测试结果。
  async function quietAsync(fn) {
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    try {
      return await fn();
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }
  }

  it('随机文件集：内容寻址命名、HTML 引用同步、二次运行完全幂等', async () => {
    const filesArb = fc.uniqueArray(
      fc.record({
        name: fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/),
        ext: fc.constantFrom('.css', '.js', '.png', '.jpg', '.svg'),
        content: fc.string({ maxLength: 40 })
      }),
      { minLength: 1, maxLength: STRESS ? 8 : 4, selector: (file) => file.name + file.ext }
    );
    await checkPropertyAsync('cacheBust-幂等与内容寻址', fc, fc.asyncProperty(filesArb, async (files) => {
      const dir = fs.mkdtempSync(path.join(root, 'case-'));
      try {
        const mediaDir = path.join(dir, 'media');
        fs.mkdirSync(mediaDir, { recursive: true });
        const entries = files.map((file) => {
          const oldRel = file.name + file.ext;
          fs.writeFileSync(path.join(mediaDir, oldRel), file.content, 'utf-8');
          const buffer = fs.readFileSync(path.join(mediaDir, oldRel));
          const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 10);
          return { oldRel, newRel: file.name + '.' + hash + file.ext };
        });
        fs.writeFileSync(
          path.join(dir, 'index.html'),
          entries.map((entry) => '<img src="/media/' + entry.oldRel + '">').join(''),
          'utf-8'
        );
        const mod = makeModule(dir);
        await quietAsync(() => mod.cacheBust(CONFIG));
        assert.deepStrictEqual(
          fs.readdirSync(mediaDir).sort(),
          entries.map((entry) => entry.newRel).sort(),
          '每个文件必须改名为内容寻址名'
        );
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
        for (const entry of entries) {
          assert.ok(html.includes('src="/media/' + entry.newRel + '"'), 'HTML 必须引用新名：' + entry.newRel);
          assert.ok(!html.includes('src="/media/' + entry.oldRel + '"'), 'HTML 不得残留旧名：' + entry.oldRel);
        }
        const listingAfterFirst = fs.readdirSync(mediaDir).sort();
        const htmlAfterFirst = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
        await quietAsync(() => mod.cacheBust(CONFIG));
        assert.deepStrictEqual(fs.readdirSync(mediaDir).sort(), listingAfterFirst, '二次运行不得追加哈希');
        assert.strictEqual(
          fs.readFileSync(path.join(dir, 'index.html'), 'utf-8'),
          htmlAfterFirst,
          '二次运行不得改写 HTML 引用'
        );
        return true;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    }));
  });
});

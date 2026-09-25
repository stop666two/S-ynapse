'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSbom, integrityToHex, purlFor, generateSbom } = require('./sbom');

const ROOT = path.join(__dirname, '..');
const FIXTURE_LOCK = {
  lockfileVersion: 3,
  packages: {
    '': { name: 's-ynapse', version: '1.0.2' },
    'node_modules/zlib': { version: '2.0.0', integrity: 'sha512-aGVsbG8=' },
    'node_modules/@scope/a': { version: '1.0.0', integrity: 'sha512-aGVsbG8=' },
    'node_modules/parent/node_modules/zlib': { version: '2.0.0', integrity: 'sha512-aGVsbG8=' },
    'node_modules/no-integrity': { version: '0.1.0' }
  }
};

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbom-'));
  return path.join(dir, 'sbom.cdx.json');
}

describe('integrityToHex', () => {
  it('将 sha512 base64 integrity 转为十六进制', () => {
    assert.deepStrictEqual(integrityToHex('sha512-aGVsbG8='), { alg: 'SHA-512', content: '68656c6c6f' });
  });
  it('支持 sha256/sha384/sha1 算法映射', () => {
    assert.strictEqual(integrityToHex('sha256-aGVsbG8=').alg, 'SHA-256');
    assert.strictEqual(integrityToHex('sha384-aGVsbG8=').alg, 'SHA-384');
    assert.strictEqual(integrityToHex('sha1-aGVsbG8=').alg, 'SHA-1');
  });
  it('缺失、未知算法或畸形内容返回 null', () => {
    assert.strictEqual(integrityToHex(''), null);
    assert.strictEqual(integrityToHex(undefined), null);
    assert.strictEqual(integrityToHex('md5-aGVsbG8='), null);
    assert.strictEqual(integrityToHex('sha512-'), null);
    assert.strictEqual(integrityToHex('sha512-not base64!!'), null);
  });
});

describe('purlFor', () => {
  it('普通包使用 pkg:npm/<name>@<version>', () => {
    assert.strictEqual(purlFor('marked', '12.0.2'), 'pkg:npm/marked@12.0.2');
  });
  it('作用域包的 @ 按 purl 规范编码为 %40', () => {
    assert.strictEqual(purlFor('@scope/pkg', '1.0.0'), 'pkg:npm/%40scope/pkg@1.0.0');
  });
});

describe('buildSbom', () => {
  const bom = buildSbom(FIXTURE_LOCK, { name: 's-ynapse', version: '1.0.2' }, {
    serialNumber: 'urn:uuid:00000000-0000-4000-8000-000000000000',
    timestamp: '2026-01-01T00:00:00.000Z'
  });

  it('顶层字段符合 CycloneDX 1.5 最小结构', () => {
    assert.strictEqual(bom.bomFormat, 'CycloneDX');
    assert.strictEqual(bom.specVersion, '1.5');
    assert.strictEqual(bom.version, 1);
    assert.strictEqual(bom.serialNumber, 'urn:uuid:00000000-0000-4000-8000-000000000000');
    assert.strictEqual(bom.metadata.timestamp, '2026-01-01T00:00:00.000Z');
    assert.strictEqual(bom.metadata.component.type, 'application');
    assert.strictEqual(bom.metadata.component.name, 's-ynapse');
    assert.strictEqual(bom.metadata.component.version, '1.0.2');
  });

  it('组件数与 lock 非根包数一致，且根条目不计入', () => {
    assert.strictEqual(bom.components.length, Object.keys(FIXTURE_LOCK.packages).length - 1);
    assert.ok(!bom.components.some((c) => c.name === 's-ynapse' && c.type === 'library'));
  });

  it('每个依赖含 type/name/version/purl/bom-ref，无 integrity 则省略 hashes', () => {
    for (const component of bom.components) {
      assert.strictEqual(component.type, 'library');
      assert.ok(component.name);
      assert.ok(component.version);
      assert.match(component.purl, /^pkg:npm\//);
      assert.ok(component['bom-ref']);
    }
    const noIntegrity = bom.components.find((c) => c.name === 'no-integrity');
    assert.ok(!('hashes' in noIntegrity));
  });

  it('hash 为 SHA-512 且内容与 integrity 一致', () => {
    const zlib = bom.components.find((c) => c.name === 'zlib');
    assert.deepStrictEqual(zlib.hashes, [{ alg: 'SHA-512', content: '68656c6c6f' }]);
  });

  it('同名同版本的去重 bom-ref 唯一且稳定', () => {
    const refs = bom.components.map((c) => c['bom-ref']);
    assert.strictEqual(new Set(refs).size, refs.length);
    const zlibRefs = bom.components.filter((c) => c.name === 'zlib').map((c) => c['bom-ref']);
    assert.deepStrictEqual(zlibRefs, ['pkg:npm/zlib@2.0.0', 'pkg:npm/zlib@2.0.0#2']);
  });

  it('组件按 name/version 稳定排序', () => {
    const keys = bom.components.map((c) => c.name + '@' + c.version);
    assert.deepStrictEqual(keys, [...keys].sort());
    assert.deepStrictEqual(keys, ['@scope/a@1.0.0', 'no-integrity@0.1.0', 'zlib@2.0.0', 'zlib@2.0.0']);
  });

  it('序列化后可解析且未传序列号时生成合法 urn:uuid', () => {
    const parsed = JSON.parse(JSON.stringify(bom));
    assert.strictEqual(parsed.components.length, bom.components.length);
    const auto = buildSbom(FIXTURE_LOCK, { name: 's-ynapse', version: '1.0.2' });
    assert.match(auto.serialNumber, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('真实 lock 的组件数一致、purl 合法、bom-ref 全局唯一', () => {
    const lock = require('../package-lock.json');
    const pkg = require('../package.json');
    const real = buildSbom(lock, pkg, { timestamp: '2026-01-01T00:00:00.000Z' });
    assert.strictEqual(real.components.length, Object.keys(lock.packages).length - 1);
    for (const component of real.components) {
      assert.match(component.purl, /^pkg:npm\/(%40)?[^@]+@[^@]+$/);
    }
    const refs = real.components.map((c) => c['bom-ref']);
    assert.strictEqual(new Set(refs).size, refs.length);
  });
});

describe('generateSbom', () => {
  it('读取项目 lock 并写出可解析的 SBOM 文件', () => {
    const out = tmpFile();
    const result = generateSbom({ root: ROOT, out, timestamp: '2026-01-01T00:00:00.000Z' });
    assert.strictEqual(result.file, out);
    const lock = require('../package-lock.json');
    assert.strictEqual(result.components, Object.keys(lock.packages).length - 1);
    const parsed = JSON.parse(fs.readFileSync(out, 'utf-8'));
    assert.strictEqual(parsed.bomFormat, 'CycloneDX');
    assert.strictEqual(parsed.components.length, result.components);
  });
});

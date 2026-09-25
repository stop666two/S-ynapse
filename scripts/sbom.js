'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeFileAtomicSync } = require('./lib/atomic-write');

const PROJECT_ROOT = path.join(__dirname, '..');
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'build-artifacts', 'sbom.cdx.json');
const SPEC_VERSION = '1.5';
const HASH_ALGORITHMS = Object.freeze({
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512'
});

function integrityToHex(integrity) {
  const text = String(integrity || '');
  const separator = text.indexOf('-');
  if (separator <= 0) return null;
  const alg = HASH_ALGORITHMS[text.slice(0, separator).toLowerCase()];
  if (!alg) return null;
  const encoded = text.slice(separator + 1);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  return { alg, content: Buffer.from(encoded, 'base64').toString('hex') };
}

function purlFor(name, version) {
  const raw = String(name);
  const encoded = raw.startsWith('@') ? '%40' + raw.slice(1) : raw;
  return 'pkg:npm/' + encoded + '@' + String(version);
}

function componentName(lockKey, entry) {
  if (entry && entry.name) return entry.name;
  const marker = 'node_modules/';
  const index = lockKey.lastIndexOf(marker);
  return index >= 0 ? lockKey.slice(index + marker.length) : lockKey;
}

function buildComponents(lock) {
  const packages = (lock && lock.packages) || {};
  const refCounts = new Map();
  const components = [];
  for (const lockKey of Object.keys(packages)) {
    if (!lockKey) continue;
    const entry = packages[lockKey] || {};
    const name = componentName(lockKey, entry);
    const version = String(entry.version || '0.0.0');
    const purl = purlFor(name, version);
    const seen = (refCounts.get(purl) || 0) + 1;
    refCounts.set(purl, seen);
    const component = {
      type: 'library',
      name,
      version,
      purl,
      'bom-ref': seen === 1 ? purl : purl + '#' + seen
    };
    const hash = integrityToHex(entry.integrity);
    if (hash) component.hashes = [hash];
    components.push(component);
  }
  components.sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    if (a.version !== b.version) return a.version < b.version ? -1 : 1;
    if (a['bom-ref'] !== b['bom-ref']) return a['bom-ref'] < b['bom-ref'] ? -1 : 1;
    return 0;
  });
  return components;
}

function buildSbom(lock, rootPkg, options) {
  const opts = options || {};
  const pkg = rootPkg || {};
  const name = pkg.name || 's-ynapse';
  const version = String(pkg.version || '0.0.0');
  const rootRef = purlFor(name, version);
  return {
    bomFormat: 'CycloneDX',
    specVersion: SPEC_VERSION,
    serialNumber: opts.serialNumber || 'urn:uuid:' + crypto.randomUUID(),
    version: 1,
    metadata: {
      timestamp: opts.timestamp || new Date().toISOString(),
      component: {
        type: 'application',
        name,
        version,
        purl: rootRef,
        'bom-ref': rootRef
      }
    },
    components: buildComponents(lock)
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function generateSbom(options) {
  const opts = options || {};
  const root = opts.root || PROJECT_ROOT;
  const lock = opts.lock || readJson(path.join(root, 'package-lock.json'));
  const rootPkg = opts.rootPackage || readJson(path.join(root, 'package.json'));
  const out = opts.out || DEFAULT_OUTPUT;
  const bom = buildSbom(lock, rootPkg, opts);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeFileAtomicSync(out, JSON.stringify(bom, null, 2) + '\n');
  return { file: out, components: bom.components.length, serialNumber: bom.serialNumber };
}

if (require.main === module) {
  try {
    const result = generateSbom();
    console.log('[sbom] CycloneDX ' + SPEC_VERSION + '：' + result.components + ' 个组件 → ' + result.file);
  } catch (err) {
    console.error('[sbom] 生成失败：' + (err && err.message ? err.message : err));
    process.exitCode = 1;
  }
}

module.exports = { buildSbom, buildComponents, integrityToHex, purlFor, generateSbom, DEFAULT_OUTPUT };

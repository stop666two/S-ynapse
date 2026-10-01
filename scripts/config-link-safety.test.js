'use strict';
// URL 型配置出口的危险协议校验：所有会进入 <a href>/<script src>/<link href>/window.open
// 的配置值拒绝 javascript:/vbscript:/data:；合法 https 与站内相对路径放行。
// 运行：node --test scripts/config-link-safety.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const json5 = require('json5');
const deepmerge = require('deepmerge');
const { createConfigModule } = require('./build/config.js');

const BAD = 'javascript:alert(1)';

function makeModule() {
  return createConfigModule({
    rootDir: __dirname,
    watchMode: true,
    getJson5: () => json5,
    getDeepmerge: () => deepmerge,
    getVendorFonts: () => ({}),
    buildCspTrimContext: () => ({})
  });
}

function baseConfig() {
  return {
    site: {
      title: 'T', url: 'https://example.test', language: 'zh-CN', postsPerPage: 10,
      social: { items: {} }, performance: { preconnect: [] }, hero: {}, reward: { custom: [] },
      authorProfile: { socials: [] }, rss: { enabled: false }, sitemap: { enabled: false },
      pwa: { enabled: false }
    },
    theme: { tiers: {} },
    navigation: { menu: [] },
    footer: {},
    sidebar: { enabled: false, widgets: [] },
    security: { csp: { enabled: false, directives: {} } },
    features: {},
    friends: { friends: [] },
    guard: { contextMenu: {} }
  };
}

function capture(fn) {
  const logs = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  try {
    return { ok: fn(), logs: logs.join('\n') };
  } finally {
    Object.assign(console, orig);
  }
}

test('危险协议（javascript/vbscript/data）一律拒绝并定位出口', () => {
  for (const bad of ['javascript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>']) {
    const mod = makeModule();
    const config = baseConfig();
    config.theme.externalAssets = { scripts: [bad] };
    const { ok, logs } = capture(() => mod.validateConfig(config));
    assert.strictEqual(ok, false, bad + ' 必须阻断构建');
    assert.ok(logs.includes('theme.externalAssets.scripts[0]'), '错误须定位出口：\n' + logs);
  }
});

test('全部 URL 出口均拒绝危险协议', () => {
  const cases = [
    ['navigation.menu[0].url', (c) => c.navigation.menu.push({ label: 'x', url: BAD })],
    ['site.social.items.bad.url', (c) => { c.site.social.items.bad = { url: BAD }; }],
    ['footer.bottomLinks.items[0].url', (c) => { c.footer.bottomLinks = { items: [{ label: 'x', url: BAD }] }; }],
    ['footer.columnItems.items[0].links[0].url', (c) => { c.footer.columnItems = { items: [{ title: 'x', links: [{ label: 'y', url: BAD }] }] }; }],
    ['theme.externalAssets.styles[0]', (c) => { c.theme.externalAssets = { styles: [BAD] }; }],
    ['theme.externalAssets.styles[0].href', (c) => { c.theme.externalAssets = { styles: [{ href: BAD }] }; }],
    ['theme.externalAssets.scripts[0].src', (c) => { c.theme.externalAssets = { scripts: [{ src: BAD }] }; }],
    ['site.performance.preconnect[0]', (c) => { c.site.performance.preconnect = [BAD]; }],
    ['site.repoUrl', (c) => { c.site.repoUrl = BAD; }],
    ['site.hero.ctaUrl', (c) => { c.site.hero.ctaUrl = BAD; }],
    ['site.authorProfile.socials[0].url', (c) => { c.site.authorProfile.socials = [{ label: 's', url: BAD }]; }],
    ['site.reward.wechat.url', (c) => { c.site.reward.wechat = { url: BAD }; }],
    ['site.reward.alipay.url', (c) => { c.site.reward.alipay = { url: BAD }; }],
    ['site.reward.custom[0].url', (c) => { c.site.reward.custom = [{ label: 'x', url: BAD }]; }],
    ['friends.friends[0].url', (c) => { c.friends.friends = [{ name: 'f', url: BAD }]; }],
    ['features.hero.ctaUrl', (c) => { c.features.hero = { ctaUrl: BAD }; }],
    ['features.stats.linkArchive', (c) => { c.features.stats = { linkArchive: BAD }; }],
    ['features.subscribe.newsletterUrl', (c) => { c.features.subscribe = { newsletterUrl: BAD }; }],
    ['features.announcement.url', (c) => { c.features.announcement = { url: BAD }; }],
    ['features.announcement.items[0].url', (c) => { c.features.announcement = { items: [{ text: 'x', url: BAD }] }; }],
    ['features.reward.links[0].url', (c) => { c.features.reward = { links: [{ label: 'x', url: BAD }] }; }],
    ['features.analytics.scriptSrc', (c) => { c.features.analytics = { scriptSrc: BAD }; }],
    ['guard.contextMenu.translateUrl', (c) => { c.guard.contextMenu.translateUrl = BAD; }]
  ];
  for (const [label, mutate] of cases) {
    const mod = makeModule();
    const config = baseConfig();
    mutate(config);
    const { ok, logs } = capture(() => mod.validateConfig(config));
    assert.strictEqual(ok, false, label + ' 必须阻断构建');
    assert.ok(logs.includes(label), '错误须定位 ' + label + '：\n' + logs);
  }
});

test('合法 https 与站内相对路径全部放行', () => {
  const mod = makeModule();
  const config = baseConfig();
  config.site.repoUrl = 'https://github.com/stop666two/S-ynapse';
  config.site.hero.ctaUrl = '#latest-post';
  config.site.authorProfile.socials = [{ label: 'GitHub', url: 'https://github.com/x' }];
  config.site.reward.wechat = { url: 'https://pay.example.test/wechat' };
  config.site.reward.custom = [{ url: '/pay/custom' }];
  config.site.social.items.email = { url: 'mailto:admin@example.test' };
  config.site.performance.preconnect = ['https://fonts.gstatic.com'];
  config.navigation.menu = [{ label: '首页', url: '/' }];
  config.footer.bottomLinks = { items: [{ label: 'RSS', url: '/feed.xml' }] };
  config.footer.columnItems = { items: [{ links: [{ label: '关于', url: '/about' }] }] };
  config.theme.externalAssets = {
    styles: ['https://fonts.googleapis.com/css2?family=Noto+Sans+SC', { href: '/assets/vendor/fonts/fonts.css' }],
    scripts: ['/assets/vendor/prism.js', { src: 'https://cdn.example.test/lib.js' }]
  };
  config.friends.friends = [{ url: 'https://example.com' }];
  config.features.hero = { ctaUrl: '/start' };
  config.features.stats = { linkArchive: '/archive/' };
  config.features.subscribe = { newsletterUrl: 'https://news.example.test/sub' };
  config.features.announcement = { url: '/notice', items: [{ url: 'https://example.test/n' }] };
  config.features.reward = { links: [{ url: 'https://pay.example.test/x' }] };
  config.features.analytics = { scriptSrc: 'https://static.cloudflareinsights.com/beacon.min.js' };
  config.guard.contextMenu.translateUrl = 'https://translate.google.com/translate?sl=auto&tl={lang}&text={text}';
  const { ok, logs } = capture(() => mod.validateConfig(config));
  assert.strictEqual(ok, true, '合法 URL 不得被拦截：\n' + logs);
});

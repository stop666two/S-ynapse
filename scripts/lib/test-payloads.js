'use strict';
// 恶意/畸形载荷语料库：按类别导出静态载荷常量与随机生成器，供 fuzz/冒烟测试消费。
// 策略语义：
//   hard-fail：必须被拒绝（预校验阻断 / 抛错），绝不能产出带缺陷的产物；
//   degrade  ：必须不崩溃地跳过/降级并留下可观测告警，允许产出可用产物。
// 载荷形态 kind：text（字符串）/ bytes（字节数组）/ json5（配置文本）/ scenario（需测试侧构造环境）。

const POLICY_HARD_FAIL = 'hard-fail';
const POLICY_DEGRADE = 'degrade';

const CATEGORIES = Object.freeze([
  'oversize',
  'xss',
  'traversal',
  'bad-json5',
  'empty-site',
  'encoding',
  'media',
  'dates-slugs',
  'unicode',
  'io-failure'
]);

const XSS_PAYLOADS = [
  { id: 'xss-script-tag', value: '<script>alert(1)</script>', note: '经典 script 注入，必须整体移除' },
  { id: 'xss-img-onerror', value: '<img src=x onerror=alert(1)>', note: '事件属性不得保留' },
  { id: 'xss-js-url', value: '[点我](javascript:alert(1))', note: 'javascript: 协议链接必须被消毒' },
  { id: 'xss-attr-escape', value: '"><svg/onload=alert(1)>', note: '引号逃逸后接 SVG 事件' },
  { id: 'xss-attr-break', value: '" onmouseover="alert(1)', note: '属性上下文逃逸' },
  { id: 'xss-jsonld', value: '</script><script>alert(1)</script>', note: 'JSON-LD/内联脚本闭合注入' },
  { id: 'xss-iframe', value: '<iframe srcdoc="<script>alert(1)</script>"></iframe>', note: 'iframe 整体移除' },
  { id: 'xss-mxss', value: '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>', note: 'mXSS 混淆解析路径' },
  { id: 'xss-data-url', value: '[x](data:text/html,<script>alert(1)</script>)', note: 'data: 协议不在白名单' },
  { id: 'xss-title-field', value: '<script>alert(document.domain)</script>', note: '标题字段注入（meta/OG/JSON-LD 全出口）' }
];

const TRAVERSAL_PAYLOADS = [
  { id: 'path-dotdot', value: '../etc/passwd', note: '父目录遍历' },
  { id: 'path-dotdot-win', value: '..\\windows\\system32\\config', note: 'Windows 反斜杠遍历' },
  { id: 'path-absolute', value: '/etc/shadow', note: 'POSIX 绝对路径' },
  { id: 'path-drive', value: 'C:\\Windows\\system.ini', note: 'Windows 盘符路径' },
  { id: 'path-encoded', value: '%2e%2e%2f%2e%2e%2fetc', note: 'URL 编码遍历' },
  { id: 'path-double-encoded', value: '%252e%252e%252f', note: '双重编码遍历' },
  { id: 'path-mixed', value: '....//....//etc', note: '混合片段绕过' },
  { id: 'path-reserved-con', value: 'CON', note: 'Windows 保留设备名' },
  { id: 'path-reserved-nul', value: 'NUL', note: 'Windows 保留设备名' },
  { id: 'path-reserved-prn', value: 'PRN.txt', note: '保留名带扩展名' },
  { id: 'path-reserved-com1', value: 'COM1', note: '串口保留名' },
  { id: 'path-long', value: 'a'.repeat(300), note: '超过 120 字符上限' },
  { id: 'path-trailing-dot', value: 'name.', note: 'Windows 尾点归一化' },
  { id: 'path-trailing-space', value: 'name ', note: 'Windows 尾空格归一化' }
];

const BAD_JSON5_PAYLOADS = [
  { id: 'json5-bare-value', value: '{ title: untitled }', note: '字符串值缺引号（语法非法）' },
  { id: 'json5-unterminated-string', value: '{ title: "unterminated }', note: '未闭合字符串' },
  { id: 'json5-unclosed-object', value: '{ title: \'x\', ', note: '对象未闭合' },
  { id: 'json5-missing-comma', value: '{ a: 1 b: 2 }', note: '键值之间缺逗号' },
  { id: 'json5-bad-number', value: '{ a: 0xZZ }', note: '非法数字字面量' },
  { id: 'json5-mismatched-bracket', value: '{ a: [1, 2 }', note: '括号不匹配' },
  { id: 'json5-duplicate-key', value: '{ a: 1, a: 2 }', note: 'JSON5 合法但项目重复键守卫必须报告' },
  { id: 'json5-type-drift', value: '{ title: 123, enabled: "yes" }', note: '类型漂移（schema 校验必须拒绝）' },
  { id: 'json5-root-array', value: '[1, 2, 3]', note: '根节点形态错误' },
  { id: 'json5-root-null', value: 'null', note: '根节点为 null' }
];

const ENCODING_PAYLOADS = [
  { id: 'enc-bom', kind: 'text', value: '\uFEFF# 带 BOM 的标题', note: 'UTF-8 BOM 必须被容忍（内容验证对齐 U+FEFF 语义）' },
  { id: 'enc-crlf', kind: 'text', value: '第一行\r\n第二行\r\n', note: 'CRLF 换行' },
  { id: 'enc-mixed-newline', kind: 'text', value: 'a\nb\r\nc\rd', note: 'LF/CRLF/CR 混合' },
  { id: 'enc-lone-cr', kind: 'text', value: 'a\rb', note: '孤立 CR（旧 Mac 风格）' },
  { id: 'enc-lone-surrogate', kind: 'text', value: 'front\uD800matter', note: '孤立代理写盘时应转为 U+FFFD 而非崩溃' },
  { id: 'enc-invalid-utf8-1', kind: 'bytes', value: [0xc3, 0x28], note: '截断的 2 字节序列' },
  { id: 'enc-invalid-utf8-2', kind: 'bytes', value: [0xe2, 0x82], note: '截断的 3 字节序列（€ 前缀）' },
  { id: 'enc-invalid-utf8-3', kind: 'bytes', value: [0xff, 0xfe, 0x00, 0x00], note: 'UTF-16 BOM 伪字节' },
  { id: 'enc-invalid-utf8-4', kind: 'bytes', value: [0x80, 0x80, 0x80], note: '孤立续字节' },
  { id: 'enc-nul-byte', kind: 'bytes', value: [0x61, 0x00, 0x62], note: '内嵌 NUL' }
];

const MEDIA_PAYLOADS = [
  { id: 'media-truncated-png', kind: 'bytes', value: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49], note: 'PNG 签名后截断' },
  { id: 'media-gif-as-png', kind: 'bytes', value: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00], note: '内容与扩展名不符' },
  { id: 'media-zero-bytes', kind: 'bytes', value: [], note: '零字节媒体文件' },
  { id: 'media-text-as-jpg', kind: 'text', value: 'this is not an image', note: '文本伪装图片' },
  { id: 'media-oversize-ihdr', kind: 'bytes', value: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x7f, 0xff, 0xff, 0xff, 0x7f, 0xff, 0xff, 0xff], note: 'IHDR 声明超大尺寸，处理必须限幅/降级' }
];

const DATES_SLUGS_PAYLOADS = [
  { id: 'date-invalid-month', kind: 'text', value: '2026-13-45', note: '月份/日越界必须预校验阻断' },
  { id: 'date-garbage', kind: 'text', value: 'not-a-date', note: '非日期字符串必须阻断' },
  { id: 'date-slash-format', kind: 'text', value: '2026/01/01', note: 'V8 宽松解析可接受，属兼容路径' },
  { id: 'date-future', kind: 'text', value: '2999-01-01', note: '显式未来日期按定时发布处理（排除并提示）' },
  { id: 'date-leap-second', kind: 'text', value: '2026-06-30T23:59:60Z', note: 'ECMAScript 允许闰秒进位' },
  { id: 'slug-empty', kind: 'text', value: '', note: '空 slug 必须被拒绝（validateSlug）' },
  { id: 'slug-whitespace', kind: 'text', value: '   ', note: '纯空白 slug 必须被拒绝' },
  { id: 'slug-reserved-tags', kind: 'text', value: 'tags', note: '保留路径段 tags，与标签页目录冲突' },
  { id: 'slug-reserved-categories', kind: 'text', value: 'categories', note: '保留路径段 categories' },
  { id: 'slug-reserved-assets', kind: 'text', value: 'assets', note: '保留路径段 assets' },
  { id: 'slug-reserved-search', kind: 'text', value: 'search', note: '保留路径段 search' },
  { id: 'slug-duplicate', kind: 'scenario', scenario: 'duplicate-slug', note: '同语言两篇文章解析出同一 slug，必须预校验阻断' }
];

const UNICODE_PAYLOADS = [
  { id: 'uni-emoji', kind: 'text', value: '🎉 发布庆祝', note: 'emoji 标题：safeSlug 确定性哈希兜底' },
  { id: 'uni-zwj-family', kind: 'text', value: '👨‍👩‍👧‍👦 全家福', note: 'ZWJ 组合序列不得被腰斩' },
  { id: 'uni-rtl-override', kind: 'text', value: '\u202Egnp.exe\u202C', note: 'RTL 覆盖字符：输出必须保持字符原义' },
  { id: 'uni-bidi-arabic', kind: 'text', value: 'مرحبا بالعالم — hello', note: '双向文本混排' },
  { id: 'uni-combining', kind: 'text', value: 'e\u0301\u0301\u0301 组合变音符', note: '组合字符不得被错误归一化破坏' },
  { id: 'uni-zero-width', kind: 'text', value: 'a\u200Bb\u200Dc', note: '零宽字符' },
  { id: 'uni-cjk-ext', kind: 'text', value: '𠀀𠀁𠀂 扩展区汉字', note: 'CJK 扩展 B 区（surrogate pair）' },
  { id: 'uni-nbsp', kind: 'text', value: 'a\u00A0b', note: '不换行空格' }
];

const IO_FAILURE_SCENARIOS = [
  { id: 'io-readonly-target', kind: 'scenario', scenario: 'readonly-file', note: '目标文件只读：原子写必须显式失败，不得静默跳过' },
  { id: 'io-target-is-directory', kind: 'scenario', scenario: 'directory-target', note: '目标路径是目录：写入抛 EISDIR/EPERM' },
  { id: 'io-parent-is-file', kind: 'scenario', scenario: 'file-as-parent', note: '父路径是文件：ENOTDIR' },
  { id: 'io-enospc-simulated', kind: 'scenario', scenario: 'enospc', note: '磁盘写满无法真实复现：按注入错误码断言错误传播与告警' },
  { id: 'io-rename-cross-device', kind: 'scenario', scenario: 'cross-device', note: '原子 rename 跨设备：必须回退为复制+删除或显式失败' }
];

// 静态载荷全集（生成器另行提供超长/海量样本）。
const STATIC_PAYLOADS = [
  ...XSS_PAYLOADS.map((item) => Object.assign({ category: 'xss', kind: item.kind || 'text', policy: POLICY_HARD_FAIL }, item)),
  ...TRAVERSAL_PAYLOADS.map((item) => Object.assign({ category: 'traversal', kind: 'text', policy: POLICY_HARD_FAIL }, item)),
  ...BAD_JSON5_PAYLOADS.map((item) => Object.assign({ category: 'bad-json5', kind: 'json5', policy: POLICY_HARD_FAIL }, item)),
  ...ENCODING_PAYLOADS.map((item) => Object.assign({ category: 'encoding', policy: POLICY_DEGRADE, kind: item.kind || 'text' }, item)),
  ...MEDIA_PAYLOADS.map((item) => Object.assign({ category: 'media', policy: POLICY_DEGRADE, kind: item.kind || 'bytes' }, item)),
  ...DATES_SLUGS_PAYLOADS.map((item) => Object.assign({ category: 'dates-slugs', policy: item.id === 'date-future' || item.id === 'date-slash-format' || item.id === 'date-leap-second' ? POLICY_DEGRADE : POLICY_HARD_FAIL, kind: item.kind || 'text' }, item)),
  ...UNICODE_PAYLOADS.map((item) => Object.assign({ category: 'unicode', policy: POLICY_DEGRADE, kind: item.kind || 'text' }, item)),
  ...IO_FAILURE_SCENARIOS.map((item) => Object.assign({ category: 'io-failure', policy: POLICY_DEGRADE, kind: 'scenario' }, item))
];

const EMPTY_SITE_PAYLOADS = [
  { id: 'empty-article-body', category: 'empty-site', kind: 'text', policy: POLICY_DEGRADE, value: '', note: '正文为空：构建必须成功（不产出空卡片崩坏）' },
  { id: 'empty-frontmatter', category: 'empty-site', kind: 'text', policy: POLICY_DEGRADE, value: '---\n---\n', note: '空 frontmatter：标题回退文件名' },
  { id: 'empty-config', category: 'empty-site', kind: 'json5', policy: POLICY_DEGRADE, value: '{}', note: '空配置对象：应回退默认值' },
  { id: 'empty-blank-page', category: 'empty-site', kind: 'text', policy: POLICY_DEGRADE, value: '   \n\t\n', note: '全空白页面' },
  { id: 'empty-taxonomy-arrays', category: 'empty-site', kind: 'text', policy: POLICY_DEGRADE, value: 'tags: []\ncategories: []', note: '空标签数组合法' }
];

const OVERSIZE_SPECS = Object.freeze({
  titleLength: 10000,
  titleLengthStress: 1000000,
  bodyLength: 200000,
  bodyLengthStress: 5000000,
  tagCount: 500,
  tagCountStress: 20000,
  articleCount: 20,
  articleCountStress: 500,
  slugCount: 1000
});

const LONG_TEXT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n\t-_.<>"\'&/\\{}[]():;中文字符测试🎉';

/**
 * 生成指定长度的随机文本（确定性：同一 rng 序列产生同一结果）。
 * @param {{ int: (min: number, max: number) => number, pick: <T>(items: T[]) => T }} rng
 * @param {number} length
 * @returns {string}
 */
function generateLongText(rng, length) {
  const parts = [];
  for (let i = 0; i < length; i++) parts.push(LONG_TEXT_ALPHABET[rng.int(0, LONG_TEXT_ALPHABET.length - 1)]);
  return parts.join('');
}

const TRAVERSAL_FRAGMENTS = ['..', '/', '\\', '%2e', '%2f', '....', 'etc', 'windows', 'system32', 'C:', 'CON', 'NUL', '\u0000', 'a'];

/**
 * 生成随机的路径遍历尝试串。
 * @param {{ int: (min: number, max: number) => number, pick: <T>(items: T[]) => T }} rng
 * @returns {string}
 */
function generateTraversalSlug(rng) {
  const count = rng.int(1, 6);
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(rng.pick(TRAVERSAL_FRAGMENTS));
  return parts.join('');
}

const XSS_FRAGMENTS = ['<script>', '</script>', 'onerror=', 'onload=', 'alert(1)', 'javascript:', '"', "'", '>', '<img', '<svg', 'src=x', '&#x61;', '%3Cscript%3E', '<iframe', 'data:'];

/**
 * 生成随机的 XSS 组合串。
 * @param {{ int: (min: number, max: number) => number, pick: <T>(items: T[]) => T }} rng
 * @returns {string}
 */
function generateXssPayload(rng) {
  const count = rng.int(2, 8);
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(rng.pick(XSS_FRAGMENTS));
  return parts.join('');
}

/**
 * 生成随机字节序列（模拟损坏媒体/非法编码）。
 * @param {{ int: (min: number, max: number) => number }} rng
 * @param {number} length
 * @returns {number[]}
 */
function generateRandomBytes(rng, length) {
  const out = [];
  for (let i = 0; i < length; i++) out.push(rng.int(0, 255));
  return out;
}

/**
 * 构造超长载荷生成器：按 rng 与是否 STRESS 档产生标题/正文/标签集。
 * @param {{ int: (min: number, max: number) => number, pick: <T>(items: T[]) => T, bool: (p?: number) => boolean }} rng
 * @param {boolean} stress
 * @returns {{ category: string, kind: string, policy: string, id: string, value: unknown, note: string }[]}
 */
function generateOversizeSet(rng, stress) {
  const titleLength = stress ? OVERSIZE_SPECS.titleLengthStress : OVERSIZE_SPECS.titleLength;
  const bodyLength = stress ? OVERSIZE_SPECS.bodyLengthStress : OVERSIZE_SPECS.bodyLength;
  const tagCount = stress ? OVERSIZE_SPECS.tagCountStress : OVERSIZE_SPECS.tagCount;
  return [
    { id: 'oversize-title', category: 'oversize', kind: 'text', policy: POLICY_DEGRADE, value: generateLongText(rng, titleLength), note: '超长标题须截断/哈希降级不崩溃' },
    { id: 'oversize-body', category: 'oversize', kind: 'text', policy: POLICY_DEGRADE, value: generateLongText(rng, bodyLength), note: '超长正文须限制内存增长' },
    { id: 'oversize-slug', category: 'oversize', kind: 'text', policy: POLICY_HARD_FAIL, value: 'x'.repeat(Math.max(121, titleLength)), note: '显式超长 slug 必须被 validateSlug 拒绝' },
    { id: 'oversize-tags', category: 'oversize', kind: 'text', policy: POLICY_DEGRADE, value: new Array(tagCount).fill(0).map((v, i) => 'tag-' + i).join(','), note: '海量标签须限流/分页不阻塞构建' },
    { id: 'oversize-huge-title', category: 'oversize', kind: 'text', policy: POLICY_DEGRADE, value: '中'.repeat(Math.min(titleLength, 20000)), note: '无分隔符超长 CJK 标题' }
  ];
}

/**
 * 按类别筛选载荷。
 * @param {string} category
 * @returns {object[]}
 */
function byCategory(category) {
  return STATIC_PAYLOADS.filter((item) => item.category === category);
}

/**
 * 按期望策略筛选载荷。
 * @param {string} policy
 * @returns {object[]}
 */
function byPolicy(policy) {
  return STATIC_PAYLOADS.filter((item) => item.policy === policy);
}

/**
 * 全部静态载荷（含空站类别）。
 * @returns {object[]}
 */
function allPayloads() {
  return STATIC_PAYLOADS.concat(EMPTY_SITE_PAYLOADS);
}

module.exports = {
  POLICY_HARD_FAIL,
  POLICY_DEGRADE,
  CATEGORIES,
  OVERSIZE_SPECS,
  STATIC_PAYLOADS,
  XSS_PAYLOADS,
  TRAVERSAL_PAYLOADS,
  BAD_JSON5_PAYLOADS,
  ENCODING_PAYLOADS,
  MEDIA_PAYLOADS,
  DATES_SLUGS_PAYLOADS,
  UNICODE_PAYLOADS,
  IO_FAILURE_SCENARIOS,
  EMPTY_SITE_PAYLOADS,
  generateLongText,
  generateTraversalSlug,
  generateXssPayload,
  generateRandomBytes,
  generateOversizeSet,
  byCategory,
  byPolicy,
  allPayloads
};

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { sanitizeSvg } = require('./lib/content-policy');

// 检测要求属性前必须有空白，于是 `<svg/onload=…>`（斜杠分隔）与
// `<svg:script>`（命名空间前缀）都被判为 safe 并原样发布到 /media/。
// 表格化覆盖：危险形态必须拒绝，同时锁定合法形态不被误杀。
describe('sanitizeSvg', () => {
  const UNSAFE = [
    ['space-separated handler', '<svg onload="alert(1)"><rect/></svg>'],
    ['slash-separated handler', '<svg/onload="alert(1)"><rect/></svg>'],
    ['slash-separated unquoted handler', '<svg/onclick=alert(1)><rect/></svg>'],
    ['mixed-case slash handler', '<svg/OnMouseOver="alert(1)"><rect/></svg>'],
    ['xml namespaced script', '<svg:script>alert(1)</svg:script>'],
    ['namespaced script inside svg', '<svg xmlns:svg="http://www.w3.org/2000/svg"><svg:script>alert(1)</svg:script></svg>'],
    ['self-closing script', '<svg><script/></svg>'],
    ['plain script element', '<svg><script>alert(1)</script></svg>'],
    ['foreignObject', '<svg><foreignObject><div/></foreignObject></svg>'],
    ['entity-encoded javascript scheme', '<svg><a href="&#106;avascript:alert(1)"><rect/></a></svg>'],
    ['external image href', '<svg><image href="https://evil.example/x.png"/></svg>']
  ];

  const SAFE = [
    ['clean icon', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'],
    ['attribute names starting with "on"', '<svg id="onboarding" data-state="on"><rect/></svg>'],
    ['text containing "on ="', '<svg><text x="0" y="10">switch on = safe</text></svg>'],
    ['text containing a script-like word', '<svg><text x="0" y="10">scripture</text></svg>'],
    ['internal fragment reference', '<svg><use xlink:href="#icon"/></svg>']
  ];

  for (const [name, svg] of UNSAFE) {
    it('rejects ' + name, () => {
      const r = sanitizeSvg(svg);
      assert.strictEqual(r.safe, false, name + ' 必须被拒绝: ' + svg);
      assert.strictEqual(r.content, '', name + ' 被拒绝时不得返回内容');
    });
  }

  for (const [name, svg] of SAFE) {
    it('accepts ' + name, () => {
      const r = sanitizeSvg(svg);
      assert.strictEqual(r.safe, true, name + ' 不得被误杀: ' + svg);
      assert.ok(r.content.length > 0);
    });
  }
});

// guard 默认值注册表。
// 用途: scripts/check-config-consistency.js 的结构监守——配置键必须存在于本注册表，
// 防止“配置有键、代码无消费”的死键重现。值允许不同(用户覆盖)，比对只关心结构与类型;
// 空对象 {} 约定为自由映射，监守将跳过其递归。
// 新增配置键时请同步在本文件补键(可从对应 json5 复制结构)。
const DEFAULT_GUARD = {
  "core": {
    "preset": "soft",
    "bypass": {
      "localhost": false,
      "queryParam": "guard",
      "storageFlag": "s-guards-off"
    },
    "logLevel": "off",
    "respectEditable": true,
    "i18nFallbackLang": "zh",
    "edgePadding": "8px"
  },
  "contextMenu": {
    "enabled": true,
    "revokeDelayMs": 3000,
    "translateUrl": "https://translate.google.com/translate?sl=auto&tl={lang}&text={text}",
    "disableNative": true,
    "trigger": {
      "longPress": true,
      "longPressMs": 550
    },
    "searchFocusDelayMs": 60,
    "behavior": {
      "closeOnEsc": true,
      "closeOnScroll": true,
      "closeOnOutside": true,
      "closeOnBlur": true
    },
    "style": {
      "width": "",
      "radius": "",
      "blur": true,
      "animMs": 140,
      "shadowOpacity": 0.18
    },
    "showOn": {
      "selection": true,
      "link": true,
      "image": true,
      "code": true,
      "blank": true
    },
    "builtin": {
      "copy": true,
      "copyLink": true,
      "openNewTab": true,
      "searchSelected": true,
      "translate": true,
      "backToTop": true,
      "toggleTheme": true,
      "print": true,
      "copyCode": true,
      "copyRaw": true,
      "download": true,
      "viewSource": false,
      "inspect": false
    },
    "items": [],
    "excludeSelectors": [],
    "ariaLabel": ""
  },
  "copyGuard": {
    "enabled": true,
    "flashRemoveMs": 600,
    "mode": "attribution",
    "attribution": {
      "text": "—— 原文：{title}\n{url}",
      "textEn": "— From: {title}\n{url}",
      "position": "after",
      "separator": "\n\n",
      "minChars": 40,
      "onlyArticles": true
    },
    "allow": {
      "codeBlocks": true,
      "selectors": []
    },
    "block": {
      "toast": true,
      "toastText": "",
      "flash": false
    },
    "extra": {
      "alsoCut": false,
      "imageNotice": false,
      "iOSOverride": false
    },
    "noticeOncePerSession": true,
    "logCopyEvents": false
  },
  "selectionGuard": {
    "enabled": false,
    "mode": "content",
    "allowSelectors": [],
    "allowCode": true,
    "allowCtrlA": true,
    "allowShiftArrows": true,
    "noticeToast": false,
    "noticeText": ""
  },
  "hotkeyGuard": {
    "enabled": false,
    "keys": {
      "f12": true,
      "ctrlShiftI": true,
      "ctrlShiftJ": true,
      "ctrlShiftC": true,
      "ctrlU": false,
      "ctrlS": false,
      "ctrlP": false,
      "printScreen": false,
      "custom": []
    },
    "noticeToast": true,
    "noticeText": "",
    "noticeOncePerSession": true
  },
  "watermark": {
    "enabled": false,
    "type": "diagonal",
    "text": "{site} · {date}",
    "textEn": "{site} · {date}",
    "identity": "none",
    "idLength": 6,
    "opacity": 0.06,
    "fontSize": "13px",
    "color": "",
    "rotate": -22,
    "gapX": "180px",
    "gapY": "140px",
    "position": "bottom-right",
    "zIndex": 40,
    "hideOnPrint": true,
    "showInLightbox": false,
    "mobileEnabled": false,
    "animate": false
  },
  "devtoolsDetect": {
    "enabled": false,
    "methods": {
      "sizeDiff": true,
      "timingDebugger": false
    },
    "intervalMs": 1500,
    "thresholdSizePx": 160,
    "thresholdTimingMs": 120,
    "action": "notice",
    "noticeText": "",
    "noticeOncePerSession": true,
    "blurAmount": "6px",
    "lockTitle": "开发者工具已打开",
    "lockText": "请关闭开发者工具后继续浏览",
    "reloadDelayMs": 800,
    "pauseWhenHidden": true,
    "logDetect": false
  },
  "consoleGuard": {
    "enabled": false,
    "bannerEnabled": false,
    "bannerText": "本站为静态博客，请勿粘贴执行陌生代码",
    "bannerTextEn": "This is a static blog. Never paste unknown code here.",
    "bannerAscii": false,
    "clearEnabled": false,
    "clearIntervalMs": 2000,
    "clearOnDetect": true,
    "muteEnabled": false,
    "muteMethods": [
      "log",
      "info",
      "debug"
    ],
    "muteFreeze": false,
    "trapEnabled": false,
    "trapAction": "notice",
    "trapText": "",
    "hideSelfLogs": false,
    "noticeOncePerSession": true
  },
  "privacyCurtain": {
    "enabled": false,
    "blurOnBlur": true,
    "blurOnVisibility": true,
    "blurAmount": "8px",
    "curtainText": "已暂停显示",
    "curtainTextEn": "Paused",
    "revealDelayMs": 200,
    "prtScNotice": false,
    "prtScText": "",
    "prtScOncePerSession": true
  },
  "tamperWatch": {
    "enabled": false,
    "scripts": {
      "monitor": true,
      "action": "toast",
      "allowPathPrefixes": [
        "/pagefind/"
      ]
    },
    "attrs": {
      "monitor": false
    },
    "iframes": {
      "monitor": true,
      "action": "toast"
    },
    "prototype": {
      "watch": false
    },
    "dom": {
      "monitor": false,
      "targets": [
        ".site-header",
        ".post-content"
      ]
    },
    "probeIntervalMs": 2000,
    "reportEndpoint": "",
    "reportPrivacyMode": true,
    "reportTimeoutMs": 5000,
    "reportThrottleMs": 10000,
    "cspViolationToast": true,
    "noticeOncePerSession": true,
    "logDetect": false
  },
  "accessGate": {
    "enabled": false,
    "focusDelayMs": 50,
    "password": {
      "enabled": false,
      "hash": "",
      "salt": "",
      "rememberHours": 72,
      "title": "",
      "placeholder": "",
      "errorText": ""
    },
    "paths": [],
    "viewsPerDay": 0,
    "viewsAction": "toast",
    "unlockCodes": [],
    "logDetect": false
  }
};

module.exports = { DEFAULT_GUARD };

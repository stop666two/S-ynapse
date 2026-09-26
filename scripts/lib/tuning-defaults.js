// tuning 默认值注册表。
// 用途: scripts/check-config-consistency.js 的结构监守——配置键必须存在于本注册表，
// 防止“配置有键、代码无消费”的死键重现。值允许不同(用户覆盖)，比对只关心结构与类型;
// 空对象 {} 约定为自由映射，监守将跳过其递归。
// 新增配置键时请同步在本文件补键(可从对应 json5 复制结构)。
const DEFAULT_TUNING = {
  "typography": {
    "bodySize": "1.0625rem",
    "h1Size": "2.058em",
    "h2Size": "1.618em",
    "h3Size": "1.272em",
    "h4Size": "1em",
    "h5Size": ".875em",
    "h6Size": ".8125em",
    "smallSize": ".875em",
    "tinySize": ".75em",
    "lineHeight": "1.8",
    "headingLineHeight": "1.3",
    "letterSpacing": "0.02em",
    "headingWeight": "700",
    "monoSize": ".875em",
    "quoteSize": "1.05em",
    "captionSize": ".8125rem",
    "metaSize": ".875rem",
    "leadSize": "1.272em"
  },
  "layout": {
    "articlePadding": "2rem",
    "containerWidth": "1250px",
    "tocWidth": "200px",
    "gap": "1.618rem",
    "padding": "2.618rem",
    "contentOffset": "-10px",
    "headerContentGap": "48px",
    "tocMinLeft": "10px",
    "sidebarMinRight": "10px",
    "mobileBreakpoint": "768px",
    "tocHideBreakpoint": "900px",
    "tabletBreakpoint": "1024px",
    "maxContentWidth": "1600px",
    "gridCollapseBreakpoint": "640px"
  },
  "radius": {
    "default": "0.618rem",
    "large": "1.618rem",
    "button": "0.382rem",
    "image": "0.618rem",
    "avatar": "50%",
    "badge": "1rem",
    "input": "0.382rem"
  },
  "motion": {
    "hoverLiftPx": "4",
    "hoverScale": "1.02",
    "underlineThickness": "2px",
    "underlineOffset": "3px",
    "rippleDurationMs": "500",
    "revealDurationMs": "250",
    "revealOffset": "10px",
    "staggerDelayMs": "60",
    "buttonPressScale": "0.97",
    "transitionDuration": "0.3s",
    "transitionTiming": "cubic-bezier(0.22, 1, 0.36, 1)"
  },
  "hero": {
    "titleSize": "2.618em",
    "subSize": "1.05em",
    "maxWidth": "760px",
    "actionsGap": ".75rem",
    "tagGap": ".5rem",
    "ctaRadius": "0.382rem",
    "paddingTop": "1rem",
    "paddingBottom": "2rem",
    "dateSize": ".9375rem"
  },
  "card": {
    "imageAspect": "16/10",
    "radius": "0.618rem",
    "padding": "1.5rem",
    "titleSize": "1.272rem",
    "excerptLines": "3",
    "metaSize": ".8125rem",
    "nocoverMinSize": "1.272rem",
    "nocoverMaxSize": "1.618rem",
    "gridGap": "1.618rem",
    "imageHoverScale": "1.02",
    "bentoFeatured": true,
    "bentoAspect": "21/10"
  },
  "toc": {
    "fontSize": ".8125rem",
    "labelSize": ".6875rem",
    "indentL2": ".5rem",
    "indentL3": "1.2rem",
    "indentL4": "1.9rem",
    "progressHeight": "3px",
    "stickyTop": "80px",
    "scrollOffset": "80",
    "collapsedByDefault": "false"
  },
  "search": {
    "overlayPadding": "12vh 1rem 2rem",
    "modalPadding": "2.5rem 2.5rem 2rem",
    "modalMaxHeight": "78vh",
    "closeBtnSize": "36px",
    "modalWidth": "760px",
    "inputHeight": "56px",
    "inputFontSize": "1.375rem",
    "historyCount": "5",
    "hotCount": "5",
    "debounceMs": "120",
    "minQueryLength": "1",
    "excerptLength": "120",
    "resultLimit": "30",
    "emptyText": "未找到匹配内容",
    "emptyTextEn": "No matching content"
  },
  "reading": {
    "progressHeight": "3px",
    "dockBottom": "5.6rem",
    "dockRight": "1.35rem",
    "dockBtnSize": "40px",
    "dockRightTablet": "1rem",
    "dockBottomTablet": "6.4rem",
    "gearBottom": "14.6rem",
    "gearMobileBottom": "10.8rem",
    "panelBottom": "13.2rem",
    "panelWidth": "280px",
    "dockMobileBottom": "14.2rem",
    "ttsRate": "1",
    "ttsPitch": "1",
    "fontSizeStep": "1",
    "lineHeightStep": "0.1",
    "readingMaxWidth": "72ch",
    "quoteTint": "6%",
    "imageHoverScale": "1.01",
    "h2AccentWidth": ".25rem",
    "h2AccentHeight": "1em",
    "h2AccentColor": "var(--color-s)"
  },
  "comments": {
    "avatarSize": "40px",
    "marginTop": "2rem",
    "width": "100%",
    "borderRadius": "0.618rem",
    "dividerShow": "true"
  },
  "header": {
    "height": "60px",
    "logoSize": "1.272em",
    "iconSize": "18px",
    "scrolledHeight": "56px",
    "scrollShrink": true,
    "scrollThresholdPx": "8",
    "hairlineStrength": "30%"
  },
  "pagination": {
    "btnMinWidth": "40px",
    "btnHeight": "40px",
    "maxVisible": "5",
    "gap": ".5rem",
    "activeScale": "1.05",
    "radius": "0.618rem"
  },
  "stats": {
    "numberSize": "1.5rem",
    "labelSize": ".8125rem",
    "cardPadding": "1rem 1.25rem",
    "gap": "1rem",
    "hoverLiftPx": "2px"
  },
  "breadcrumb": {
    "fontSize": ".8125rem",
    "gap": ".4rem",
    "marginBottom": "1rem",
    "currentWeight": "600"
  },
  "share": {
    "btnSize": "32px",
    "gap": ".35rem",
    "iconSize": "16px",
    "radius": ".375rem"
  },
  "prevNext": {
    "thumbSize": "64px",
    "thumbHeight": "44px",
    "gap": "1rem",
    "marginTop": "2rem",
    "titleLines": "1"
  },
  "contactPopup": {
    "iconSize": "30px",
    "radius": "1.618rem",
    "valueFontSize": "1.25rem",
    "titleSize": "1.25rem"
  },
  "reward": {
    "btnFontSize": ".8125rem",
    "popupRadius": "0.618rem",
    "entryGap": ".75rem"
  },
  "dailyQuote": {
    "showAuthor": "true",
    "quoteFontSize": ".95rem",
    "authorFontSize": ".8rem",
    "markSize": "2rem",
    "refreshDaily": "true"
  },
  "tags": {
    "cloudMinSize": ".75rem",
    "cloudMaxSize": "1.25rem",
    "cloudGap": ".5rem",
    "showCount": "true",
    "hoverScale": "1.05"
  },
  "series": {
    "panelRadius": "0.618rem",
    "progressHeight": "4px",
    "badgeColor": "var(--color-s)",
    "panelPadding": "1rem 1.25rem"
  },
  "backToTop": {
    "hiddenOffset": "20px",
    "offsetBottom": "2rem",
    "offsetSide": "2rem"
  },
  "texture": {
    "noiseBaseFrequency": "0.8",
    "noiseOpacity": "0.025",
    "noiseOpacityDark": "0.035"
  },
  "glow": {
    "heroStrength": "8%",
    "heroStrengthDark": "12%"
  },
  "code": {
    "windowDotSize": "11px",
    "borderWidth": "1px",
    "borderMix": "65%",
    "lineNumberColor": "var(--color-tl)",
    "lineNumberOpacity": ".5",
    "hoverBorderMix": "35%",
    "hoverShadowMix": "25%",
    "hoverBgMix": "92%",
    "inlineRadius": "4px",
    "inlineHairlineMix": "70%",
    "diffAddMix": "12%",
    "diffDelMix": "12%"
  },
  "icons": {
    "strokeWidth": "1.75",
    "hoverLift": "1px"
  },
  "morphicons": {
    "stiffness": 420,
    "damping": 30,
    "reducedStiffness": 900,
    "reducedDamping": 55
  },
  "magazine": {
    "dropCapSize": "3.4em",
    "dropCapColor": "var(--color-s)",
    "dropCapWeight": "600",
    "bleedWidth": "4rem",
    "tableHoverMix": "6%",
    "headingNumberColor": "color-mix(in srgb, var(--color-ts) 55%, transparent)"
  },
  "commandPalette": {
    "width": "560px",
    "listMaxHeight": "420px",
    "topOffset": "16vh",
    "backdropMix": "55%"
  },
  "announcement": {
    "fontSize": "0.8125rem",
    "letterSpacing": "0.015em",
    "height": "34px"
  },
  "guard": {
    "menuWidth": "232px",
    "menuRadius": "0.618rem",
    "menuBlur": "10px",
    "itemRadius": "0.382rem",
    "itemGap": "2px",
    "menuMaxHeight": "70vh"
  },
  "loading": {
    "dotSize": "0.55rem",
    "dotGap": "0.45rem",
    "dotLift": "6px",
    "textSize": "0.8125rem",
    "overlayAlpha": "92%",
    "blurPx": "6px",
    "ringSize": "2rem",
    "titleSize": "1rem"
  },
  "mobileToc": {
    "btnBottom": "6rem",
    "btnRight": "2rem",
    "btnMobileBottom": "7.4rem",
    "btnMaxWidth": "340px",
    "labelMaxWidth": "9.5rem"
  },
  "ui": {
    "errorSvgMaxWidth": "460px",
    "errorSuggestMaxWidth": "560px",
    "errorCodeFontSize": "7rem"
  },
  "lightbox": {
    "btnSize": "44px",
    "btnOffset": "14px"
  },
  "toast": {
    "maxWidth": "420px",
    "radius": "999px",
    "offsetBottom": "2rem"
  },
  "zIndex": {
    "header": "1000",
    "mobileNav": "999",
    "announcement": "999",
    "mobileBottomNav": "1200",
    "readingDock": "990",
    "readingGear": "998",
    "readerPanel": "1500",
    "mobileToc": "999",
    "mobileTocDrawer": "1500",
    "kbdHelp": "1500",
    "searchOverlay": "2000",
    "navBoostPanel": "1200",
    "presetPop": "1600",
    "toast": "1200",
    "scrollIndicator": "1100",
    "readingTip": "10000",
    "lightbox": "2000",
    "reward": "1900",
    "linkWarning": "3000",
    "contactPopup": "4000",
    "pwaInstall": "1050",
    "softnavBusy": "2000",
    "grain": "2000",
    "guardMenu": "1900",
    "guardFlash": "1890",
    "guardCurtain": "1880",
    "guardLock": "1895",
    "guardGate": "1898",
    "guardWmOverLightbox": "1700",
    "popupNotice": "2100"
  }
};

module.exports = { DEFAULT_TUNING };

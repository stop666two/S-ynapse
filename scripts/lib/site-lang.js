'use strict';
// 站点语言表解析（构建期单一事实源）：把 site.languages 归一化为非空语言代码数组，
// 并提供默认语言与英文（BCP 47 前缀）判定。各构建模块统一经此读取，避免散落的
// `['zh','en']` 兜底与 `lang === 'en'` 精确比较（`en-US` 等变体同样识别）。

const DEFAULT_LANGS = ['zh', 'en'];

// 归一化语言列表：过滤空值/非字符串；缺失或全空时回退默认双语表。
function siteLanguages(site) {
  const raw = site && Array.isArray(site.languages) ? site.languages : [];
  const list = raw
    .filter((l) => typeof l === 'string' && l.trim() !== '')
    .map((l) => l.trim());
  return list.length ? list : DEFAULT_LANGS.slice();
}

// 默认语言 = 语言表首项（根路径页面与无前缀回退所用）。
function primaryLanguage(site) {
  return siteLanguages(site)[0];
}

// BCP 47 前缀判定：'en' / 'en-US' / 'en-GB' 均为英文；大小写不敏感。
function isEnglish(lang) {
  return /^en\b/i.test(String(lang || ''));
}

function isEnglishPrimary(site) {
  return isEnglish(primaryLanguage(site));
}

module.exports = { DEFAULT_LANGS, siteLanguages, primaryLanguage, isEnglish, isEnglishPrimary };

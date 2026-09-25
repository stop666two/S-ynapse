'use strict';

const FREQUENCIES = ['session', 'day', 'always'];
const BUTTON_STYLES = ['primary', 'ghost'];
const COLOR_KEYS = ['overlay', 'background', 'text', 'textSecondary', 'border', 'primary', 'primaryText', 'ghost'];

function validatePopupNotice(cfg) {
  const errors = [];
  const warnings = [];
  if (cfg == null) return { errors, warnings };
  if (typeof cfg !== 'object' || Array.isArray(cfg)) {
    errors.push('popupNotice must be an object');
    return { errors, warnings };
  }
  if (cfg.enabled != null && typeof cfg.enabled !== 'boolean') errors.push('popupNotice.enabled must be a boolean');
  if (cfg.delayMs != null && (typeof cfg.delayMs !== 'number' || !Number.isFinite(cfg.delayMs) || cfg.delayMs < 0)) {
    errors.push('popupNotice.delayMs must be a non-negative number');
  }
  if (cfg.frequency != null && !FREQUENCIES.includes(cfg.frequency)) {
    errors.push(`popupNotice.frequency must be one of ${FREQUENCIES.join('|')}`);
  }
  if (cfg.reshowOnChange != null && typeof cfg.reshowOnChange !== 'boolean') errors.push('popupNotice.reshowOnChange must be a boolean');
  if (cfg.storageKey != null && (typeof cfg.storageKey !== 'string' || !cfg.storageKey)) errors.push('popupNotice.storageKey must be a non-empty string');
  if (cfg.width != null && typeof cfg.width !== 'string') errors.push('popupNotice.width must be a string');
  if (cfg.closeIcon != null && typeof cfg.closeIcon !== 'boolean') errors.push('popupNotice.closeIcon must be a boolean');
  if (cfg.closeOnBackdrop != null && typeof cfg.closeOnBackdrop !== 'boolean') errors.push('popupNotice.closeOnBackdrop must be a boolean');
  if (cfg.escToClose != null && typeof cfg.escToClose !== 'boolean') errors.push('popupNotice.escToClose must be a boolean');

  if (cfg.buttons != null) {
    if (!Array.isArray(cfg.buttons)) {
      errors.push('popupNotice.buttons must be an array');
    } else {
      cfg.buttons.forEach((b, i) => {
        if (b == null || typeof b !== 'object' || Array.isArray(b)) {
          errors.push(`popupNotice.buttons[${i}] must be an object`);
          return;
        }
        if (!b.label && !b.labelEn) errors.push(`popupNotice.buttons[${i}] needs label or labelEn`);
        if (b.url != null && typeof b.url !== 'string') errors.push(`popupNotice.buttons[${i}].url must be a string`);
        if (b.style != null && !BUTTON_STYLES.includes(b.style)) errors.push(`popupNotice.buttons[${i}].style must be one of ${BUTTON_STYLES.join('|')}`);
      });
    }
  }

  if (cfg.qr != null) {
    if (typeof cfg.qr !== 'object' || Array.isArray(cfg.qr)) {
      errors.push('popupNotice.qr must be an object');
    } else {
      if (cfg.qr.enabled != null && typeof cfg.qr.enabled !== 'boolean') errors.push('popupNotice.qr.enabled must be a boolean');
      if (cfg.qr.enabled === true && !cfg.qr.src) errors.push('popupNotice.qr.src is required when qr.enabled is true');
      if (cfg.qr.src != null && typeof cfg.qr.src !== 'string') errors.push('popupNotice.qr.src must be a string');
    }
  }

  if (cfg.closeButton != null) {
    if (typeof cfg.closeButton !== 'object' || Array.isArray(cfg.closeButton)) {
      errors.push('popupNotice.closeButton must be an object');
    } else if (cfg.closeButton.style != null && !BUTTON_STYLES.includes(cfg.closeButton.style)) {
      errors.push(`popupNotice.closeButton.style must be one of ${BUTTON_STYLES.join('|')}`);
    }
  }

  if (cfg.colors != null) {
    if (typeof cfg.colors !== 'object' || Array.isArray(cfg.colors)) {
      errors.push('popupNotice.colors must be an object');
    } else {
      COLOR_KEYS.forEach((k) => {
        if (cfg.colors[k] != null && typeof cfg.colors[k] !== 'string') errors.push(`popupNotice.colors.${k} must be a string`);
      });
      Object.keys(cfg.colors).forEach((k) => {
        if (!COLOR_KEYS.includes(k)) warnings.push(`popupNotice.colors.${k} 不是已知的配色键（将被忽略）`);
      });
    }
  }

  if (cfg.enabled === true) {
    const hasBody = !!(cfg.title || cfg.titleEn || cfg.body || cfg.bodyEn || cfg.image || (cfg.qr && cfg.qr.src));
    if (!hasBody) warnings.push('popupNotice 已启用但没有任何内容（title/body/image/qr 全为空）');
    if (!Array.isArray(cfg.buttons) || cfg.buttons.length === 0) {
      if (cfg.closeButton && cfg.closeButton.enabled === false && cfg.closeIcon === false && cfg.closeOnBackdrop === false && cfg.escToClose === false) {
        errors.push('popupNotice 已启用但所有关闭方式都被禁用（closeButton/closeIcon/closeOnBackdrop/escToClose）');
      }
    }
  }

  return { errors, warnings };
}

module.exports = { validatePopupNotice, FREQUENCIES, BUTTON_STYLES, COLOR_KEYS };

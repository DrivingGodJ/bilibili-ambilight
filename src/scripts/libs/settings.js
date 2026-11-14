import { on, off, setTimeout, setDisplayErrorHandler } from './generic';
import SettingsConfig, { normalizeTheme, prepareSettingsConfigOnce } from './settings-config';
import { getVersion } from './utils';
import { storage } from './storage';
import { t, setLocale, resolveLocale } from './i18n';

export const FRAMESYNC_DECODEDFRAMES = 0;
export const FRAMESYNC_DISPLAYFRAMES = 1;
export const FRAMESYNC_VIDEOFRAMES = 2;

export const DEBANDING_BLEND_MODE_LCD = 0;
export const DEBANDING_BLEND_MODE_OLED = 1;

const version = getVersion();

// Other settings are renderer defaults, not user preferences. Old values remain
// in storage so reinstalling an earlier version does not erase them.
export default class Settings {
  constructor(ambientlight, menuBtnParent, menuElemParent) {
    this.ambientlight = ambientlight;
    this.menuBtnParent = menuBtnParent;
    this.menuElemParent = menuElemParent;
    return this.init();
  }

  static getStoredSettingsCached = () =>
    (Settings.storagePromise ||= storage.get([
      'setting-enabled', 'setting-theme', 'setting-autoCrop', 'setting-language',
      'setting-detectHorizontalBarSizeEnabled', 'setting-detectVerticalBarSizeEnabled',
      'setting-webGLCrash', 'setting-webGLCrashVersion',
    ], true).catch((error) => {
      Settings.storagePromise = undefined;
      throw error;
    }));

  async init() {
    prepareSettingsConfigOnce();
    for (const { name, default: value } of SettingsConfig) this[name] = value;

    let saved = {};
    try {
      saved = await Settings.getStoredSettingsCached() || {};
    } catch {
      this.setWarning(t('無法載入先前的設定，擴充功能可能已經更新。\n請重新整理頁面再試一次。'));
    }
    const readBool = (value) => value === true || value === 'true';
    this.enabled = saved['setting-enabled'] == null || readBool(saved['setting-enabled']);
    this.theme = normalizeTheme(Number(saved['setting-theme']));
    const oldCrop = [saved['setting-detectHorizontalBarSizeEnabled'], saved['setting-detectVerticalBarSizeEnabled']];
    this.applyAutoCrop(saved['setting-autoCrop'] != null
      ? readBool(saved['setting-autoCrop'])
      : readBool(oldCrop[0]) || (oldCrop[1] == null || readBool(oldCrop[1])));
    // A crash in this version falls back to Canvas2D on the next load.
    if (saved['setting-webGLCrashVersion'] === version && saved['setting-webGLCrash']) {
      this.webGL = false;
      this.webGLCrashDate = new Date(saved['setting-webGLCrash']);
    }
    const language = saved['setting-language'];
    setLocale(resolveLocale(language == null ? undefined : Number(language)));
    this.initMenu();
    if (this.webGLCrashDate) this.updateWebGLCrashDescription();
    if (this.pendingWarning) this.pendingWarning();
    return this;
  }

  applyAutoCrop(value) {
    this.autoCrop = value;
    this.detectHorizontalBarSizeEnabled = value;
    this.detectVerticalBarSizeEnabled = value;
    this.detectVideoFillScaleEnabled = value;
  }

  async toggleAutoCrop(value = !this.autoCrop) {
    this.applyAutoCrop(value);
    this.updateVisibility();
    this.saveStorageEntry('autoCrop', value);
    await this.ambientlight.resetAutoCrop(false);
    if (this.ambientlight.initializedTime) await this.ambientlight.optionalFrame();
  }

  set(name, value, updateUI) {
    const changed = this[name] !== value;
    this[name] = value;
    if (changed && ['enabled', 'theme'].includes(name)) this.saveStorageEntry(name, value);
    if (updateUI) this.updateVisibility();
  }

  saveStorageEntry(name, value) {
    if (Settings.storagePromise) {
      Settings.storagePromise.then((saved) => {
        if (saved) saved['setting-' + name] = value;
      }).catch(() => {});
    }
    // Keep rapid changes in order so the last selection wins.
    this.saveQueue = (this.saveQueue || Promise.resolve())
      .then(() => storage.set('setting-' + name, value, true))
      .catch(() => this.setWarning(t('設定變更太頻繁，無法儲存。\n請稍候幾秒⋯')));
  }

  handleWebGLCrash = () => {
    this.webGL = false;
    this.webGLCrashDate = new Date();
    this.saveStorageEntry('webGLCrash', +this.webGLCrashDate);
    this.saveStorageEntry('webGLCrashVersion', version);
    this.updateWebGLCrashDescription();
  };

  updateWebGLCrashDescription = () => {
    this.setWarning(this.webGLCrashDate ? t('已切換至相容的環境光渲染模式。') : '', !!this.webGLCrashDate, true, 'webgl');
  };

  createMenuElement() {
    const panel = document.createElement('section');
    panel.id = 'ytp-id-190';
    panel.className = 'ytpa-ambientlight-settings-menu ytal-simple-settings';
    panel.setAttribute('aria-labelledby', 'ytal-settings-title');
    panel.innerHTML = `
      <header class="ytal-settings-heading">
        <h2 id="ytal-settings-title"></h2>
      </header>
      <div class="ytal-settings-controls">
        <label class="ytal-settings-row" for="setting-enabled">
          <span><strong></strong><small></small></span>
          <input id="setting-enabled" type="checkbox" role="switch">
        </label>
        <label class="ytal-settings-row" for="setting-autoCrop">
          <span><strong></strong><small></small></span>
          <input id="setting-autoCrop" type="checkbox" role="switch">
        </label>
        <label class="ytal-settings-row" for="setting-theme">
          <span><strong></strong><small></small></span>
          <select id="setting-theme"></select>
        </label>
      </div>
      <div class="ytal-settings-warning" role="status" hidden></div>
    `;
    const labels = [
      ['啟用環境光', '讓影片色彩延伸到播放器四周'],
      ['自動去黑邊', '保護內嵌字幕，裁切後等比放大'],
      ['外觀', '決定影片頁的深淺色主題'],
    ];
    panel.querySelector('h2').textContent = t('環境光');
    panel.querySelectorAll('label').forEach((row, i) => {
      row.querySelector('strong').textContent = t(labels[i][0]);
      row.querySelector('small').textContent = t(labels[i][1]);
    });
    panel.querySelectorAll('small').forEach((description, i) => {
      description.id = 'ytal-setting-description-' + i;
      description.parentElement.nextElementSibling.setAttribute('aria-describedby', description.id);
    });
    this.enableInput = panel.querySelector('#setting-enabled');
    this.cropInput = panel.querySelector('#setting-autoCrop');
    this.themeInput = panel.querySelector('#setting-theme');
    for (const { value, label } of SettingsConfig.find(({ name }) => name === 'theme').snapPoints) {
      this.themeInput.add(new Option(t(label), value));
    }
    this.warningElem = panel.querySelector('.ytal-settings-warning');
    return panel;
  }

  initMenu() {
    this.menuBtn = this.createMenuButton();
    this.menuElem = this.createMenuElement();
    this.menuBtn.setAttribute('aria-controls', this.menuElem.id);
    this.menuBtn.setAttribute('aria-expanded', 'false');
    on(this.menuBtn, 'click', this.onSettingsBtnClicked);
    on(this.enableInput, 'change', async () => {
      await this.ambientlight.toggleEnabled(this.enableInput.checked);
      this.updateVisibility();
    });
    on(this.cropInput, 'change', () => this.toggleAutoCrop(this.cropInput.checked));
    on(this.themeInput, 'change', () => {
      this.set('theme', Number(this.themeInput.value));
      return this.ambientlight.theming.updateTheme(true);
    });
    on(this.menuElem, 'mousedown mouseup pointerdown pointerup click dblclick wheel touchstart touchend', (e) => e.stopPropagation());
    on(this.menuElem, 'keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        this.closeMenu();
        this.menuBtn.focus();
      }
    });
    this.bezelElem = this.createBezelElem();
    this.bezelTextElem = this.bezelElem.querySelector('text');
    this.attachMenuBtn();
    this.attachMenuElems();
    this.updateVisibility();
    setDisplayErrorHandler(this.onError);
  }

  updateVisibility() {
    if (!this.menuElem) return;
    this.enableInput.checked = this.enabled;
    this.cropInput.checked = this.autoCrop;
    this.themeInput.value = this.theme;
  }

  onSettingsBtnClicked = () => {
    if (!this.ambientlight.initializedTime) return;
    if (this.menuElem.classList.contains('is-visible')) {
      this.closeMenu();
      return;
    }
    this.menuElem.classList.add('is-visible');
    this.menuBtn.setAttribute('aria-expanded', 'true');
    this.openMenuPlayer = this.ambientlight.videoPlayerElem;
    this.openMenuPlayer?.classList.add('ytp-ambientlight-settings-shown');
    on(document.body, 'click', this.onOutsideClick, { capture: true });
    this.enableInput.focus({ preventScroll: true });
    this.scrollToWarning();
  };

  onOutsideClick = ({ target }) => {
    if (!this.menuElem.contains(target) && !this.menuBtn.contains(target)) this.closeMenu();
  };

  closeMenu() {
    this.menuElem.classList.remove('is-visible');
    this.menuBtn.setAttribute('aria-expanded', 'false');
    this.openMenuPlayer?.classList.remove('ytp-ambientlight-settings-shown');
    this.openMenuPlayer = undefined;
    off(document.body, 'click', this.onOutsideClick);
  }

  onLoaded = () => {
    this.menuBtn.classList.remove('is-loading');
    this.menuBtn.title = t('環境光設定');
  };

  onError = (ex) => {
    this.setWarning(t('發生錯誤：\n{message}', { message: ex?.message ?? String(ex) }));
  };

  createBezelElem() {
    const elem = document.createElement('div');
    elem.className = 'ytal-bezel ytp-bezel ytal-bezel--no-animation';
    elem.setAttribute('role', 'status');

    const iconElem = document.createElement('div');
    iconElem.className = 'ytp-bezel-icon';

    const xmlns = 'http://www.w3.org/2000/svg';

    const svgElem = document.createElementNS(xmlns, 'svg');
    svgElem.setAttributeNS(null, 'height', '100%');
    svgElem.setAttributeNS(null, 'width', '100%');
    svgElem.setAttributeNS(null, 'version', '1.1');
    svgElem.setAttributeNS(null, 'viewBox', '0 0 36 36');

    const textElem = document.createElementNS(xmlns, 'text');
    textElem.setAttributeNS(null, 'class', 'ytp-svg-fill');
    textElem.setAttributeNS(null, 'x', '50%');
    textElem.setAttributeNS(null, 'y', '59%');
    textElem.setAttributeNS(null, 'dominant-baseline', 'middle');
    textElem.setAttributeNS(null, 'text-anchor', 'middle');

    svgElem.appendChild(textElem);
    iconElem.appendChild(svgElem);
    elem.appendChild(iconElem);

    return elem;
  }

  createMenuButton() {
    const elem = document.createElement('div');
    elem.className =
      'bpx-player-ctrl-btn ytp-ambientlight-settings-button is-loading';
    elem.setAttribute('role', 'button');
    elem.setAttribute('tabindex', '0');
    elem.setAttribute('aria-label', t('環境光'));

    const iconElem = document.createElement('div');
    iconElem.className = 'bpx-player-ctrl-btn-icon';
    elem.appendChild(iconElem);

    const svgIconElem = document.createElement('span');
    svgIconElem.className = 'bpx-common-svg-icon';
    iconElem.appendChild(svgIconElem);

    // Monochrome version of the extension icon for the player's control bar.
    const xmlns = 'http://www.w3.org/2000/svg';
    const svgElem = document.createElementNS(xmlns, 'svg');
    svgElem.setAttributeNS(null, 'viewBox', '0 0 22 22');
    svgElem.setAttributeNS(null, 'width', '22');
    svgElem.setAttributeNS(null, 'height', '22');

    const screenElem = document.createElementNS(xmlns, 'rect');
    screenElem.setAttributeNS(null, 'x', '4.5');
    screenElem.setAttributeNS(null, 'y', '6');
    screenElem.setAttributeNS(null, 'width', '13');
    screenElem.setAttributeNS(null, 'height', '10');
    screenElem.setAttributeNS(null, 'rx', '1.5');
    screenElem.setAttributeNS(null, 'fill', 'none');
    screenElem.setAttributeNS(null, 'stroke', 'currentColor');
    screenElem.setAttributeNS(null, 'stroke-width', '1.5');
    svgElem.appendChild(screenElem);

    const playElem = document.createElementNS(xmlns, 'path');
    playElem.setAttributeNS(null, 'd', 'M9.5 8.25v5.5L14 11Z');
    playElem.setAttributeNS(null, 'fill', 'currentColor');
    svgElem.appendChild(playElem);

    const accentsElem = document.createElementNS(xmlns, 'path');
    accentsElem.setAttributeNS(
      null,
      'd',
      'M2 8.5V5l1.5-1.5H7M20 13.5V17l-1.5 1.5H15'
    );
    accentsElem.setAttributeNS(null, 'fill', 'none');
    accentsElem.setAttributeNS(null, 'stroke', 'currentColor');
    accentsElem.setAttributeNS(null, 'stroke-width', '1.6');
    accentsElem.setAttributeNS(null, 'stroke-linecap', 'round');
    accentsElem.setAttributeNS(null, 'stroke-linejoin', 'round');
    accentsElem.classList.add('ytp-ambientlight-settings-button__accents');
    svgElem.appendChild(accentsElem);

    svgIconElem.appendChild(svgElem);

    on(elem, 'keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;

      e.preventDefault();
      e.stopPropagation();
      elem.click();
    });

    return elem;
  }

  // Places the button in the control bar of the player, next to the settings button of Bilibili
  attachMenuBtn() {
    if (!this.menuBtn || !this.menuBtnParent) return;

    const playerSettingsBtn = this.menuBtnParent.querySelector(
      ':scope > .bpx-player-ctrl-setting'
    );
    if (playerSettingsBtn) {
      if (playerSettingsBtn.previousElementSibling === this.menuBtn) return;

      this.menuBtnParent.insertBefore(this.menuBtn, playerSettingsBtn);
    } else {
      if (this.menuBtn.parentElement === this.menuBtnParent) return;

      this.menuBtnParent.prepend(this.menuBtn);
    }
  }

  attachMenuElems() {
    if (!this.menuElemParent) return;

    if (this.menuElem && this.menuElem.parentElement !== this.menuElemParent)
      this.menuElemParent.prepend(this.menuElem);
    if (this.bezelElem && this.bezelElem.parentElement !== this.menuElemParent)
      this.menuElemParent.prepend(this.bezelElem);
  }

  // Called when Bilibili has replaced (a part of) the video player
  attachToPlayer(menuBtnParent, menuElemParent) {
    // Bilibili also calls this during ordinary danmaku DOM updates.
    if ((menuBtnParent && menuBtnParent !== this.menuBtnParent) ||
        (menuElemParent && menuElemParent !== this.menuElemParent))
      this.closeMenu();
    if (menuBtnParent) this.menuBtnParent = menuBtnParent;
    if (menuElemParent) this.menuElemParent = menuElemParent;

    this.attachMenuBtn();
    this.attachMenuElems();
  }

  displayBezelForSetting() {
    this.displayBezel('G', !this.enabled);
  }

  displayBezel(text, strike = false) {
    if (this.onBezelElemAnimationEndTimeout) {
      this.onBezelElemAnimationEnd();
    }

    this.bezelElem.classList.add('ytal-bezel--no-animation');
    setTimeout(() => {
      this.bezelElem.classList.toggle('ytal-bezel--strike', strike);
      this.bezelTextElem.textContent = text;

      on(this.bezelElem, 'animationend', this.onBezelElemAnimationEnd);
      this.onBezelElemAnimationEndTimeout = setTimeout(() => {
        this.onBezelElemAnimationEndTimeout = undefined;
        this.onBezelElemAnimationEnd();
      }, 1000);

      this.bezelElem.classList.remove('ytal-bezel--no-animation');
    }, 1);
  }

  onBezelElemAnimationEnd = () => {
    off(this.bezelElem, 'animationend', this.onBezelElemAnimationEnd);
    if (this.onBezelElemAnimationEndTimeout) {
      clearTimeout(this.onBezelElemAnimationEndTimeout);
      this.onBezelElemAnimationEndTimeout = undefined;
    }
    this.bezelElem.classList.add('ytal-bezel--no-animation');
  };

  setWarning = (message, optional = false, icon = true, type = undefined) => {
    if (!this.menuElem) {
      this.pendingWarning = () =>
        this.setWarning(message, optional, icon, type);
      return;
    } else {
      this.pendingWarning = undefined;
    }

    if (optional && this.warningElem.textContent.length) return;
    if (this.warningElem.textContent === message) return;
    if (!message && type && this.warningType !== type) return;

    this.warningElem.hidden = !message;
    this.warningElem.textContent = message;
    this.warningType = type;
    this.menuBtn.classList.toggle('has-warning', icon && !!message);
    this.scrollToWarningQueued = !!message;
    if (!message) return;

    this.scrollToWarning();
  };

  scrollToWarning() {
    if (!this.scrollToWarningQueued || !this.menuElem.classList.contains('is-visible')) return;
    this.scrollToWarningQueued = false;
    this.warningElem.scrollIntoView({ block: 'nearest' });
  }
}

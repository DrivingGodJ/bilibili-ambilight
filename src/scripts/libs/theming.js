import { isWatchPageUrl, wrapErrorHandler } from './generic';
import { injectedScript } from './messaging/injected';
import ErrorReporter from './errors/reporter';
import { storage } from './storage';
import { t } from './i18n';
import { THEME_DARK, THEME_LIGHT, THEME_SYSTEM } from './settings-config';

// Bilibili switches between the light and dark theme by:
// - Toggling the night-mode class on the html element
// - Swapping the light.css and dark.css stylesheet in the link#__css-map__ element
export default class Theming {
  constructor(ambientlight) {
    this.ambientlight = ambientlight;
    this.settings = ambientlight.settings;
  }

  initListeners() {
    // The theme that has been selected in Bilibili
    this.siteTheme = this.isDarkTheme() ? THEME_DARK : THEME_LIGHT;

    try {
      this.systemThemeMediaQuery = matchMedia('(prefers-color-scheme: dark)');
      this.systemThemeMediaQuery.addEventListener(
        'change',
        wrapErrorHandler(() => {
          // Give Bilibili the time to apply the system theme first
          setTimeout(() => {
            this.handleSiteThemeChange();
            if (this.settings.theme === THEME_SYSTEM && this.isForcingTheme()) {
              this.updateTheme();
            }
          }, 100);
        }, true)
      );
    } catch (ex) {
      ErrorReporter.captureException(ex);
    }

    let themeCorrections = 0;
    let lastCorrection = 0;
    this.themeObserver = new MutationObserver(
      wrapErrorHandler(
        function themeMutation() {
          if (this.updatingTheme) return;
          if (!this.isForcingTheme()) {
            this.handleSiteThemeChange();
            return;
          }
          if (!this.shouldToggleTheme()) return;

          // Bound rapid corrections without giving up for the rest of the tab.
          if (Date.now() - lastCorrection > 1000) themeCorrections = 0;
          lastCorrection = Date.now();
          if (themeCorrections++ < 5) this.updateTheme();
        }.bind(this),
        true
      )
    );
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    this.themeObserver.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  }

  handleSiteThemeChange = () => {
    if (this.isForcingTheme()) return;

    this.siteTheme = this.isDarkTheme() ? THEME_DARK : THEME_LIGHT;
  };

  // Whether the ambient light has changed the theme of the page to the theme setting
  isForcingTheme = () =>
    this.settings.enabled &&
    (!this.ambientlight.isHidden || this.ambientlight.keepPageStyle);

  isDarkTheme = () =>
    document.documentElement.classList.contains('night-mode');

  shouldBeDarkTheme = (enabledAndVisible) => {
    const disabled =
      enabledAndVisible === undefined
        ? !this.settings.enabled ||
          (this.ambientlight.isHidden && !this.ambientlight.keepPageStyle)
        : !enabledAndVisible;
    const toTheme = disabled ? this.siteTheme : this.settings.theme;
    return toTheme === THEME_SYSTEM
      ? (this.systemThemeMediaQuery?.matches ?? this.siteTheme === THEME_DARK)
      : toTheme === THEME_DARK;
  };

  shouldToggleTheme = (toDark = this.shouldBeDarkTheme()) => {
    if (toDark && !isWatchPageUrl()) return false;
    const href = document.getElementById('__css-map__')?.getAttribute('href');
    const stylesheetTheme = href?.match(/\/(light|dark)\.css(?:[?#]|$)/)?.[1];
    return this.isDarkTheme() !== toDark ||
      (stylesheetTheme !== undefined && (stylesheetTheme === 'dark') !== toDark);
  };

  updateTheme = wrapErrorHandler(
    async function updateTheme(fromSettings = false) {
      if (this.updatingTheme || !this.shouldToggleTheme()) return;

      this.updatingTheme = true;

      if (this.themeToggleFailed !== false) {
        const lastFailedThemeToggle = await new Promise(
          // eslint-disable-next-line no-async-promise-executor
          async (resolve, reject) => {
            try {
              let timeout = setTimeout(() => {
                timeout = undefined;
                resolve();
              }, 5000);
              const result = await storage.get('last-failed-theme-toggle');
              if (!timeout) return;

              clearTimeout(timeout);
              resolve(result);
            } catch (ex) {
              reject(ex);
            }
          }
        );

        if (lastFailedThemeToggle) {
          const now = new Date().getTime();
          const withinThresshold = now - 10000 < lastFailedThemeToggle;
          if (withinThresshold && !fromSettings) {
            this.settings.setWarning(
              t(
                '上一次切換主題失敗。為了避免頁面不斷重新整理，自動切換成{theme}外觀的功能暫停 10 秒。',
                { theme: this.shouldBeDarkTheme() ? t('深色') : t('淺色') }
              )
            );
            this.updatingTheme = false;
            return;
          }
          storage.set('last-failed-theme-toggle', undefined);
        }
        if (this.themeToggleFailed) {
          this.settings.setWarning('');
          this.themeToggleFailed = false;
        }

        if (!this.shouldToggleTheme()) {
          this.updatingTheme = false;
          return;
        }
      }

      const toDark = this.shouldBeDarkTheme();
      try {
        await this.applyTheme(toDark);
      } finally {
        this.updatingTheme = false;
      }
      // Apply the latest mode if the selected or system appearance changed while waiting.
      if (toDark !== this.shouldBeDarkTheme()) await this.updateTheme(fromSettings);
    }.bind(this),
    true
  );

  async updateDocumentTheme(toDark) {
    await injectedScript.postAndReceiveMessage('update-theme', toDark);
  }

  async applyTheme(toDark) {
    const wasDark = this.isDarkTheme();
    await this.updateDocumentTheme(toDark);

    if (toDark !== this.shouldBeDarkTheme() || !this.shouldToggleTheme(toDark)) return;

    this.themeToggleFailed = true;
    await storage.set('last-failed-theme-toggle', new Date().getTime());
    this.settings.setWarning(
      t(
        '無法把頁面主題從{from}切換成{to}。',
        {
          from: wasDark ? t('深色') : t('淺色'),
          to: toDark ? t('深色') : t('淺色'),
        }
      )
    );
  }
}

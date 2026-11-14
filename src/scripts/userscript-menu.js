import { isUserscriptManagerAvailable, registerMenuCommand, openInTab, getHomepageUrl } from './libs/webext';
import { setWarning } from './libs/generic';
import { t } from './libs/i18n';

export const registerUserscriptMenu = () => {
  if (!isUserscriptManagerAvailable) return;
  registerMenuCommand(t('環境光設定'), () => {
    const button = window.ambientlight?.settings?.menuBtn;
    if (button) button.click();
    else setWarning(t('請先開啟 Bilibili 影片頁面。'));
  });
  registerMenuCommand(t('開啟專案首頁'), () => openInTab(getHomepageUrl()));
};

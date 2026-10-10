# Bilibili 環境光（Ambient light for Bilibili）

在 Bilibili 影片周圍加上環境光（Ambilight）效果的瀏覽器擴充功能。

> 本專案為非官方的第三方擴充功能，與嗶哩嗶哩（Bilibili）及 YouTube 無關。

本專案是 [Ambient light for YouTube™](https://github.com/WesselKroos/youtube-ambilight)（作者 Wessel Kroos，MIT License）的 Bilibili 移植版。渲染引擎（WebGL / Canvas2D 投影、黑邊偵測、統計）沿用原專案，網站整合的部分則改寫給 Bilibili 使用。

## 支援的頁面

- `https://www.bilibili.com/video/*`（一般影片、分 P）
- `https://www.bilibili.com/bangumi/play/*`（番劇／影視，DRM 保護的影片無法顯示環境光）
- `https://www.bilibili.com/list/*`、`/medialist/play/*`（播放清單）
- `https://www.bilibili.com/festival/*`、`/cheese/play/*`

支援播放器的所有模式：一般、寬螢幕、網頁全螢幕、全螢幕，以及 B 站的「鏡像畫面」設定。往下捲動出現小窗播放器時只會隱藏環境光，深色主題與融入背景的效果會保留。

## 安裝（開發者模式）

需要 Node.js 22 以上。

```sh
git clone https://github.com/iceorange-dev/bilibili-ambilight.git
cd bilibili-ambilight
npm install
npm run build
```

1. Chrome / Edge：開啟 `chrome://extensions`，打開「開發人員模式」
2. 點「載入未封裝項目」，選擇 `dist` 資料夾
3. 重新整理 Bilibili 影片頁面

Firefox：改用 `npm run build:firefox` 建置（Firefox 的 manifest 需要 `background.scripts`，Chrome 則只接受 `background.service_worker`），再開啟 `about:debugging#/runtime/this-firefox` →「載入暫用附加元件」→ 選擇 `dist/manifest.json`。

## 使用方式

- 播放器右下角的控制列中，B 站設定（齒輪）按鈕左邊的「光芒螢幕」圖示就是環境光設定選單
- 快捷鍵（可在設定選單中修改）：
  - `G`：開啟／關閉環境光
  - `B`：自動移除上下黑邊（預設關閉，因為燒在上下黑邊裡的字幕也會被裁掉）
  - `V`：自動移除左右黑邊（預設開啟）
  - `H`：將影片放大填滿移除黑邊後的空間
- 預設在開啟環境光時會把頁面切換成深色主題。可在「基本設定 → 外觀（主題）」改成「跟隨 B 站」或「淺色」
- 設定選單的「沉浸」區塊：
  - 頁首與搜尋框融入背景：頁面在最上方時導覽列透明，往下捲動後變成半透明模糊；搜尋框融入背景（預設開啟）
  - 寬螢幕模式時隱藏頁首：寬螢幕模式且在頁面最上方時隱藏導覽列
  - 右側欄融入背景：右側的彈幕列表、選集／合集清單、關注與訂閱合集按鈕融入背景（預設開啟）
  - 彈幕輸入列融入背景：影片下方的彈幕輸入列融入背景（預設開啟）
  - 影片資訊與留言區融入背景：影片標籤與留言輸入框融入背景（預設開啟）
  - 融入背景的元素透明度都跟隨「頁面內容 → 按鈕與區塊背景不透明度」

## 與原版的差異

- 移除 Sentry 錯誤回報：錯誤只會記錄在網頁的 console 中，不會傳送任何資料
- 移除 YouTube 專屬功能：聊天室主題、VR/360 影片、嵌入式播放器、靜態畫面省電模式（依賴 YouTube storyboard）、YouTube 版面效能修正
- Bilibili 的 `<video>` 元素會撐滿整個播放器並用 `object-fit: contain` 加黑邊，所以環境光是依照影片實際畫面的位置計算
- 移除黑邊與影片縮放改用 `clip-path` 與 `scale` 屬性，不會影響 B 站用來鏡像影片的 `transform`
- 「移除左右黑邊」預設開啟（原版預設關閉），因為 B 站有很多把黑邊直接編碼進畫面的 4:3 影片
- 不支援 B 站以 `<bwp-video>` 播放的影片（例如部分 HEVC 影片的 WebAssembly 播放器）

## 專案結構

| 檔案 | 說明 |
| --- | --- |
| `src/scripts/content.js` | 內容腳本進入點：載入 CSS、注入 `injected.js`、載入 `content-main.js` |
| `src/scripts/content-main.js` | 偵測 B 站播放器，並在播放器／影片元素被替換（換影片、換 P）時重新綁定 |
| `src/scripts/injected.js` | 在頁面主環境中執行：切換 B 站的深色／淺色主題（`html.night-mode` 與 `#__css-map__`） |
| `src/scripts/libs/ambientlight.js` | 環境光主邏輯：位置計算、檢視模式、影格排程 |
| `src/scripts/libs/settings.js`、`settings-config.js` | 播放器內的設定選單 |
| `src/scripts/libs/theming.js` | 頁面主題切換 |
| `src/styles/content.scss` | 頁面、播放器與設定選單的樣式 |

## 授權

MIT License，詳見 [LICENSE](LICENSE)。

- 原始作品 Ambient light for YouTube™：Copyright (c) 2017 Wessel Kroos
- Bilibili 移植與修改：Copyright (c) 2026 iceorange-dev

原專案的 git 歷史完整保留在本 repo 中。

**简体中文** | [English](README.en.md)

# Bilibili 环境光

为 Bilibili 视频添加随画面变化的环境光，支持浏览器扩展与用户脚本两种使用方式。

[下载最新版](https://github.com/DrivingGodJ/bilibili-ambilight/releases/latest) · [完整使用与开发参考（繁体中文）](docs/readme-reference.zh-TW.md)

这是基于 [iceorange-dev/bilibili-ambilight](https://github.com/iceorange-dev/bilibili-ambilight) 的社区 fork，新增实时跟随系统深浅色外观的主题选项；原移植版源自 Wessel Kroos 的 [Ambient light for YouTube™](https://github.com/WesselKroos/youtube-ambilight)。本项目与 Bilibili、YouTube 无官方关联。

## 功能特性

- **动态环境光**：支持普通视频、分 P、番剧和播放列表，以及宽屏、网页全屏和全屏模式。
- **主题与沉浸效果**：导航栏、弹幕栏和侧栏可融入背景；选择“跟随系统”后，系统外观变化会实时生效。
- **画面调整**：黑边检测、画面缩放与可自定义快捷键。
- **两种分发方式**：Chrome / Edge / Firefox 扩展，以及 Tampermonkey 等管理器的用户脚本。
- **多语言界面**：繁体中文、简体中文、英语、日语和韩语。

## 快速开始

**Chrome / Edge 扩展：**从 Release 下载 `-chrome.zip` 并解压，在扩展管理页开启“开发人员模式”，选择“加载已解压的扩展程序”，载入解压后的目录，再刷新 Bilibili 视频页。

**用户脚本：**先安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)，再打开[正式版脚本](https://raw.githubusercontent.com/DrivingGodJ/bilibili-ambilight/userscript/bilibili-ambilight.user.js)。无法连接 Raw 时可使用 [jsDelivr 镜像](https://cdn.jsdelivr.net/gh/DrivingGodJ/bilibili-ambilight@userscript/bilibili-ambilight.user.js)。管理器会沿安装地址检查更新。Chromium 浏览器还需按管理器说明允许用户脚本运行。

Firefox 的临时加载及各平台构建方式见下方开发说明和完整参考。

## 使用说明

播放器齿轮左侧的环境光图标打开设置。在“基本设置 → 外观（主题）”中选择“跟随系统”；关闭环境光后会恢复 B 站原有主题。

| 默认快捷键 | 功能 |
| --- | --- |
| `G` | 开关环境光 |
| `B` | 开关上下黑边裁切，默认关闭 |
| `V` | 开关左右黑边裁切，默认开启 |
| `H` | 放大画面以填满裁切后的空间 |

DRM 视频及部分使用 `<bwp-video>` 的 HEVC 播放器不受支持。裁切黑边可能同时裁掉烧录字幕。用户脚本版通过脚本管理器菜单导入、导出或重置设置，没有扩展工具栏和选项页。

## 开发与验证

需要 Node.js **22.5.1+**。

```bash
git clone https://github.com/DrivingGodJ/bilibili-ambilight.git
cd bilibili-ambilight
npm ci
npm test
npm run build
```

Chrome / Edge 加载 `dist/`。Firefox 使用 `npm run build:firefox`，在 `about:debugging#/runtime/this-firefox` 临时加载 `dist/manifest.json`。用户脚本使用 `npm run build:userscript`，生成 `bilibili-ambilight.user.js`；不要手改构建产物。

自动测试不替代真实浏览器安装及 Windows 系统主题切换验收。

## 文档与支持

- [完整使用、国际化和源码结构参考（繁体中文）](docs/readme-reference.zh-TW.md)
- [隐私政策](PRIVACY-POLICY.md)
- [问题反馈](https://github.com/DrivingGodJ/bilibili-ambilight/issues)

## 许可与致谢

[MIT License](LICENSE)。保留 Wessel Kroos（原作）及 iceorange-dev（Bilibili 移植）的版权声明与原始 Git 历史；本 fork 的系统主题改动在此基础上实现。已移除 Sentry 错误上报。

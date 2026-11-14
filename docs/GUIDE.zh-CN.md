**简体中文** | [English](GUIDE.en.md)

# 使用、配置与开发指南

[返回作品展示](../README.md)

## 快速开始

**Chrome / Edge 扩展**：从 Release 下载 `-chrome.zip` 并解压，在扩展管理页开启“开发人员模式”，选择“加载已解压的扩展程序”，载入解压后的目录，再刷新 Bilibili 视频页。

**用户脚本**：先安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)，再打开[正式版脚本](https://raw.githubusercontent.com/DrivingGodJ/bilibili-ambilight/userscript/bilibili-ambilight.user.js)。无法连接 Raw 时可使用 [jsDelivr 镜像](https://cdn.jsdelivr.net/gh/DrivingGodJ/bilibili-ambilight@userscript/bilibili-ambilight.user.js)。管理器会沿安装地址检查更新。Chromium 浏览器还需按管理器说明允许用户脚本运行。

Firefox 的临时加载及各平台构建方式见下方开发说明。

## 使用说明

点击播放器齿轮左侧的环境光图标，可开关环境光和自动去黑边，或在“外观”中选择跟随系统、浅色和深色。关闭环境光后会恢复 B 站原有主题。

| 默认快捷键 | 功能 |
| --- | --- |
| `G` | 开关环境光 |
| `B` | 开关自动去黑边 |

裁切后按比例缩放，画幅与播放器不同时可能留空。能从黑边分离的烧录字幕会加黑色描边后叠回。用户脚本也能通过脚本管理器菜单打开同一设置面板。DRM 视频及部分使用 `<bwp-video>` 的 HEVC 播放器不受支持。

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

- [旧版功能、国际化与源码结构参考（繁体中文）](readme-reference.zh-TW.md)
- [隐私政策](../PRIVACY-POLICY.md)
- [问题反馈](https://github.com/DrivingGodJ/bilibili-ambilight/issues)

## 许可与致谢

[MIT License](../LICENSE)。保留 Wessel Kroos（原作）及 iceorange-dev（Bilibili 移植）的版权声明与原始 Git 历史；本 fork 的系统主题改动在此基础上实现。已移除 Sentry 错误上报。

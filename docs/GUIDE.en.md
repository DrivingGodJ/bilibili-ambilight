[简体中文](GUIDE.zh-CN.md) | **English**

# Usage, Configuration and Development

[Back to the project](../README.en.md)

## Quick start

**Chrome / Edge:** download and extract the `-chrome.zip` package from Releases. Enable Developer mode in the extensions page, choose Load unpacked, select the extracted directory and reload a Bilibili video.

**Userscript:** install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/), then open the [release script](https://raw.githubusercontent.com/DrivingGodJ/bilibili-ambilight/userscript/bilibili-ambilight.user.js). A [jsDelivr mirror](https://cdn.jsdelivr.net/gh/DrivingGodJ/bilibili-ambilight@userscript/bilibili-ambilight.user.js) is available if Raw is inaccessible. Updates use the address chosen at installation. Chromium browsers also need userscript execution enabled as instructed by the manager.

See the development section and detailed reference for Firefox temporary loading and platform builds.

## Usage

Open settings through the ambient-light icon to the left of Bilibili's gear. Select Follow system under Basic settings → Appearance (theme). Disabling ambient lighting restores Bilibili's original theme.

| Default key | Action |
| --- | --- |
| `G` | Toggle ambient lighting |
| `B` | Toggle top/bottom cropping; off by default |
| `V` | Toggle left/right cropping; on by default |
| `H` | Zoom to fill the cropped area |

DRM videos and some HEVC players using `<bwp-video>` are unsupported. Cropping can remove burned-in subtitles. The userscript uses its manager's menu for settings import, export and reset; it has no extension toolbar or options page.

## Development and checks

Requires Node.js **22.5.1+**.

```bash
git clone https://github.com/DrivingGodJ/bilibili-ambilight.git
cd bilibili-ambilight
npm ci
npm test
npm run build
```

Load `dist/` in Chrome / Edge. For Firefox, run `npm run build:firefox` and temporarily load `dist/manifest.json` through `about:debugging#/runtime/this-firefox`. Run `npm run build:userscript` to generate `bilibili-ambilight.user.js`; do not edit build output manually.

Automated tests do not replace installation in a real browser or Windows system-theme switching checks.

## Documentation and support

- [Usage, localization and source layout (Traditional Chinese)](../docs/readme-reference.zh-TW.md)
- [Privacy policy](../PRIVACY-POLICY.md)
- [Report an issue](https://github.com/DrivingGodJ/bilibili-ambilight/issues)

## License and credits

[MIT License](../LICENSE). Wessel Kroos's original copyright, iceorange-dev's Bilibili-port copyright and the original Git history are preserved. This fork adds system-theme support. Sentry error reporting has been removed.

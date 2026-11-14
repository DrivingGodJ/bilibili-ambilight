import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/scripts/libs/bar-detection.js', import.meta.url), 'utf8');
const context = vm.createContext({ BARDETECTION_EDGE_RANGE: 32, performance });
const module = new vm.SourceTextModule(source + '\nexport { workerCode };', { context });
const deps = {
  './generic': { appendErrorStack() {}, requestIdleCallback() {}, SafeOffscreenCanvas: class {}, wrapErrorHandler: (fn) => fn },
  './errors/reporter': { default: {} },
  './worker': { workerFromCode() {} },
};
await module.link((path) => new vm.SyntheticModule(Object.keys(deps[path]), function () {
  for (const [name, value] of Object.entries(deps[path])) this.setExport(name, value);
}, { context }));
await module.evaluate();
const { workerCode, default: BarDetection } = module.namespace;

function frame({ vertical = false, edge = 0, margin = 64 } = {}) {
  const width = 512, height = 512, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const axis = vertical ? x : y;
      const i = 4 * (y * width + x);
      data[i] = data[i + 1] = data[i + 2] = axis < margin || axis >= 512 - margin ? edge : 140;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

async function run(image, { vertical = false, current = 0 } = {}) {
  let result;
  const worker = { postMessage: (value) => { result = value; } };
  workerCode.call(worker);
  await worker.onmessage({ data: {
    id: 1, detectColored: false, offsetPercentage: 0,
    detectHorizontal: !vertical, detectVertical: vertical,
    currentHorizontalPercentage: current, currentVerticalPercentage: current,
    allowedAnomaliesPercentage: 20, allowedUnevenBarsPercentage: 10, xOffsetSize: 1,
    canvasInfo: { canvas: image, ctx: { getImageData: () => image, clearRect() {} } },
  } });
  if (result.error) throw result.error;
  return { ...result, bar: vertical ? result.verticalBarSizeInfo : result.horizontalBarSizeInfo };
}

function drawPattern(image, xStart, xEnd, yStart, yEnd) {
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      if (y % 3 && x % 7 > 1) continue;
      const i = (y * 512 + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 228;
    }
  }
}

test('upstream scanlines detect symmetric black bars on both axes', async () => {
  for (const vertical of [false, true]) {
    const { bar } = await run(frame({vertical}), {vertical});
    assert.ok(Math.abs(bar.percentage - 12.5) < 0.5, String(bar.percentage));
  }
});

test('upstream history keeps a stable crop through a stray measurement and a seek', () => {
  const detector = new BarDetection();
  const stable = { percentage: 12.5, certainty: 1, color: [0, 0, 0] };
  const history = detector.history.horizontal;
  for (let i = 0; i < 4; i++) detector.averagePercentage({...stable}, stable, 1.25, history, 4);
  detector.cancel();
  const percent = detector.averagePercentage({...stable, percentage: 3}, stable, 1.25, history, 4);
  assert.ok(percent === undefined || percent === stable.percentage);
  assert.equal(detector.history.horizontal, history);
  assert.equal(history.length, 4);
});

test('the subtitle pass leaves a corner logo out of the retained masks', async () => {
  const image = frame();
  drawPattern(image, 10, 96, 15, 34);
  const { bar, subtitleStrips } = await run(image);
  assert.ok(Math.abs(bar.percentage - 12.5) < 0.5, String(bar.percentage));
  assert.ok(subtitleStrips.every((strip) => !strip.caption && !strip.protectedContent));
});

test('glyphs within the detected bottom bar have a transparent matte', async () => {
  const image = frame();
  drawPattern(image, 178, 334, 469, 490);
  const { bar, subtitleStrips } = await run(image);
  assert.ok(Math.abs(bar.percentage - 12.5) < 0.5, String(bar.percentage));
  const masks = subtitleStrips.map((strip) => strip.caption).filter(Boolean);
  assert.equal(masks.length, 1);
  const [mask] = masks;
  assert.equal(mask.bottom, true);
  const alpha = mask.pixels.filter((_, index) => index % 4 === 3);
  assert.ok(alpha.some((value) => value === 0));
  assert.ok(alpha.some((value) => value > 200));
});

const ambientSource = readFileSync(new URL('../src/scripts/libs/ambientlight.js', import.meta.url), 'utf8');
const start = ambientSource.indexOf('  updateVideoScale() {');
const end = ambientSource.indexOf('\n  }', start) + '\n  }'.length;
const scaleVideo = new Function('return class {' + ambientSource.slice(start, end) + '}')();

test('the original contain zoom never cuts the retained picture to fill either dimension', () => {
  for (const [containerWidth, containerHeight, horizontal, vertical, zooms] of [
    [1280, 720, 12.5, 0, false],
    [1280, 720, 0, 12.5, false],
    [1280, 720, 12.5, 12.5, true],
    [1280, 800, 0, 12.5, true],
    [1440, 720, 12.5, 0, true],
  ]) {
    const player = Object.assign(new scaleVideo(), {
      getVideoContentRect: () => ({ width: 1280, height: 720 }),
      videoAreaElem: { offsetWidth: containerWidth, offsetHeight: containerHeight },
      settings: {
        detectVideoFillScaleEnabled: true,
        horizontalBarsClipPercentage: horizontal,
        verticalBarsClipPercentage: vertical,
      },
    });
    player.updateVideoScale();
    assert.equal(player.videoScale > 100, zooms);
    assert.ok(1280 * (1 - vertical / 50) * player.videoScale / 100 <= containerWidth);
    assert.ok(720 * (1 - horizontal / 50) * player.videoScale / 100 <= containerHeight);
  }
});

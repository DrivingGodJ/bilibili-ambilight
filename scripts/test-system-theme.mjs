// Run: node --experimental-vm-modules scripts/test-system-theme.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(
  new URL('../src/scripts/libs/theming.js', import.meta.url),
  'utf8'
);
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function createHarness({
  theme = 2,
  systemDark = false,
  siteDark = false,
  enabled = true,
  hidden = false,
  keepPageStyle = false,
  mediaApiFails = false,
} = {}) {
  let dark = siteDark;
  let timerId = 0;
  let mediaCalls = 0;
  let messageGate;
  const timers = new Map();
  const observers = [];
  const listeners = [];
  const messages = [];
  const errors = [];
  const warnings = [];
  const stored = new Map();
  const mediaQuery = {
    matches: systemDark,
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      listeners.push(listener);
    },
  };
  const setDark = (value) => {
    if (dark === value) return;
    dark = value;
    queueMicrotask(() => {
      for (const observer of observers) {
        if (observer.connected) observer.callback();
      }
    });
  };
  const context = vm.createContext({
    document: {
      documentElement: {
        classList: { contains: (name) => name === 'night-mode' && dark },
      },
    },
    matchMedia(query) {
      mediaCalls++;
      assert.equal(query, '(prefers-color-scheme: dark)');
      if (mediaApiFails) throw new Error('matchMedia unavailable');
      return mediaQuery;
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() { this.connected = true; }
      disconnect() { this.connected = false; }
    },
    setTimeout(callback, delay) {
      timers.set(++timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  const imports = {
    './generic': {
      isWatchPageUrl: () => true,
      wrapErrorHandler: (callback) => callback,
    },
    './messaging/injected': {
      injectedScript: {
        async postAndReceiveMessage(type, toDark) {
          assert.equal(type, 'update-theme');
          messages.push(toDark);
          const gate = messageGate;
          messageGate = undefined;
          if (gate && !gate.afterApply) await gate.promise;
          setDark(toDark);
          if (gate?.afterApply) await gate.promise;
        },
      },
    },
    './errors/reporter': {
      default: { captureException: (error) => errors.push(error) },
    },
    './storage': {
      storage: {
        get: async (name) => stored.get(name) ?? null,
        set: async (name, value) => { stored.set(name, value); },
      },
    },
    './i18n': { t: (key) => key },
  };
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    const values = imports[specifier];
    assert.ok(values, `Unexpected import: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) {
        this.setExport(name, value);
      }
    }, { context });
  });
  await module.evaluate();
  const ambientlight = {
    settings: { theme, enabled, setWarning: (warning) => warnings.push(warning) },
    isHidden: hidden,
    keepPageStyle,
  };
  const theming = new module.namespace.default(ambientlight);
  theming.initListeners();
  return {
    ambientlight, theming, messages, errors, warnings,
    get dark() { return dark; },
    get mediaCalls() { return mediaCalls; },
    settle,
    setSiteDark: setDark,
    async changeSystem(value) {
      mediaQuery.matches = value;
      for (const listener of listeners) listener({ matches: value });
      for (const [id, timer] of [...timers]) {
        if (timer.delay !== 100) continue;
        timers.delete(id);
        timer.callback();
      }
      await settle();
    },
    deferNextMessage({ afterApply = false } = {}) {
      let release;
      const promise = new Promise((resolve) => { release = resolve; });
      messageGate = { promise, afterApply };
      return release;
    },
  };
}

test('system mode applies both initial system appearances', async () => {
  for (const systemDark of [false, true]) {
    const h = await createHarness({ systemDark, siteDark: !systemDark });
    assert.equal(h.theming.shouldBeDarkTheme(), systemDark);
    await h.theming.updateTheme();
    assert.equal(h.dark, systemDark);
    assert.deepEqual(h.messages, [systemDark]);
    assert.equal(h.mediaCalls, 1);
    assert.deepEqual(h.errors, []);
  }
});

test('an open page follows light to dark and back without reloading', async () => {
  const h = await createHarness();
  await h.changeSystem(true);
  assert.equal(h.dark, true);
  await h.changeSystem(false);
  assert.equal(h.dark, false);
  assert.deepEqual(h.messages, [true, false]);
});

test('the original light, site, and dark modes ignore system changes', async () => {
  for (const theme of [-1, 0, 1]) {
    const h = await createHarness({ theme });
    await h.theming.updateTheme();
    const messages = [...h.messages];
    await h.changeSystem(true);
    await h.changeSystem(false);
    assert.equal(h.dark, theme === 1);
    assert.deepEqual(h.messages, messages);
  }
});

test('disabling or fully hiding restores the original site appearance', async () => {
  for (const state of ['disabled', 'hidden']) {
    const h = await createHarness({ siteDark: true });
    await h.theming.updateTheme();
    assert.equal(h.dark, false);
    if (state === 'disabled') h.ambientlight.settings.enabled = false;
    else h.ambientlight.isHidden = true;
    await h.theming.updateTheme();
    assert.equal(h.dark, true);
    const messages = [...h.messages];
    await h.changeSystem(true);
    await h.changeSystem(false);
    assert.equal(h.dark, true);
    assert.deepEqual(h.messages, messages);
    assert.equal(h.theming.shouldBeDarkTheme(false), true);
  }
});

test('a hidden mini player retaining page style still follows the system', async () => {
  const h = await createHarness({ hidden: true, keepPageStyle: true });
  await h.changeSystem(true);
  assert.equal(h.dark, true);
  await h.changeSystem(false);
  assert.equal(h.dark, false);
});

test('a failed media API falls back to the original site appearance', async () => {
  for (const siteDark of [false, true]) {
    const h = await createHarness({ siteDark, mediaApiFails: true });
    assert.equal(h.theming.shouldBeDarkTheme(), siteDark);
    await h.theming.updateTheme();
    assert.equal(h.dark, siteDark);
    assert.deepEqual(h.messages, []);
    assert.equal(h.errors.length, 1);
  }
});

test('a system change during an unfinished update settles to the latest value', async () => {
  const h = await createHarness({ systemDark: true });
  const release = h.deferNextMessage();
  const pending = h.theming.updateTheme();
  await h.settle();
  assert.equal(h.theming.updatingTheme, true);
  assert.deepEqual(h.messages, [true]);
  await h.changeSystem(false);
  release();
  await pending;
  await h.settle();
  assert.equal(h.dark, false);
  assert.equal(h.theming.updatingTheme, false);
  assert.deepEqual(h.messages, [true, false]);
});

test('settings import and export preserve the new mode and existing theme values', async () => {
  const context = vm.createContext({});
  const stored = {};
  const modules = new Map();
  const stubs = {
    './generic': { supportsColorMix: () => true, supportsWebGL: () => true },
    './utils': { getBrowser: () => 'Chrome' },
    './storage': { storage: { get: async () => stored } },
    './i18n': { t: (key) => key },
  };
  async function load(specifier) {
    if (modules.has(specifier)) return modules.get(specifier);
    const values = stubs[specifier];
    const module = values
      ? new vm.SyntheticModule(Object.keys(values), function () {
          for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }, { context })
      : new vm.SourceTextModule(await readFile(
          new URL(`../src/scripts/libs/${specifier.slice(2)}.js`, import.meta.url),
          'utf8'
        ), { context });
    modules.set(specifier, module);
    await module.link(load);
    return module;
  }
  const module = await load('./settings-io');
  await module.evaluate();
  for (const theme of [-1, 0, 1, 2]) {
    const result = module.namespace.parseSettingsImport(JSON.stringify({ theme }));
    assert.equal(result.settings['setting-theme'], theme);
    assert.equal(result.warnings.length, 0);
    Object.assign(stored, result.settings);
    assert.equal((await module.namespace.buildSettingsExportObject()).theme, theme);
  }
});

test('a site update matching the latest system theme is not mistaken for failure', async () => {
  const h = await createHarness({ systemDark: true });
  const release = h.deferNextMessage({ afterApply: true });
  const pending = h.theming.updateTheme();
  await h.settle();
  assert.equal(h.dark, true);
  assert.equal(h.theming.updatingTheme, true);

  await h.changeSystem(false);
  h.setSiteDark(false);
  await h.settle();
  assert.equal(h.dark, h.theming.shouldBeDarkTheme());
  release();
  await pending;
  await h.settle();
  assert.equal(h.theming.themeToggleFailed, undefined);
  assert.deepEqual(h.warnings, []);
  assert.equal(h.dark, false);

  await h.changeSystem(true);
  assert.equal(h.dark, true);
  assert.deepEqual(h.messages, [true, true]);
  assert.deepEqual(h.warnings, []);
});

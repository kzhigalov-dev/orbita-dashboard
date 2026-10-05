import test from "node:test";
import assert from "node:assert/strict";
import WidgetLayout from "../dist/js/WidgetLayout.js";

function environment(t) {
  const frames = new Map();
  let serial = 0;
  let observer;
  t.mock.method(globalThis, "getComputedStyle", (node) => ({
    height: String(node.height),
    getPropertyValue: () => String(node.gap),
  }));
  t.mock.method(globalThis, "requestAnimationFrame", (fn) => {
    frames.set(++serial, fn);
    return serial;
  });
  t.mock.method(globalThis, "cancelAnimationFrame", (id) => frames.delete(id));
  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      observer = this;
    }
    observed = new Set();
    observe(node) {
      this.observed.add(node);
    }
    unobserve(node) {
      this.observed.delete(node);
    }
    disconnect() {
      this.observed.clear();
    }
  };
  return {
    frames,
    notify(entries) {
      observer.callback(entries);
    },
    observed() {
      return observer.observed;
    },
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn());
    },
  };
}

// These globals are absent in Node. Restore their original absence after each test.
function browserGlobals(t) {
  for (const name of [
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "ResizeObserver",
  ]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value() {},
    });
    t.after(() =>
      original
        ? Object.defineProperty(globalThis, name, original)
        : delete globalThis[name],
    );
  }
  return environment(t);
}

function node(height = 0, gap = 20) {
  const classes = new Set();
  return {
    height,
    gap,
    style: {
      gridRowEnd: "",
      removeProperty() {
        this.gridRowEnd = "";
      },
    },
    classList: {
      add: (s) => classes.add(s),
      remove: (s) => classes.delete(s),
      contains: (s) => classes.has(s),
    },
  };
}

test("packing follows natural fractional heights, async content and mobile gaps", (t) => {
  const env = browserGlobals(t);
  const container = node();
  const layout = new WidgetLayout(container);
  const short = node(100.5),
    tall = node(500);
  layout.add(short);
  layout.add(tall);
  assert.equal(short.style.gridRowEnd, "span 31");
  assert.equal(tall.style.gridRowEnd, "span 130");
  short.height = 60;
  tall.height = 680.5;
  container.gap = 16;
  env.notify([{ target: short }, { target: tall }]);
  env.notify([{ target: tall }]);
  assert.equal(env.frames.size, 1, "resize bursts share one frame");
  env.flush();
  assert.equal(short.style.gridRowEnd, "span 19");
  assert.equal(tall.style.gridRowEnd, "span 175");
  layout.destroy();
});

test("container height changes do not trigger a resize feedback loop", (t) => {
  const env = browserGlobals(t);
  const container = node();
  const layout = new WidgetLayout(container);
  env.notify([{ target: container, contentRect: { width: 900, height: 500 } }]);
  env.flush();
  env.notify([{ target: container, contentRect: { width: 900, height: 900 } }]);
  assert.equal(env.frames.size, 0);
  env.notify([{ target: container, contentRect: { width: 390, height: 900 } }]);
  assert.equal(env.frames.size, 1);
  layout.destroy();
});

test("removed widgets are unobserved and destroy cancels pending layout", (t) => {
  const env = browserGlobals(t);
  const container = node();
  const layout = new WidgetLayout(container);
  const card = node(300);
  layout.add(card);
  layout.remove(card);
  assert.equal(env.observed().has(card), false);
  assert.equal(card.style.gridRowEnd, "");
  env.notify([{ target: card }]);
  assert.equal(env.frames.size, 0);
  layout.add(card);
  layout.schedule();
  layout.destroy();
  layout.destroy();
  layout.schedule();
  assert.equal(env.frames.size, 0);
  assert.equal(env.observed().size, 0);
  assert.equal(card.style.gridRowEnd, "");
  assert.equal(container.classList.contains("is-packed"), false);
});

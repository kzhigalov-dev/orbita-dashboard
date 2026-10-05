import test from "node:test";
import assert from "node:assert/strict";
import WidgetDrag, {
  insertionTarget,
  edgeScroll,
} from "../dist/js/WidgetDrag.js";

test("drop targets distinguish tall cards, columns, before/after and empty grids", () => {
  const cards = [
    { node: "wide", rect: { left: 0, right: 400, top: 0, bottom: 600 } },
    { node: "short", rect: { left: 420, right: 620, top: 0, bottom: 100 } },
    { node: "below", rect: { left: 420, right: 620, top: 120, bottom: 400 } },
  ];
  assert.deepEqual(insertionTarget({ x: 100, y: 10 }, cards), {
    node: "wide",
    before: true,
  });
  assert.deepEqual(insertionTarget({ x: 100, y: 580 }, cards), {
    node: "wide",
    before: false,
  });
  assert.deepEqual(insertionTarget({ x: 500, y: 180 }, cards), {
    node: "below",
    before: true,
  });
  assert.deepEqual(insertionTarget({ x: 500, y: 440 }, cards), {
    node: "below",
    before: false,
  });
  assert.equal(insertionTarget({ x: 20, y: 20 }, []), null);
});

test("edge scrolling has a quiet centre and bounded speed outside the viewport", () => {
  assert.equal(edgeScroll(400, 844), 0);
  assert.equal(edgeScroll(0, 844), -14);
  assert.equal(edgeScroll(844, 844), 14);
  assert.equal(edgeScroll(-200, 844), -14);
  assert.equal(edgeScroll(1200, 844), 14);
  assert.ok(edgeScroll(50, 844) < 0);
  assert.ok(edgeScroll(800, 844) > 0);
});

function globalValue(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
  t.after(() =>
    descriptor
      ? Object.defineProperty(globalThis, key, descriptor)
      : delete globalThis[key],
  );
}

function node(id) {
  const classes = new Set();
  return {
    id,
    parent: null,
    styleText: "grid-row-end: span 30",
    classList: {
      add: (s) => classes.add(s),
      remove: (s) => classes.delete(s),
      contains: (s) => classes.has(s),
    },
    getBoundingClientRect: () => ({ left: 0, right: 400, top: 0, bottom: 500 }),
    getAttribute() {
      return this.styleText;
    },
    setAttribute(_key, value) {
      this.styleText = value;
    },
    removeAttribute() {
      this.styleText = null;
    },
    remove() {
      if (!this.parent) return;
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    },
    before(other) {
      const parent = this.parent;
      other.remove();
      parent.children.splice(parent.children.indexOf(this), 0, other);
      other.parent = parent;
    },
  };
}

function fixture(t) {
  globalValue(
    t,
    "document",
    Object.assign(new EventTarget(), { body: node("body"), hidden: false }),
  );
  globalValue(t, "window", new EventTarget());
  let cancelledFrame;
  globalValue(t, "cancelAnimationFrame", (id) => {
    cancelledFrame = id;
  });
  const container = Object.assign(new EventTarget(), {
    children: [],
    getBoundingClientRect: () => ({
      left: 0,
      right: 400,
      top: 0,
      bottom: 1000,
    }),
    hasPointerCapture: () => true,
    releasePointerCapture: () => {},
    append(n) {
      n.remove();
      this.children.push(n);
      n.parent = this;
    },
  });
  const focused = [],
    animations = [],
    observed = new Set();
  const widgets = ["a", "b", "c"].map((id) => ({
    id,
    title: id,
    root: node(id),
    dragButton: { focus: () => focused.push(id) },
    animate: (_n, frames) => animations.push(frames),
  }));
  widgets.forEach((w) => container.append(w.root));
  const slot = node("slot");
  container.children.splice(2, 0, slot);
  slot.parent = container;
  let saves = 0;
  const dashboard = {
    container,
    widgets,
    layout: { remove: (n) => observed.delete(n), add: (n) => observed.add(n) },
    positions: () => new Map(),
    animatePositions() {},
    update() {},
    save: () => saves++,
    announce() {},
  };
  const drag = new WidgetDrag(dashboard);
  drag.place = () => {};
  widgets[0].root.classList.add("is-dragging");
  document.body.classList.add("is-widget-dragging");
  observed.add(slot);
  drag.state = {
    widget: widgets[0],
    pointerId: 5,
    active: true,
    placeholder: slot,
    originalStyle: "grid-row-end: span 30",
    point: { x: 100, y: 300 },
  };
  drag.frame = 12;
  return {
    drag,
    dashboard,
    slot,
    focused,
    animations,
    observed,
    saves: () => saves,
    cancelled: () => cancelledFrame,
  };
}

test("a drop commits DOM order once, restores the card and releases drag resources", (t) => {
  const f = fixture(t);
  f.drag.finish();
  assert.deepEqual(
    f.dashboard.widgets.map((w) => w.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    f.dashboard.container.children.map((n) => n.id),
    ["b", "a", "c"],
  );
  assert.equal(f.saves(), 1);
  const nextClick = new Event("click", { cancelable: true });
  Object.defineProperties(nextClick, {
    detail: { value: 1 },
    target: { value: { closest: () => null } },
  });
  f.dashboard.container.dispatchEvent(nextClick);
  assert.equal(
    nextClick.defaultPrevented,
    false,
    "drop does not eat the next unrelated button click",
  );
  assert.equal(f.slot.parent, null);
  assert.equal(f.cancelled(), 12);
  assert.equal(f.drag.state, null);
  assert.equal(f.observed.has(f.slot), false);
  assert.equal(f.observed.has(f.dashboard.widgets[1].root), true);
  assert.equal(f.dashboard.widgets[1].root.styleText, "grid-row-end: span 30");
  assert.equal(document.body.classList.contains("is-widget-dragging"), false);
  assert.deepEqual(f.focused, ["a"]);
  assert.equal(
    f.animations.length,
    1,
    "landing feedback is bounded to one animation",
  );
  f.drag.destroy();
});

test("cancellation restores the original order without saving temporary placement", (t) => {
  const f = fixture(t);
  f.drag.cancel();
  assert.deepEqual(
    f.dashboard.container.children.map((n) => n.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    f.dashboard.widgets.map((w) => w.id),
    ["a", "b", "c"],
  );
  assert.equal(f.saves(), 0);
  assert.equal(f.drag.state, null);
  f.drag.destroy();
});

test("pointer cancellation and Escape cancel, and destroyed handlers no longer run", (t) => {
  const f = fixture(t);
  const cancel = new Event("pointercancel");
  Object.assign(cancel, { pointerId: 5 });
  f.dashboard.container.dispatchEvent(cancel);
  assert.equal(f.drag.state, null);
  assert.equal(f.saves(), 0);
  f.drag.state = { pointerId: 6, active: false };
  const escape = new Event("keydown", { cancelable: true });
  Object.assign(escape, { key: "Escape" });
  window.dispatchEvent(escape);
  assert.equal(f.drag.state, null);
  assert.equal(escape.defaultPrevented, true);
  let calls = 0;
  f.drag.down = () => calls++;
  f.dashboard.container.dispatchEvent(new Event("pointerdown"));
  assert.equal(calls, 1);
  f.drag.destroy();
  f.drag.destroy();
  f.dashboard.container.dispatchEvent(new Event("pointerdown"));
  assert.equal(calls, 1);
  assert.equal(f.drag.listeners.signal.aborted, true);
});

test("touch and mouse use a movement threshold and ignore a second pointer", () => {
  const root = node("a"),
    handle = { closest: () => root };
  const container = { contains: () => true, setPointerCapture() {} };
  const drag = new WidgetDrag({ container, widgets: [{ root }] });
  let starts = 0;
  drag.begin = () => {
    starts++;
    drag.state.active = true;
  };
  drag.down({
    target: { closest: () => handle },
    button: 0,
    isPrimary: true,
    pointerType: "touch",
    pointerId: 1,
    clientX: 20,
    clientY: 20,
  });
  drag.move({ pointerId: 2, clientX: 200, clientY: 200 });
  drag.move({ pointerId: 1, clientX: 23, clientY: 23 });
  assert.equal(starts, 0);
  drag.move({ pointerId: 1, clientX: 40, clientY: 20, preventDefault() {} });
  assert.equal(starts, 1);
});

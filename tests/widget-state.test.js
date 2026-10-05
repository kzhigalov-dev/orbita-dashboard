import test from "node:test";
import assert from "node:assert/strict";
import {
  Countdown,
  calculate,
  localDay,
  weekDays,
} from "../dist/js/widget-state.js";
import FocusWidget from "../dist/js/FocusWidget.js";
import NotesWidget from "../dist/js/NotesWidget.js";
import HabitsWidget from "../dist/js/HabitsWidget.js";
import CalculatorWidget from "../dist/js/CalculatorWidget.js";
import UIComponent from "../dist/js/UIComponent.js";

test("countdown follows elapsed wall time, including background throttling and reload", () => {
  const timer = new Countdown({ duration: 60 }, 1000);
  timer.start(1000);
  timer.tick(31000);
  assert.equal(timer.remaining, 30);
  const restored = new Countdown(timer.serialize(), 51000);
  assert.equal(restored.tick(51000), false);
  assert.equal(restored.remaining, 10);
  assert.equal(restored.tick(61001), true);
  assert.equal(restored.remaining, 0);
  assert.equal(restored.tick(62000), false, "completion is emitted once");
});
test("pause/resume keeps remaining time and different timers are independent", () => {
  const a = new Countdown({ duration: 60 }, 0),
    b = new Countdown({ duration: 120 }, 0);
  a.start(0);
  b.start(0);
  a.pause(10000);
  a.tick(30000);
  b.tick(30000);
  assert.equal(a.remaining, 50);
  assert.equal(b.remaining, 90);
  a.start(30000);
  a.tick(40000);
  assert.equal(a.remaining, 40);
  a.reset(300);
  assert.equal(a.remaining, 300);
  assert.equal(a.deadline, null);
});
test("invalid persisted timer values are bounded", () => {
  const timer = new Countdown(
    { duration: -1, remaining: Infinity, deadline: Infinity },
    0,
  );
  assert.equal(timer.duration, 1500);
  assert.equal(timer.remaining, 1500);
  assert.equal(timer.deadline, null);
  assert.equal(
    new Countdown({ duration: 60, remaining: 900, deadline: 999999 }, 0)
      .remaining,
    60,
  );
  assert.equal(
    new Countdown({ duration: 60, deadline: 999999 }, 0).deadline,
    null,
  );
});
test("focus sessions finish once, distinguish breaks and clear active interval on destroy", (t) => {
  let callback,
    cleared = 0;
  t.mock.method(globalThis, "setInterval", (fn) => {
    callback = fn;
    return 41;
  });
  t.mock.method(globalThis, "clearInterval", (id) => {
    if (id === 41) cleared++;
  });
  const widget = new FocusWidget({ duration: 60, deadline: Date.now() - 1000 });
  widget.paint = () => {};
  widget.run();
  callback();
  callback();
  assert.equal(widget.sessions, 1);
  widget.mode = "break";
  widget.clock.deadline = Date.now() - 1000;
  callback();
  assert.equal(widget.sessions, 1);
  widget.run();
  widget.destroy();
  assert.ok(cleared >= 2);
  assert.equal(widget.destroyed, true);
});
test("calculator implements precedence, signs, parentheses, decimals and literal percentages", () => {
  assert.equal(calculate("(120 + 30) × 2"), 300);
  assert.equal(calculate("2+3*4"), 14);
  assert.equal(calculate("-2 * -(3 + 4)"), 14);
  assert.equal(calculate("1,5+0.5"), 2);
  assert.equal(calculate("250 × 10%"), 25);
  assert.equal(calculate("0.1+0.2"), 0.3);
});
test("calculator rejects code, division by zero and unfinished input", () => {
  for (const text of [
    "",
    "1/0",
    "alert(1)",
    "2+",
    "(1+2",
    "1.2.3",
    "2(3)",
    "NaN",
    "1".repeat(121),
  ])
    assert.throws(() => calculate(text));
});
test("local week handles month boundaries without UTC shifts", () => {
  const date = new Date(2026, 2, 1, 0, 5);
  assert.equal(localDay(date), "2026-03-01");
  const days = weekDays(date);
  assert.equal(days[0].key, "2026-02-23");
  assert.equal(days[6].key, "2026-03-01");
  assert.equal(new Set(days.map((d) => d.key)).size, 7);
});
test("restored widget configuration is bounded and does not share arrays", () => {
  const config = {
    customTitle: "Личное",
    tone: "sky",
    width: "wide",
    density: "compact",
  };
  const component = new UIComponent({
    ...config,
    title: "default",
    type: "notes",
  });
  assert.equal(component.title, "Личное");
  assert.equal(component.serialize().tone, "sky");
  const invalid = new UIComponent({
    title: "safe",
    customTitle: 12,
    tone: "url(bad)",
    width: "1000",
    density: "bad",
  });
  assert.equal(invalid.title, "safe");
  assert.equal(invalid.tone, "default");
  assert.equal(invalid.width, "auto");
  const notes = new NotesWidget({ text: "a".repeat(4000) });
  assert.equal(notes.text.length, 3000);
  const input = [{ text: "читать", days: [localDay(), localDay(), "bad"] }];
  const a = new HabitsWidget({ habits: input }),
    b = new HabitsWidget({ habits: input });
  a.habits[0].days.length = 0;
  assert.equal(b.habits[0].days.length, 1);
  const calc = new CalculatorWidget({
    history: [{ expression: "1/0", result: Infinity }],
  });
  assert.equal(calc.history.length, 0);
});

test("dashboard restores legacy widgets and sanitizes duplicate IDs without renaming them", async (t) => {
  const { default: Dashboard } = await import("../dist/js/Dashboard.js");
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const state = {
    version: 1,
    widgets: [
      { type: "todo", id: "same", tasks: [] },
      { type: "notes", id: "same", customTitle: "Plan" },
      { type: "clock", id: "<bad>" },
    ],
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(state) },
  });
  t.after(() => {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  });
  const restored = [];
  const dashboard = new Dashboard({ container: {}, announce: () => {} });
  dashboard.addWidget = (type, config) => {
    const widget = { id: config.id ?? crypto.randomUUID() };
    restored.push({ type, config, widget });
    return widget;
  };
  dashboard.save = () => {};
  dashboard.update = () => {};
  dashboard.restore();
  assert.equal(restored.length, 3);
  assert.equal(restored[1].config.customTitle, "Plan");
  assert.equal(restored[1].config.id, undefined);
  assert.equal(restored[2].config.id, undefined);
  assert.notEqual(restored[0].widget.id, restored[1].widget.id);
});

test("duplicating a running focus widget clones state and pauses only the copy", async () => {
  const { default: Dashboard } = await import("../dist/js/Dashboard.js");
  const source = new FocusWidget({ duration: 60 });
  source.clock.start();
  const dashboard = new Dashboard({ container: {}, announce: () => {} });
  dashboard.widgets = [source];
  let copy;
  dashboard.addWidget = (_type, config) => {
    copy = new FocusWidget(config);
  };
  dashboard.duplicateWidget(source.id);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.clock.deadline, null);
  assert.ok(source.clock.deadline > Date.now());
  assert.match(copy.title, /копия/);
});

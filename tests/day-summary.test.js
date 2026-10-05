import test from "node:test";
import assert from "node:assert/strict";
import { summarizeTasks } from "../dist/js/day-summary.js";

test("day summary counts tasks across independent widgets only", () => {
  assert.deepEqual(summarizeTasks([
    { type: "todo", tasks: [{ done: true }, { done: false }] },
    { type: "weather" },
    { type: "todo", tasks: [{ done: false }] },
  ]), { total: 3, done: 1, remaining: 2, percent: 33 });
});
test("empty dashboard has no invented completion", () => {
  assert.deepEqual(summarizeTasks([]), { total: 0, done: 0, remaining: 0, percent: 0 });
});
test("completed and removed lists update the actual total", () => {
  const widgets = [{ type: "todo", tasks: [{ done: true }] }, { type: "todo", tasks: [{ done: false }] }];
  widgets.pop();
  assert.deepEqual(summarizeTasks(widgets), { total: 1, done: 1, remaining: 0, percent: 100 });
});

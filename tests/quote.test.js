import test from "node:test";
import assert from "node:assert/strict";
import QuoteWidget from "../dist/js/QuoteWidget.js";

test("a new quote uses a random initial choice while restored state is preserved", (t) => {
  t.mock.method(Math, "random", () => 0.9);
  const fresh = new QuoteWidget();
  assert.ok(
    fresh.index > 0,
    "new quotes must not always start at the first entry",
  );
  const restored = new QuoteWidget({ index: 2 });
  assert.equal(restored.index, 2);
  const other = new QuoteWidget({ index: 1 });
  restored.index = 3;
  assert.equal(other.index, 1, "quote instances keep independent state");
});

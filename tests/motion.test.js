import test from "node:test";
import assert from "node:assert/strict";
import UIComponent from "../dist/js/UIComponent.js";

test("repeated motion cancels its predecessor and destroy cancels the remainder", () => {
  const animations = [];
  const node = { animate() {
    const animation = { cancelled: false, cancel() { this.cancelled = true; this.oncancel?.(); } };
    animations.push(animation);
    return animation;
  } };
  const widget = new UIComponent({ title: "test" });
  widget.animate(node, [{ opacity: 0 }, { opacity: 1 }]);
  widget.animate(node, [{ opacity: 0 }, { opacity: 1 }]);
  assert.equal(animations[0].cancelled, true);
  assert.equal(animations[1].cancelled, false);
  widget.destroy();
  assert.equal(animations[1].cancelled, true);
  widget.animate(node, []);
  assert.equal(animations.length, 2);
});
test("reduced motion leaves content available without starting spatial animations", () => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const widget = new UIComponent({ title: "test" });
    widget.animate({ animate() { assert.fail("Animation started despite reduced motion"); } }, []);
    widget.destroy();
  } finally {
    if (previous) globalThis.matchMedia = previous;
    else delete globalThis.matchMedia;
  }
});

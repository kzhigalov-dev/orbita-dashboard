import test from "node:test";
import assert from "node:assert/strict";
import APIWidget from "../dist/js/APIWidget.js";
import UIComponent from "../dist/js/UIComponent.js";
import CurrencyWidget from "../dist/js/CurrencyWidget.js";
const pending = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
class Probe extends APIWidget {
  constructor() {
    super({ title: "test" });
    this.states = [];
  }
  setState(status, data, message) {
    if (this.destroyed) return;
    this.status = status;
    this.data = data;
    this.states.push({ status, data, message });
  }
}
const reply = (data) => ({ ok: true, json: async () => data });
test("new request immediately aborts old request and ignores stale response", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = (_url, { signal }) => {
    const p = pending();
    calls.push({ ...p, signal });
    return p.promise;
  };
  const widget = new Probe();
  try {
    const first = widget.runRequest("first", (x) => x);
    const second = widget.runRequest("second", (x) => x);
    assert.equal(calls[0].signal.aborted, true);
    calls[1].resolve(reply("fresh"));
    await second;
    calls[0].resolve(reply("stale"));
    await first;
    assert.equal(widget.data, "fresh");
    assert.equal(widget.states.filter((x) => x.status === "success").length, 1);
  } finally {
    widget.destroy();
    globalThis.fetch = original;
  }
});
test("destroy aborts pending work and prevents late DOM/state updates", async () => {
  const original = globalThis.fetch;
  const p = pending();
  let signal;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return p.promise;
  };
  const widget = new Probe();
  try {
    const run = widget.runRequest("test", (x) => x);
    widget.destroy();
    assert.equal(signal.aborted, true);
    p.resolve(reply("late"));
    await run;
    assert.equal(widget.states.at(-1).status, "loading");
  } finally {
    globalThis.fetch = original;
  }
});
test("HTTP errors, network failures, empty data, successful data have distinct states", async () => {
  const original = globalThis.fetch;
  const widget = new Probe();
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await widget.runRequest("test", (x) => x);
    assert.equal(widget.status, "error");
    assert.match(widget.states.at(-1).message, /503/);
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await widget.runRequest("test", (x) => x);
    assert.equal(widget.status, "error");
    assert.match(widget.states.at(-1).message, /соединение/);
    globalThis.fetch = async () => reply({});
    await widget.runRequest("test", () => null);
    assert.equal(widget.status, "empty");
    globalThis.fetch = async () => reply({ value: 1 });
    await widget.runRequest("test", (x) => x);
    assert.equal(widget.status, "success");
    assert.deepEqual(widget.data, { value: 1 });
  } finally {
    widget.destroy();
    globalThis.fetch = original;
  }
});
test("destroy removes event listeners and remains idempotent", () => {
  const target = new EventTarget();
  const component = new UIComponent({ title: "test" });
  let calls = 0;
  component.listen(target, "ping", () => calls++);
  target.dispatchEvent(new Event("ping"));
  assert.equal(calls, 1);
  component.destroy();
  component.destroy();
  target.dispatchEvent(new Event("ping"));
  assert.equal(calls, 1);
});
test("cancelling before a throttled reload aborts the active currency request immediately", async () => {
  const original = globalThis.fetch;
  const p = pending();
  let signal;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return p.promise;
  };
  const widget = new CurrencyWidget();
  widget.setState = function (status, data) {
    this.status = status;
    this.data = data;
  };
  try {
    const active = widget.runRequest("currency", (x) => x);
    const next = widget.load();
    assert.equal(signal.aborted, true);
    widget.destroy();
    p.resolve(reply({}));
    await Promise.all([active, next]);
  } finally {
    widget.destroy();
    globalThis.fetch = original;
  }
});

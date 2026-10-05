import UIComponent from "./UIComponent.js";
import { el, button, icon } from "./dom.js";
import { Countdown } from "./widget-state.js";
export default class FocusWidget extends UIComponent {
  #timer;
  constructor(config = {}) {
    super({ ...config, title: "Фокус", type: "focus" });
    this.clock = new Countdown(config);
    this.sessions =
      Number.isInteger(config.sessions) && config.sessions >= 0
        ? Math.min(config.sessions, 99999)
        : 0;
    this.mode = config.mode === "break" ? "break" : "focus";
  }
  render() {
    if (this.root) return this.root;
    const root = super.render();
    const presets = el("div", "widget-toolbar timer-presets");
    this.presetButtons = [];
    for (const [label, minutes, mode] of [
      ["Фокус · 25 мин", 25, "focus"],
      ["Перерыв · 5 мин", 5, "break"],
      ["Перерыв · 15 мин", 15, "break"],
    ]) {
      const b = button(label, null, "button button-secondary");
      this.listen(b, "click", () => this.reset(minutes * 60, mode));
      presets.append(b);
      this.presetButtons.push({ b, minutes, mode });
    }
    this.display = el("div", "timer-display");
    this.display.setAttribute("role", "timer");
    this.display.setAttribute("aria-label", "Осталось времени");
    this.statusNode = el("p", "timer-status");
    this.statusNode.setAttribute("role", "status");
    const label = el("label", "field-label", "Длительность, минут");
    this.durationInput = el("input");
    Object.assign(this.durationInput, {
      id: `${this.id}-duration`,
      type: "number",
      min: "1",
      max: "120",
      step: "1",
      value: String(this.clock.duration / 60),
    });
    label.htmlFor = this.durationInput.id;
    const durationForm = el("form", "inline-form");
    const apply = button("Применить", null, "button button-secondary");
    apply.type = "submit";
    durationForm.append(this.durationInput, apply);
    this.listen(durationForm, "submit", (event) => {
      event.preventDefault();
      if (this.durationInput.validity.valid && this.durationInput.value)
        this.reset(Number(this.durationInput.value) * 60, this.mode);
    });
    this.startButton = button("Начать", null, "button button-primary");
    const reset = button("Сбросить", null, "button button-secondary");
    reset.replaceChildren(icon("refresh"), el("span", "", "Сбросить"));
    this.listen(this.startButton, "click", () => {
      this.tick();
      if (this.clock.deadline !== null) {
        this.clock.pause();
        clearInterval(this.#timer);
      } else {
        this.clock.start();
        this.run();
      }
      this.paint();
      this.changed();
    });
    this.listen(reset, "click", () => this.reset());
    const actions = el("div", "widget-toolbar");
    actions.append(this.startButton, reset);
    this.counter = el("p", "muted");
    this.body.append(
      presets,
      this.display,
      this.statusNode,
      actions,
      label,
      durationForm,
      this.counter,
    );
    this.tick();
    this.paint();
    if (this.clock.deadline !== null) this.run();
    return root;
  }
  run() {
    clearInterval(this.#timer);
    this.#timer = setInterval(() => {
      this.tick();
      this.paint();
    }, 1000);
  }
  tick() {
    if (this.clock.tick()) {
      clearInterval(this.#timer);
      if (this.mode === "focus") this.sessions++;
      this.changed();
      this.announce(
        this.mode === "focus"
          ? "Фокус завершён. Время для перерыва."
          : "Перерыв завершён.",
      );
    }
  }
  reset(duration = this.clock.duration, mode = this.mode) {
    clearInterval(this.#timer);
    this.clock.reset(duration);
    this.mode = mode;
    this.durationInput.value = String(duration / 60);
    this.paint();
    this.changed();
  }
  paint() {
    const seconds = Math.ceil(this.clock.remaining);
    this.display.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    const running = this.clock.deadline !== null;
    this.startButton.textContent = running ? "Пауза" : "Начать";
    this.startButton.setAttribute("aria-label", this.startButton.textContent);
    this.startButton.title = this.startButton.textContent;
    this.presetButtons.forEach(({ b, minutes, mode }) =>
      b.setAttribute(
        "aria-pressed",
        String(minutes * 60 === this.clock.duration && mode === this.mode),
      ),
    );
    const status = !seconds
      ? "Готово. Можно начать новый цикл."
      : `${this.mode === "focus" ? "Время сосредоточиться" : "Время отдохнуть"}${running ? " · идёт отсчёт" : " · на паузе"}`;
    if (this.statusNode.textContent !== status)
      this.statusNode.textContent = status;
    this.counter.textContent = `Завершено фокус-сессий: ${this.sessions}`;
  }
  serialize() {
    return {
      ...super.serialize(),
      ...this.clock.serialize(),
      sessions: this.sessions,
      mode: this.mode,
    };
  }
  destroy() {
    clearInterval(this.#timer);
    super.destroy();
  }
}

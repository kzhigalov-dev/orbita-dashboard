import ToDoWidget from "./ToDoWidget.js";
import WeatherWidget from "./WeatherWidget.js";
import CurrencyWidget from "./CurrencyWidget.js";
import QuoteWidget from "./QuoteWidget.js";
import NotesWidget from "./NotesWidget.js";
import FocusWidget from "./FocusWidget.js";
import HabitsWidget from "./HabitsWidget.js";
import ClockWidget from "./ClockWidget.js";
import CalculatorWidget from "./CalculatorWidget.js";
const registry = {
  todo: ToDoWidget,
  weather: WeatherWidget,
  currency: CurrencyWidget,
  quote: QuoteWidget,
  notes: NotesWidget,
  focus: FocusWidget,
  habits: HabitsWidget,
  clock: ClockWidget,
  calculator: CalculatorWidget,
};
export const STORAGE_KEY = "orbita.dashboard.v1";
export default class Dashboard {
  constructor({ container, announce, onSave, onUpdate, addButtons }) {
    Object.assign(this, { container, announce, onSave, onUpdate, addButtons });
    this.widgets = [];
    this.restoring = false;
  }
  addWidget(widgetType, config = {}, { focus = true } = {}) {
    if (!Object.hasOwn(registry, widgetType))
      throw new Error("Неизвестный тип виджета");
    if (this.widgets.length >= 20) {
      this.announce(
        "Можно добавить не больше 20 виджетов. Сначала удалите один.",
      );
      return null;
    }
    const widget = new registry[widgetType]({
      ...config,
      type: widgetType,
      onClose: (id) => this.removeWidget(id),
      onMove: (id, delta) => this.moveWidget(id, delta),
      onChange: () => this.save(),
      onDuplicate: (id) => this.duplicateWidget(id),
      announce: this.announce,
    });
    this.widgets.push(widget);
    this.container.append(widget.render());
    this.update();
    this.save();
    widget.load?.();
    if (focus) {
      widget.animate(
        widget.root,
        [
          { transform: "scale(0.94)", opacity: 0.6 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 360 },
      );
      widget.toggleButton.focus();
      this.announce(`Добавлен виджет «${widget.title}».`);
    }
    return widget;
  }
  duplicateWidget(id) {
    const original = this.widgets.find((w) => w.id === id);
    if (!original) return;
    const config = structuredClone(original.serialize());
    delete config.id;
    config.customTitle = `${original.title.slice(0, 50)} · копия`;
    // A copied timer starts paused; copying must never launch a second session.
    if (original.type === "focus") config.deadline = null;
    this.addWidget(original.type, config);
  }
  removeWidget(widgetId) {
    const index = this.widgets.findIndex((w) => w.id === widgetId);
    if (index < 0) return;
    const [widget] = this.widgets.splice(index, 1);
    widget.destroy();
    this.update();
    this.save();
    const next = this.widgets[Math.min(index, this.widgets.length - 1)];
    (next?.toggleButton ?? this.addButtons[0])?.focus();
    this.announce(`Виджет «${widget.title}» удалён.`);
  }
  moveWidget(id, delta) {
    const index = this.widgets.findIndex((w) => w.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= this.widgets.length) return;
    const focused = document.activeElement;
    const positions = new Map(
      this.widgets.map((w) => [w.id, w.root.getBoundingClientRect()]),
    );
    this.widgets.forEach((w) => w.stopAnimation(w.root));
    const [widget] = this.widgets.splice(index, 1);
    this.widgets.splice(target, 0, widget);
    this.widgets.forEach((w) => this.container.append(w.root));
    this.update();
    this.save();
    this.widgets.forEach((w) => {
      const before = positions.get(w.id);
      const after = w.root.getBoundingClientRect();
      const x = before.left - after.left;
      const y = before.top - after.top;
      if (x || y)
        w.animate(
          w.root,
          [
            { transform: `translate(${x}px, ${y}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration: 360 },
        );
    });
    const fallback = delta < 0 ? widget.downButton : widget.upButton;
    (focused?.isConnected && !focused.disabled ? focused : fallback).focus();
    this.announce(
      `«${widget.title}»: позиция ${target + 1} из ${this.widgets.length}.`,
    );
  }
  update() {
    this.widgets.forEach((w, i) => {
      w.upButton.disabled = i === 0;
      w.downButton.disabled = i === this.widgets.length - 1;
    });
    this.onUpdate?.(this.widgets);
  }
  save() {
    if (this.restoring) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          widgets: this.widgets.map((w) => w.serialize()),
        }),
      );
      this.onSave?.(true);
    } catch {
      this.onSave?.(false);
    }
    this.onUpdate?.(this.widgets);
  }
  restore() {
    let saved = null;
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed?.version === 1 && Array.isArray(parsed.widgets))
        saved = parsed.widgets;
    } catch {
      this.onSave?.(false);
    }
    this.restoring = true;
    if (saved === null) {
      this.addWidget(
        "todo",
        {
          tasks: [
            {
              id: crypto.randomUUID(),
              text: "Определить три главные задачи на сегодня",
              done: false,
            },
            {
              id: crypto.randomUUID(),
              text: "Сделать перерыв и выйти на прогулку",
              done: false,
            },
            {
              id: crypto.randomUUID(),
              text: "Подвести итоги рабочего дня",
              done: false,
            },
          ],
        },
        { focus: false },
      );
      ["weather", "focus", "notes", "currency", "quote"].forEach((type) =>
        this.addWidget(type, {}, { focus: false }),
      );
    } else {
      const ids = new Set();
      saved.slice(0, 20).forEach((item) => {
        if (!item || !Object.hasOwn(registry, item.type)) return;
        const config = { ...item };
        if (
          typeof config.id !== "string" ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(config.id) ||
          ids.has(config.id)
        )
          delete config.id;
        const widget = this.addWidget(item.type, config, { focus: false });
        if (widget) ids.add(widget.id);
      });
    }
    this.restoring = false;
    this.save();
    this.update();
  }
  destroy() {
    this.widgets.forEach((w) => w.destroy());
    this.widgets = [];
  }
}

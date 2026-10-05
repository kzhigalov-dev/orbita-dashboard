import UIComponent from "./UIComponent.js";
import SelectControl from "./SelectControl.js";
import { el, button } from "./dom.js";
const zones = {
  "Europe/Moscow": "Москва",
  "Europe/London": "Лондон",
  "Europe/Berlin": "Берлин",
  "Asia/Dubai": "Дубай",
  "Asia/Tokyo": "Токио",
  "America/New_York": "Нью-Йорк",
  "America/Los_Angeles": "Лос-Анджелес",
  "Australia/Sydney": "Сидней",
};
export default class ClockWidget extends UIComponent {
  #timer;
  constructor(config = {}) {
    super({ ...config, title: "Мировое время", type: "clock" });
    this.zone = Object.hasOwn(zones, config.zone) ? config.zone : "Asia/Tokyo";
    this.hour12 = config.hour12 === true;
    this.seconds = config.seconds === true;
  }
  render() {
    if (this.root) return this.root;
    const root = super.render();
    this.zoneSelect = new SelectControl({
      id: `${this.id}-zone`,
      label: "Часовой пояс",
      value: this.zone,
      options: Object.entries(zones).map(([value, label]) => ({
        value,
        label,
      })),
      onChange: (value) => {
        this.zone = value;
        this.paint();
        this.changed();
      },
    });
    this.time = el("time", "world-time");
    this.date = el("p", "world-date");
    this.offset = el("p", "muted");
    const toolbar = el("div", "widget-toolbar");
    this.formatButton = button(
      "12-часовой формат",
      null,
      "button button-secondary",
    );
    this.secondsButton = button(
      "Показать секунды",
      null,
      "button button-secondary",
    );
    this.listen(this.formatButton, "click", () => {
      this.hour12 = !this.hour12;
      this.paint();
      this.changed();
    });
    this.listen(this.secondsButton, "click", () => {
      this.seconds = !this.seconds;
      this.paint();
      this.changed();
    });
    toolbar.append(this.formatButton, this.secondsButton);
    this.body.append(
      this.zoneSelect.root,
      this.time,
      this.date,
      this.offset,
      toolbar,
    );
    this.paint();
    this.#timer = setInterval(() => this.paint(), 1000);
    return root;
  }
  paint() {
    const now = new Date();
    this.time.dateTime = now.toISOString();
    this.time.textContent = new Intl.DateTimeFormat("ru-RU", {
      timeZone: this.zone,
      hour: "2-digit",
      minute: "2-digit",
      ...(this.seconds ? { second: "2-digit" } : {}),
      hour12: this.hour12,
    }).format(now);
    this.date.textContent = new Intl.DateTimeFormat("ru-RU", {
      timeZone: this.zone,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(now);
    this.offset.textContent = new Intl.DateTimeFormat("ru-RU", {
      timeZone: this.zone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value;
    this.formatButton.setAttribute("aria-pressed", String(this.hour12));
    this.secondsButton.setAttribute("aria-pressed", String(this.seconds));
  }
  serialize() {
    return {
      ...super.serialize(),
      zone: this.zone,
      hour12: this.hour12,
      seconds: this.seconds,
    };
  }
  destroy() {
    clearInterval(this.#timer);
    this.zoneSelect?.destroy();
    super.destroy();
  }
}

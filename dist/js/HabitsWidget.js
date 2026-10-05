import UIComponent from "./UIComponent.js";
import { el, button } from "./dom.js";
import { localDay, weekDays } from "./widget-state.js";
export default class HabitsWidget extends UIComponent {
  #timer;
  constructor(config = {}) {
    super({ ...config, title: "Привычки", type: "habits" });
    const validDays = new Set(weekDays().map((d) => d.key));
    this.habits = Array.isArray(config.habits)
      ? config.habits
          .filter((h) => h && typeof h.text === "string")
          .slice(0, 20)
          .map((h) => ({
            id: crypto.randomUUID(),
            text: h.text.slice(0, 80),
            days: [
              ...new Set(
                Array.isArray(h.days)
                  ? h.days.filter((d) => validDays.has(d))
                  : [],
              ),
            ],
          }))
      : [];
    this.day = localDay();
  }
  render() {
    if (this.root) return this.root;
    const root = super.render();
    this.summary = el("p", "habit-summary");
    const form = el("form", "inline-form");
    const label = el("label", "sr-only", "Новая привычка");
    label.htmlFor = `${this.id}-habit`;
    this.input = el("input");
    Object.assign(this.input, {
      id: label.htmlFor,
      maxLength: 80,
      required: true,
      placeholder: "Например, читать 20 минут",
    });
    const add = button(
      "Добавить привычку",
      "plus",
      "button button-primary task-add",
    );
    add.type = "submit";
    form.append(label, this.input, add);
    this.listen(form, "submit", (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      if (this.habits.length >= 20) {
        this.announce("В одном виджете можно вести до 20 привычек.");
        return;
      }
      this.habits.push({ id: crypto.randomUUID(), text, days: [] });
      this.input.value = "";
      this.paint();
      this.changed();
    });
    this.list = el("div", "habit-list");
    this.listen(this.list, "click", (event) => {
      const target = event.target.closest("[data-habit]");
      if (!target) return;
      const habit = this.habits.find((h) => h.id === target.dataset.habit);
      if (!habit) return;
      if (target.dataset.day) {
        const day = target.dataset.day;
        habit.days = habit.days.includes(day)
          ? habit.days.filter((d) => d !== day)
          : [...habit.days, day];
      } else {
        this.habits = this.habits.filter((h) => h !== habit);
      }
      const day = target.dataset.day;
      this.paint();
      this.changed();
      const next = [...this.list.querySelectorAll("button")].find(
        (b) => b.dataset.habit === habit.id && b.dataset.day === day,
      );
      (next ?? this.input).focus({ preventScroll: true });
    });
    this.body.append(
      this.summary,
      form,
      this.list,
      el(
        "p",
        "muted",
        "Отмечайте сегодня и предыдущие дни. История — за последние 7 дней.",
      ),
    );
    this.paint();
    this.#timer = setInterval(() => {
      const day = localDay();
      if (day !== this.day) {
        this.day = day;
        this.paint();
        this.changed();
      }
    }, 30000);
    return root;
  }
  paint() {
    const days = weekDays();
    const validDays = new Set(days.map((d) => d.key));
    this.habits.forEach((h) => {
      h.days = h.days.filter((d) => validDays.has(d));
    });
    const done = this.habits.filter((h) => h.days.includes(localDay())).length;
    this.summary.textContent = this.habits.length
      ? `Сегодня: ${done} из ${this.habits.length} привычек`
      : "Маленькое действие каждый день";
    this.list.replaceChildren();
    if (!this.habits.length)
      this.list.append(
        el(
          "p",
          "muted",
          "Добавьте привычку и отмечайте дни, когда уделили ей время.",
        ),
      );
    for (const habit of this.habits) {
      const row = el("section", "habit-row");
      const heading = el("div", "habit-heading");
      const remove = button(`Удалить привычку «${habit.text}»`, "trash");
      remove.dataset.habit = habit.id;
      heading.append(el("h3", "", habit.text), remove);
      const week = el("div", "habit-week");
      for (const day of days) {
        const b = button(`${habit.text}: ${day.date}`, null, "habit-day");
        b.textContent = day.label;
        b.dataset.habit = habit.id;
        b.dataset.day = day.key;
        b.setAttribute("aria-pressed", String(habit.days.includes(day.key)));
        if (day.key === localDay()) b.classList.add("is-today");
        week.append(b);
      }
      row.append(
        heading,
        week,
        el("span", "muted", `${habit.days.length} из 7 дней`),
      );
      this.list.append(row);
    }
  }
  serialize() {
    return { ...super.serialize(), habits: this.habits };
  }
  destroy() {
    clearInterval(this.#timer);
    super.destroy();
  }
}

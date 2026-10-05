import UIComponent from "./UIComponent.js";
import { el, button, icon } from "./dom.js";
export default class ToDoWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: "Мои задачи", type: "todo" });
    this.tasks = Array.isArray(config.tasks)
      ? config.tasks
          .filter(
            (t) => t && typeof t.id === "string" && typeof t.text === "string",
          )
          .slice(0, 200)
          .map((t) => ({
            id: t.id,
            text: t.text.slice(0, 200),
            done: t.done === true,
          }))
      : [];
    this.filter = ["all", "active", "done"].includes(config.filter)
      ? config.filter
      : "all";
  }
  render() {
    const root = super.render();
    this.progressText = el("p", "task-progress-label");
    this.progress = el("progress", "task-progress");
    this.progress.max = 100;
    this.progress.setAttribute("aria-label", "Выполнение задач");
    const filters = el("div", "task-filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Фильтр задач");
    this.filterButtons = Object.entries({
      all: "Все",
      active: "В работе",
      done: "Готово",
    }).map(([value, label]) => {
      const b = button(label, null, "filter-button");
      b.dataset.filter = value;
      this.listen(b, "click", () => {
        this.filter = value;
        this.paint();
        this.changed();
      });
      filters.append(b);
      return b;
    });
    const form = el("form", "task-form");
    const label = el("label", "sr-only", "Новая задача");
    label.htmlFor = `${this.id}-input`;
    this.input = el("input");
    this.input.id = label.htmlFor;
    this.input.name = "task";
    this.input.placeholder = "Что нужно сделать?";
    this.input.maxLength = 200;
    this.input.required = true;
    this.input.autocomplete = "off";
    const add = button(
      "Добавить задачу",
      "plus",
      "button button-primary task-add",
    );
    add.type = "submit";
    form.append(label, this.input, add);
    this.errorNode = el("p", "form-error");
    this.errorNode.id = `${this.id}-error`;
    this.errorNode.setAttribute("role", "status");
    this.input.setAttribute("aria-describedby", this.errorNode.id);
    this.list = el("ul", "task-list");
    this.listen(form, "submit", (event) => {
      event.preventDefault();
      const text = this.input.value.trim();
      if (!text) {
        this.errorNode.textContent = "Введите текст задачи.";
        this.input.focus();
        return;
      }
      if (this.tasks.length >= 200) {
        this.errorNode.textContent =
          "Сначала удалите несколько задач: лимит — 200.";
        return;
      }
      this.tasks.push({ id: crypto.randomUUID(), text, done: false });
      this.input.value = "";
      this.errorNode.textContent = "";
      this.paint();
      this.changed();
      this.announce("Задача добавлена.");
      this.animateTask(this.tasks.at(-1).id);
    });
    this.listen(this.list, "change", (event) => {
      const id = event.target.dataset.task;
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return;
      task.done = event.target.checked;
      const index = this.tasks.indexOf(task);
      this.paint();
      this.changed();
      this.focusTask(index);
      this.animateTask(id);
      this.announce(
        task.done ? "Задача выполнена." : "Задача возвращена в работу.",
      );
    });
    this.listen(this.list, "click", (event) => {
      const target = event.target.closest("[data-delete]");
      if (!target) return;
      const index = this.tasks.findIndex((t) => t.id === target.dataset.delete);
      if (index < 0) return;
      this.tasks.splice(index, 1);
      this.paint();
      this.changed();
      this.focusTask(index);
      this.announce("Задача удалена.");
    });
    this.body.append(
      this.progressText,
      this.progress,
      filters,
      form,
      this.errorNode,
      this.list,
    );
    this.paint();
    return root;
  }
  focusTask(index) {
    const checks = this.list.querySelectorAll("input");
    (checks[Math.min(index, checks.length - 1)] ?? this.input).focus();
  }
  animateTask(id) {
    const check = [...this.list.querySelectorAll("input")].find((node) => node.dataset.task === id);
    if (check) this.animate(check.closest(".task-row"), [
      { backgroundColor: "#dcebcf", transform: "translateX(4px)" },
      { backgroundColor: "transparent", transform: "translateX(0)" },
    ], { duration: 420 });
  }
  paint() {
    const done = this.tasks.filter((t) => t.done).length;
    this.progressText.textContent = this.tasks.length
      ? `${done} из ${this.tasks.length} выполнено`
      : "Освободите голову. Запишите первую задачу.";
    this.progress.value = this.tasks.length
      ? (done / this.tasks.length) * 100
      : 0;
    this.filterButtons.forEach((b) => {
      const active = b.dataset.filter === this.filter;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    this.list.replaceChildren();
    const tasks = this.tasks.filter(
      (t) =>
        this.filter === "all" || (this.filter === "done" ? t.done : !t.done),
    );
    if (!tasks.length) {
      const empty = el("li", "task-empty");
      empty.append(
        icon("check"),
        el(
          "p",
          "",
          this.filter === "all"
            ? "Здесь начинается ваш план"
            : this.filter === "active"
              ? "Всё сделано. Хорошая работа!"
              : "Завершённые задачи появятся здесь",
        ),
        el(
          "span",
          "muted",
          this.filter === "all"
            ? "Добавьте задачу в поле выше."
            : "Переключите фильтр, чтобы увидеть другие задачи.",
        ),
      );
      this.list.append(empty);
    }
    tasks.forEach((task) => {
      const row = el("li", `task-row${task.done ? " is-done" : ""}`);
      const label = el("label", "task-label");
      const check = el("input");
      check.type = "checkbox";
      check.checked = task.done;
      check.dataset.task = task.id;
      label.append(check, el("span", "", task.text));
      const remove = button(`Удалить задачу «${task.text}»`, "trash");
      remove.dataset.delete = task.id;
      row.append(label, remove);
      this.list.append(row);
    });
  }
  serialize() {
    return { ...super.serialize(), tasks: this.tasks, filter: this.filter };
  }
}

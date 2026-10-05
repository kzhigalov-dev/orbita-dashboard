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
            important: t.important === true,
          }))
      : [];
    this.importantFirst = config.importantFirst === true;
    this.filter = ["all", "active", "done"].includes(config.filter)
      ? config.filter
      : "all";
  }
  render() {
    if (this.root) return this.root;
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
    const toolbar = el("div", "widget-toolbar task-toolbar");
    this.sortButton = button("Важные сначала", null, "button button-secondary");
    this.clearButton = button(
      "Убрать выполненные",
      null,
      "button button-secondary",
    );
    this.undoButton = button("Вернуть задачи", null, "button button-secondary");
    this.undoButton.hidden = true;
    this.listen(this.sortButton, "click", () => {
      this.importantFirst = !this.importantFirst;
      this.paint();
      this.changed();
    });
    this.listen(this.clearButton, "click", () => {
      this.previousTasks = structuredClone(this.tasks);
      this.tasks = this.tasks.filter((t) => !t.done);
      this.undoButton.hidden = false;
      this.paint();
      this.changed();
    });
    this.listen(this.undoButton, "click", () => {
      const ids = new Set(this.tasks.map((t) => t.id));
      this.tasks.push(
        ...this.previousTasks
          .filter((t) => !ids.has(t.id))
          .slice(0, 200 - this.tasks.length),
      );
      this.undoButton.hidden = true;
      this.paint();
      this.changed();
    });
    toolbar.append(this.sortButton, this.clearButton, this.undoButton);
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
    this.addButton = add;
    add.type = "submit";
    const syncEditButton = () => {
      const label = this.editingId ? "Сохранить задачу" : "Добавить задачу";
      add.setAttribute("aria-label", label);
      add.title = label;
      add.replaceChildren(icon(this.editingId ? "check" : "plus"));
    };
    this.cancelEdit = button("Отменить редактирование", "close");
    this.cancelEdit.hidden = true;
    this.listen(this.cancelEdit, "click", () => {
      this.editingId = null;
      this.input.value = "";
      this.cancelEdit.hidden = true;
      syncEditButton();
      this.input.focus();
    });
    form.append(label, this.input, add, this.cancelEdit);
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
      if (!this.editingId && this.tasks.length >= 200) {
        this.errorNode.textContent =
          "Сначала удалите несколько задач: лимит — 200.";
        return;
      }
      const editing = this.tasks.find((t) => t.id === this.editingId);
      if (editing) editing.text = text;
      else
        this.tasks.push({
          id: crypto.randomUUID(),
          text,
          done: false,
          important: false,
        });
      this.editingId = null;
      this.cancelEdit.hidden = true;
      syncEditButton();
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
      const edit = event.target.closest("[data-edit]");
      if (edit) {
        const task = this.tasks.find((t) => t.id === edit.dataset.edit);
        if (!task) return;
        this.editingId = task.id;
        this.input.value = task.text;
        this.cancelEdit.hidden = false;
        syncEditButton();
        this.input.focus();
        this.input.select();
        return;
      }
      const star = event.target.closest("[data-star]");
      if (star) {
        const task = this.tasks.find((t) => t.id === star.dataset.star);
        if (!task) return;
        task.important = !task.important;
        this.paint();
        this.changed();
        [...this.list.querySelectorAll("[data-star]")]
          .find((b) => b.dataset.star === task.id)
          ?.focus();
        return;
      }
      const target = event.target.closest("[data-delete]");
      if (!target) return;
      const index = this.tasks.findIndex((t) => t.id === target.dataset.delete);
      if (index < 0) return;
      this.tasks.splice(index, 1);
      if (this.editingId === target.dataset.delete) {
        this.editingId = null;
        this.input.value = "";
        this.cancelEdit.hidden = true;
        syncEditButton();
      }
      this.paint();
      this.changed();
      this.focusTask(index);
      this.announce("Задача удалена.");
    });
    this.body.append(
      this.progressText,
      this.progress,
      filters,
      toolbar,
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
    const check = [...this.list.querySelectorAll("input")].find(
      (node) => node.dataset.task === id,
    );
    if (check)
      this.animate(
        check.closest(".task-row"),
        [
          { backgroundColor: "#dcebcf", transform: "translateX(4px)" },
          { backgroundColor: "transparent", transform: "translateX(0)" },
        ],
        { duration: 420 },
      );
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
    this.sortButton.setAttribute("aria-pressed", String(this.importantFirst));
    this.clearButton.disabled = done === 0;
    this.list.replaceChildren();
    const tasks = this.tasks.filter(
      (t) =>
        this.filter === "all" || (this.filter === "done" ? t.done : !t.done),
    );
    if (this.importantFirst)
      tasks.sort((a, b) => Number(b.important) - Number(a.important));
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
      const star = button(`Важная задача «${task.text}»`, "star");
      star.dataset.star = task.id;
      star.setAttribute("aria-pressed", String(task.important));
      const edit = button(`Редактировать задачу «${task.text}»`, "edit");
      edit.dataset.edit = task.id;
      const actions = el("div", "task-row-actions");
      actions.append(star, edit, remove);
      row.append(label, actions);
      this.list.append(row);
    });
  }
  serialize() {
    return {
      ...super.serialize(),
      tasks: this.tasks,
      filter: this.filter,
      importantFirst: this.importantFirst,
    };
  }
}

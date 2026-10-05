import { summarizeTasks } from "./js/day-summary.js";
import Dashboard from "./js/Dashboard.js";
import { icon } from "./js/dom.js";
document
  .querySelectorAll("[data-icon]")
  .forEach((node) => node.append(icon(node.dataset.icon)));
const updateClock = () => {
  const now = new Date();
  document.querySelector("#today").textContent = new Intl.DateTimeFormat(
    "ru-RU",
    { day: "numeric", month: "long", weekday: "long" },
  ).format(now);
  const clock = document.querySelector("#desk-clock");
  clock.textContent = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  clock.dateTime = now.toISOString();
};
updateClock();
const clockTimer = setInterval(updateClock, 10000);
const toast = document.querySelector("#toast");
let toastTimer;
const announce = (text) => {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toastTimer = setTimeout(() => {
    toast.textContent = "";
  }, 4000);
};
const addButtons = [...document.querySelectorAll("[data-add]")];
const dashboard = new Dashboard({
  container: document.querySelector("#dashboard"),
  addButtons,
  announce,
  onSave: (success) => {
    document.querySelector("#save-text").textContent = success
      ? "Сохранено в этом браузере"
      : "Хранилище недоступно: изменения не сохранятся";
    document
      .querySelector("#save-status")
      .classList.toggle("warning", !success);
  },
  onUpdate: (widgets) => {
    const count = widgets.length;
    document.querySelector("#widget-count").textContent = count;
    const label = new Intl.PluralRules("ru-RU").select(count);
    document.querySelector("#workspace-count").textContent =
      `${count} ${{ one: "виджет", few: "виджета", many: "виджетов", other: "виджета" }[label]}`;
    document.querySelector("#dashboard-empty").hidden = count > 0;
    const summary = summarizeTasks(widgets);
    document.querySelector("#day-percent").textContent = summary.total ? `${summary.percent}%` : "—";
    document.querySelector("#day-ring-value").style.strokeDashoffset = 100 - summary.percent;
    document.querySelector(".day-summary").classList.toggle("all-done", summary.total > 0 && summary.remaining === 0);
    document.querySelector("#day-done").textContent = summary.total ? `${summary.done} из ${summary.total} готово` : "Пока нет задач";
    const taskWord = { one: "задача", few: "задачи", many: "задач", other: "задачи" }[new Intl.PluralRules("ru-RU").select(summary.remaining)];
    document.querySelector("#day-remaining").textContent = !summary.total ? "Добавьте список из каталога" :
      summary.remaining ? `${summary.remaining} ${taskWord} в работе` : "Всё сделано. Можно выдохнуть.";
  },
});
const events = new AbortController();
addButtons.forEach((button) =>
  button.addEventListener(
    "click",
    () => dashboard.addWidget(button.dataset.add),
    { signal: events.signal },
  ),
);
document
  .querySelector("#first-widget")
  .addEventListener("click", () => dashboard.addWidget("todo"), {
    signal: events.signal,
  });
window.addEventListener(
  "pagehide",
  (event) => {
    if (event.persisted) return;
    clearTimeout(toastTimer);
    clearInterval(clockTimer);
    events.abort();
    dashboard.destroy();
  },
  { signal: events.signal },
);
dashboard.restore();

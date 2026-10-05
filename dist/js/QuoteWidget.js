import UIComponent from "./UIComponent.js";
import SelectControl from "./SelectControl.js";
import { el, button, icon } from "./dom.js";
const quotes = [
  "Большая работа начинается с одного понятного шага.",
  "Оставьте в сегодняшнем плане место для того, что действительно важно.",
  "Хороший ритм — тот, который можно поддерживать завтра.",
  "Законченная небольшая задача полезнее идеального плана без действий.",
  "Пауза помогает увидеть следующий шаг яснее.",
  "Внимание — ваш самый ценный рабочий инструмент.",
  "Запишите идею, прежде чем искать для неё идеальную форму.",
  "Одна ясная мысль освобождает место для следующей.",
  "Сложный вопрос становится проще, когда его можно нарисовать.",
  "Проверка предположения полезнее ещё одного предположения.",
  "Можно закончить рабочий день, даже если не закончились задачи.",
  "Отдых тоже занимает место в хорошем плане.",
];
const themes = [
  "focus",
  "focus",
  "balance",
  "focus",
  "balance",
  "focus",
  "ideas",
  "ideas",
  "ideas",
  "ideas",
  "balance",
  "balance",
];
export default class QuoteWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: "Мысль на день", type: "quote" });
    this.index =
      Number.isInteger(config.index) &&
      config.index >= 0 &&
      config.index < quotes.length
        ? config.index
        : Math.floor(Math.random() * quotes.length);
    this.category = ["focus", "balance", "ideas"].includes(config.category)
      ? config.category
      : "all";
    this.favorites = Array.isArray(config.favorites)
      ? [
          ...new Set(
            config.favorites.filter(
              (i) => Number.isInteger(i) && i >= 0 && i < quotes.length,
            ),
          ),
        ]
      : [];
    this.onlyFavorites = config.onlyFavorites === true;
  }
  choices() {
    return quotes
      .map((_, i) => i)
      .filter(
        (i) =>
          (this.category === "all" || themes[i] === this.category) &&
          (!this.onlyFavorites || this.favorites.includes(i)),
      );
  }
  render() {
    if (this.root) return this.root;
    const root = super.render();
    this.categorySelect = new SelectControl({
      id: `${this.id}-category`,
      label: "Тема мысли",
      value: this.category,
      options: Object.entries({
        all: "Все темы",
        focus: "Фокус",
        balance: "Баланс",
        ideas: "Идеи",
      }).map(([value, label]) => ({ value, label })),
      onChange: (value) => {
        this.category = value;
        this.paint();
        this.changed();
      },
    });
    this.quote = el("blockquote", "quote-text");
    this.quote.setAttribute("aria-live", "polite");
    const toolbar = el("div", "widget-toolbar");
    this.starButton = button("В избранное", null, "button button-secondary");
    this.favoriteFilter = button("Избранное", null, "button button-secondary");
    this.listen(this.starButton, "click", () => {
      this.favorites = this.favorites.includes(this.index)
        ? this.favorites.filter((i) => i !== this.index)
        : [...this.favorites, this.index];
      this.paint();
      this.changed();
    });
    this.listen(this.favoriteFilter, "click", () => {
      this.onlyFavorites = !this.onlyFavorites;
      this.paint();
      this.changed();
    });
    toolbar.append(this.starButton, this.favoriteFilter);
    this.refresh = button("Другая мысль", null, "button button-secondary");
    this.refresh.replaceChildren(
      icon("refresh"),
      el("span", "", "Другая мысль"),
    );
    this.listen(this.refresh, "click", () => {
      const choices = this.choices().filter((i) => i !== this.index);
      if (choices.length)
        this.index = choices[Math.floor(Math.random() * choices.length)];
      this.paint();
      this.animate(this.quote, [{ opacity: 0.4 }, { opacity: 1 }]);
      this.changed();
    });
    const footer = el("div", "quote-footer");
    footer.append(
      el("span", "muted", "Авторские мысли · редакция «Орбиты»"),
      this.refresh,
    );
    this.body.append(this.categorySelect.root, this.quote, toolbar, footer);
    this.paint();
    return root;
  }
  paint() {
    const choices = this.choices();
    if (choices.length && !choices.includes(this.index))
      this.index = choices[0];
    this.quote.textContent = choices.length
      ? quotes[this.index]
      : "В этой теме пока нет избранных мыслей. Отключите фильтр «Избранное» и сохраните понравившуюся.";
    this.refresh.disabled = choices.length < 2;
    this.starButton.disabled = !choices.length;
    const favorite = this.favorites.includes(this.index);
    this.starButton.textContent = favorite
      ? "Убрать из избранного"
      : "В избранное";
    this.starButton.setAttribute("aria-label", this.starButton.textContent);
    this.starButton.title = this.starButton.textContent;
    this.starButton.setAttribute("aria-pressed", String(favorite));
    this.favoriteFilter.setAttribute(
      "aria-pressed",
      String(this.onlyFavorites),
    );
  }
  serialize() {
    return {
      ...super.serialize(),
      index: this.index,
      category: this.category,
      favorites: this.favorites,
      onlyFavorites: this.onlyFavorites,
    };
  }
  destroy() {
    this.categorySelect?.destroy();
    super.destroy();
  }
}

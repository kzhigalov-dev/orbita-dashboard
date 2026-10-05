import UIComponent from "./UIComponent.js";
import { el, button, icon } from "./dom.js";
const quotes = [
  "Большая работа начинается с одного понятного шага.",
  "Оставьте в сегодняшнем плане место для того, что действительно важно.",
  "Хороший ритм — тот, который можно поддерживать завтра.",
  "Законченная небольшая задача полезнее идеального плана без действий.",
  "Пауза помогает увидеть следующий шаг яснее.",
  "Внимание — ваш самый ценный рабочий инструмент.",
];
export default class QuoteWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: "Мысль на день", type: "quote" });
    this.index =
      Number.isInteger(config.index) &&
      config.index >= 0 &&
      config.index < quotes.length
        ? config.index
        : 0;
  }
  render() {
    const root = super.render();
    this.quote = el("blockquote", "quote-text", quotes[this.index]);
    this.quote.setAttribute("aria-live", "polite");
    const footer = el("div", "quote-footer");
    const refresh = button("Другая мысль", null, "button button-secondary");
    refresh.replaceChildren(icon("refresh"), el("span", "", "Другая мысль"));
    this.listen(refresh, "click", () => {
      this.index =
        (this.index + 1 + Math.floor(Math.random() * (quotes.length - 1))) %
        quotes.length;
      this.quote.textContent = quotes[this.index];
      this.changed();
    });
    footer.append(el("span", "muted", "Редакция «Орбиты»"), refresh);
    this.body.append(this.quote, footer);
    return root;
  }
  serialize() {
    return { ...super.serialize(), index: this.index };
  }
}

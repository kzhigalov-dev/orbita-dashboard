import UIComponent from "./UIComponent.js";
import { el, button, format } from "./dom.js";
import { calculate } from "./widget-state.js";
export default class CalculatorWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: "Калькулятор", type: "calculator" });
    this.expression =
      typeof config.expression === "string"
        ? config.expression.slice(0, 120)
        : "";
    this.history = Array.isArray(config.history)
      ? config.history
          .filter(
            (h) =>
              h &&
              typeof h.expression === "string" &&
              h.expression.length <= 120 &&
              Number.isFinite(h.result),
          )
          .slice(0, 5)
      : [];
  }
  render() {
    if (this.root) return this.root;
    const root = super.render();
    const form = el("form");
    const label = el("label", "field-label", "Пример");
    label.htmlFor = `${this.id}-expression`;
    this.input = el("input", "calculator-input");
    Object.assign(this.input, {
      id: label.htmlFor,
      maxLength: 120,
      value: this.expression,
      placeholder: "(120 + 30) × 2",
      autocomplete: "off",
    });
    this.output = el("output", "calculator-output");
    this.output.setAttribute("aria-live", "polite");
    const keys = el("div", "calculator-keys");
    for (const key of [
      "C",
      "(",
      ")",
      "÷",
      "7",
      "8",
      "9",
      "×",
      "4",
      "5",
      "6",
      "−",
      "1",
      "2",
      "3",
      "+",
      "⌫",
      "0",
      ",",
      "=",
    ]) {
      const labels = {
        C: "Очистить пример",
        "⌫": "Стереть последний символ",
        "=": "Вычислить",
        "÷": "Разделить",
        "×": "Умножить",
        "−": "Вычесть",
        "+": "Сложить",
      };
      const b = button(
        labels[key] ?? key,
        null,
        `calculator-key${key === "=" ? " is-equals" : ""}`,
      );
      b.textContent = key;
      this.listen(b, "click", () => {
        if (key === "=") return this.compute();
        this.expression =
          key === "C"
            ? ""
            : key === "⌫"
              ? this.expression.slice(0, -1)
              : (this.expression + key).slice(0, 120);
        this.input.value = this.expression;
        this.output.textContent = "";
        this.changed();
      });
      keys.append(b);
    }
    this.listen(form, "submit", (event) => {
      event.preventDefault();
      this.compute();
    });
    this.listen(this.input, "input", () => {
      this.expression = this.input.value;
      this.output.textContent = "";
      this.changed();
    });
    form.append(label, this.input, this.output, keys);
    this.historyNode = el("div", "calculator-history");
    const clear = button("Очистить историю", null, "button button-secondary");
    this.listen(clear, "click", () => {
      this.history = [];
      this.paintHistory();
      this.changed();
    });
    this.body.append(
      form,
      el(
        "p",
        "muted",
        "Скобки, + − × ÷ и %. Процент — число, делённое на 100.",
      ),
      this.historyNode,
      clear,
    );
    this.paintHistory();
    if (this.history[0]?.expression === this.expression) {
      try {
        this.output.textContent = format(calculate(this.expression), 2);
      } catch {
        /* Leave an unfinished draft editable. */
      }
    }
    return root;
  }
  compute() {
    try {
      const result = calculate(this.expression);
      this.output.textContent = format(
        result,
        Math.min(8, (String(result).split(".")[1] ?? "").length),
      );
      this.history.unshift({ expression: this.expression, result });
      this.history = this.history.slice(0, 5);
      this.paintHistory();
      this.changed();
    } catch (error) {
      this.output.textContent = error.message;
    }
  }
  paintHistory() {
    // Events are delegated once; replacing history never accumulates listeners.
    this.historyNode.replaceChildren();
    if (!this.historyListening) {
      this.listen(this.historyNode, "click", (event) => {
        const item =
          this.history[
            Number(event.target.closest("[data-history]")?.dataset.history)
          ];
        if (!item) return;
        this.expression = item.expression;
        this.input.value = this.expression;
        this.output.textContent = "";
        this.input.focus();
        this.changed();
      });
      this.historyListening = true;
    }
    this.history.forEach((h, i) => {
      const b = button(`Повторить ${h.expression}`, null, "history-item");
      b.textContent = `${h.expression} = ${format(h.result, 2)}`;
      b.dataset.history = String(i);
      this.historyNode.append(b);
    });
  }
  serialize() {
    return {
      ...super.serialize(),
      expression: this.expression,
      history: this.history,
    };
  }
}

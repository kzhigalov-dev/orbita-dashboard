import APIWidget from "./APIWidget.js";
import { el, sourceLink, format } from "./dom.js";
import { currencies, parseRates } from "./data.js";
// Rate limit shared by all currency widget instances: fewer than 30 requests/minute.
let nextRequestAt = 0;
const cache = { data: null, at: 0 };
export default class CurrencyWidget extends APIWidget {
  #delay;
  #resolveDelay;
  #ticket = 0;
  constructor(config = {}) {
    super({ ...config, title: "Курсы валют", type: "currency" });
    this.amount =
      typeof config.amount === "string" ? config.amount.slice(0, 12) : "1000";
    this.currency = Object.hasOwn(currencies, config.currency)
      ? config.currency
      : "USD";
  }
  render() {
    const root = super.render();
    const footer = el("footer", "api-footer");
    footer.append(
      sourceLink("https://www.cbr-xml-daily.ru/", "API для курсов ЦБ РФ"),
      this.refreshButton,
    );
    this.body.append(this.statusNode, this.resultNode, footer);
    return root;
  }
  async load() {
    if (this.destroyed) return;
    this.cancelRequest();
    clearTimeout(this.#delay);
    this.#resolveDelay?.();
    const ticket = ++this.#ticket;
    if (cache.data && Date.now() - cache.at < 30000) {
      this.setState("success", cache.data);
      return;
    }
    this.setState("loading");
    const delay = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Date.now() + delay + 2100;
    await new Promise((resolve) => {
      this.#resolveDelay = resolve;
      this.#delay = setTimeout(resolve, delay);
    });
    if (this.destroyed || ticket !== this.#ticket) return;
    this.#resolveDelay = null;
    await this.runRequest(
      "https://www.cbr-xml-daily.ru/daily_json.js",
      parseRates,
    );
    if (
      !this.destroyed &&
      ticket === this.#ticket &&
      this.status === "success"
    ) {
      cache.data = this.data;
      cache.at = Date.now();
    }
  }
  renderData(data) {
    this.resultNode.replaceChildren();
    const date = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Moscow",
    }).format(new Date(data.date));
    this.resultNode.append(
      el("p", "rate-date", `Официальные курсы на ${date}`),
    );
    const list = el("dl", "rate-list");
    data.rates.forEach((rate) => {
      const row = el("div", "rate-row");
      const name = el("dt");
      name.append(
        el("strong", "", rate.code),
        el("span", "muted", currencies[rate.code]),
      );
      const value = el("dd");
      value.append(
        el("strong", "", `${format(rate.rate, 2)} ₽`),
        el(
          "span",
          `rate-change ${rate.change > 0 ? "rise" : "fall"}`,
          `${rate.change > 0 ? "+" : ""}${format(rate.change, 2)} ₽`,
        ),
      );
      row.append(name, value);
      list.append(row);
    });
    const form = el("div", "converter");
    const label = el("label", "", "Пересчитать рубли");
    label.htmlFor = `${this.id}-amount`;
    const line = el("div", "converter-line");
    const input = el("input");
    input.id = label.htmlFor;
    input.type = "number";
    input.min = "0";
    input.max = "1000000000";
    input.step = "any";
    input.inputMode = "decimal";
    input.value = this.amount;
    input.name = "amount";
    const select = el("select");
    select.setAttribute("aria-label", "Валюта результата");
    Object.keys(currencies).forEach((code) => {
      const option = el("option", "", code);
      option.value = code;
      select.append(option);
    });
    select.value = this.currency;
    const output = el("output", "conversion-output");
    output.setAttribute("aria-live", "polite");
    const update = () => {
      this.amount = input.value;
      this.currency = select.value;
      const value = Number(input.value);
      const rate = data.rates.find((r) => r.code === select.value)?.rate;
      output.textContent =
        input.value === ""
          ? "Введите сумму в рублях"
          : !input.validity.valid || !Number.isFinite(value)
            ? "Введите сумму от 0 до 1 000 000 000 ₽"
            : `${format(value / rate, 2)} ${select.value}`;
    };
    // Delegation avoids retaining handlers on replaced converter nodes after refresh.
    line.append(input, el("span", "converter-divider", "в"), select);
    form.append(label, line, output);
    this.resultNode.append(list, form);
    this.converterUpdate = update;
    update();
    if (!this.converterListening) {
      this.listen(this.resultNode, "input", () => {
        this.converterUpdate?.();
        this.changed();
      });
      this.listen(this.resultNode, "change", () => {
        this.converterUpdate?.();
        this.changed();
      });
      this.converterListening = true;
    }
  }
  serialize() {
    return {
      ...super.serialize(),
      amount: this.amount,
      currency: this.currency,
    };
  }
  destroy() {
    this.#ticket++;
    clearTimeout(this.#delay);
    this.#resolveDelay?.();
    this.converterUpdate = null;
    super.destroy();
  }
}

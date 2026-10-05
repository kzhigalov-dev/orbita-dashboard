import APIWidget from "./APIWidget.js";
import SelectControl from "./SelectControl.js";
import { el, button, sourceLink, format } from "./dom.js";
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
    this.from =
      config.from === "RUB" || Object.hasOwn(currencies, config.from)
        ? config.from
        : "RUB";
    this.currency =
      config.currency === "RUB" || Object.hasOwn(currencies, config.currency)
        ? config.currency
        : "USD";
  }
  render() {
    if (this.root) return this.root;
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
    this.currencySelect?.close();
    this.fromSelect?.close();
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
    if (!this.converterForm) this.renderConverter();
    const date = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Moscow",
    }).format(new Date(data.date));
    const dateNode = el("p", "rate-date", `Официальные курсы на ${date}`);
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
    this.ratesNode.replaceChildren(dateNode, list);
    this.updateConverter();
  }
  renderConverter() {
    this.ratesNode = el("div");
    this.converterForm = el("div", "converter");
    const label = el("label", "", "Сумма для пересчёта");
    label.htmlFor = `${this.id}-amount`;
    const line = el("div", "converter-line");
    this.amountInput = el("input");
    Object.assign(this.amountInput, {
      id: label.htmlFor,
      type: "number",
      min: "0",
      max: "1000000000",
      step: "any",
      inputMode: "decimal",
      value: this.amount,
      name: "amount",
    });
    this.currencySelect = new SelectControl({
      id: `${this.id}-currency`,
      label: "Валюта результата",
      className: "currency-select",
      value: this.currency,
      options: ["RUB", ...Object.keys(currencies)].map((code) => ({
        value: code,
        label: code,
      })),
      onChange: (value) => {
        this.currency = value;
        this.updateConverter();
        this.changed();
      },
    });
    this.fromSelect = new SelectControl({
      id: `${this.id}-from`,
      label: "Исходная валюта",
      className: "currency-select",
      value: this.from,
      options: ["RUB", ...Object.keys(currencies)].map((code) => ({
        value: code,
        label: code,
      })),
      onChange: (value) => {
        this.from = value;
        this.updateConverter();
        this.changed();
      },
    });
    const swap = button("Поменять валюты местами", "refresh");
    this.listen(swap, "click", () => {
      [this.from, this.currency] = [this.currency, this.from];
      this.fromSelect.value = this.from;
      this.currencySelect.value = this.currency;
      this.fromSelect.sync();
      this.currencySelect.sync();
      this.updateConverter();
      this.changed();
    });
    const pair = el("div", "converter-pair");
    pair.append(this.fromSelect.root, swap, this.currencySelect.root);
    this.conversionOutput = el("output", "conversion-output");
    this.conversionOutput.setAttribute("aria-live", "polite");
    this.listen(this.amountInput, "input", () => {
      this.amount = this.amountInput.value;
      this.updateConverter();
      this.changed();
    });
    line.append(this.amountInput);
    this.converterForm.append(
      label,
      line,
      pair,
      this.conversionOutput,
      el("p", "muted", "Справочный пересчёт по курсам ЦБ РФ"),
    );
    this.resultNode.append(this.ratesNode, this.converterForm);
  }
  updateConverter() {
    const value = Number(this.amountInput.value);
    const rate =
      this.currency === "RUB"
        ? 1
        : this.data?.rates.find((r) => r.code === this.currency)?.rate;
    const fromRate =
      this.from === "RUB"
        ? 1
        : this.data?.rates.find((r) => r.code === this.from)?.rate;
    this.conversionOutput.textContent =
      this.amountInput.value === ""
        ? "Введите сумму"
        : !this.amountInput.validity.valid || !Number.isFinite(value)
          ? "Введите сумму от 0 до 1 000 000 000"
          : !rate || !fromRate
            ? "Курс пока недоступен"
            : `${format((value * fromRate) / rate, 2)} ${this.currency}`;
  }
  serialize() {
    return {
      ...super.serialize(),
      amount: this.amount,
      currency: this.currency,
      from: this.from,
    };
  }
  destroy() {
    this.#ticket++;
    clearTimeout(this.#delay);
    this.#resolveDelay?.();
    this.currencySelect?.destroy();
    this.fromSelect?.destroy();
    super.destroy();
  }
}

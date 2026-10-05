import UIComponent from "./UIComponent.js";
import { el, button, icon } from "./dom.js";
export default class APIWidget extends UIComponent {
  #controller;
  #sequence = 0;
  #timeout;
  constructor(config) {
    super(config);
    this.status = "idle";
    this.data = null;
  }
  render() {
    const root = super.render();
    this.statusNode = el("div", "api-status");
    this.statusNode.setAttribute("role", "status");
    this.statusNode.setAttribute("aria-live", "polite");
    this.resultNode = el("div", "api-result");
    this.refreshButton = button(
      this.type === "weather" ? "Обновить погоду" : "Обновить курсы валют",
      null,
      "button button-secondary refresh-button",
    );
    this.refreshButton.replaceChildren(
      icon("refresh"),
      el("span", "", "Обновить"),
    );
    this.listen(this.refreshButton, "click", async () => {
      await this.load();
      if (!this.destroyed && this.status === "success")
        this.announce(`«${this.title}»: данные обновлены.`);
    });
    return root;
  }
  setState(status, data = null, message = "") {
    if (this.destroyed) return;
    this.status = status;
    this.data = data;
    if (!this.statusNode) return;
    this.resultNode.hidden = status !== "success";
    this.statusNode.hidden = status === "success";
    this.resultNode.setAttribute("aria-busy", String(status === "loading"));
    this.statusNode.replaceChildren();
    this.root?.classList.toggle("has-error", status === "error");
    if (status === "success") {
      this.renderData(data);
      return;
    }
    const labels = {
      loading: ["Загружаем данные…", "Подождите несколько секунд."],
      empty: ["Данных пока нет", "Попробуйте обновить виджет позже."],
      error: [
        "Не удалось загрузить",
        message || "Проверьте соединение и нажмите «Обновить».",
      ],
    };
    const [title, detail] = labels[status] ?? ["", ""];
    if (status === "loading") this.statusNode.append(el("span", "loader"));
    this.statusNode.append(
      el("p", "state-title", title),
      el("p", "muted", detail),
    );
  }
  cancelRequest() {
    this.#sequence++;
    this.#controller?.abort();
    clearTimeout(this.#timeout);
  }
  async runRequest(url, parse) {
    if (this.destroyed) return;
    this.cancelRequest();
    const controller = new AbortController();
    this.#controller = controller;
    const sequence = ++this.#sequence;
    this.setState("loading");
    let timedOut = false;
    this.#timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok)
        throw new Error(
          `Сервис ответил с ошибкой ${response.status}. Попробуйте позже.`,
        );
      const data = parse(await response.json());
      if (
        this.destroyed ||
        sequence !== this.#sequence ||
        controller.signal.aborted
      )
        return;
      this.setState(data === null ? "empty" : "success", data);
    } catch (error) {
      if (this.destroyed || sequence !== this.#sequence) return;
      if (controller.signal.aborted && !timedOut) return;
      this.setState(
        "error",
        null,
        timedOut
          ? "Сервис не ответил за 15 секунд. Попробуйте ещё раз."
          : error instanceof TypeError
            ? "Проверьте интернет-соединение и нажмите «Обновить»."
            : error.message,
      );
    } finally {
      if (sequence === this.#sequence) clearTimeout(this.#timeout);
    }
  }
  destroy() {
    this.cancelRequest();
    super.destroy();
  }
}

import { el, button, icon } from "./dom.js";
export default class UIComponent {
  #listeners = [];
  constructor({
    id = crypto.randomUUID(),
    title,
    type,
    minimized = false,
    onClose,
    onMove,
    onChange,
    announce = () => {},
  } = {}) {
    Object.assign(this, {
      id,
      title,
      type,
      minimized,
      onClose,
      onMove,
      onChange,
      announce,
    });
    this.destroyed = false;
    this.root = null;
  }
  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.#listeners.push(() =>
      target.removeEventListener(event, handler, options),
    );
  }
  render() {
    if (this.root) return this.root;
    const root = el("article", `widget widget-${this.type}`);
    root.id = this.id;
    root.setAttribute("aria-labelledby", `${this.id}-title`);
    const header = el("header", "widget-header");
    const titleGroup = el("div", "widget-title");
    titleGroup.append(
      icon(
        {
          todo: "tasks",
          weather: "weather",
          currency: "currency",
          quote: "quote",
        }[this.type],
      ),
    );
    const heading = el("h2", "", this.title);
    heading.id = `${this.id}-title`;
    titleGroup.append(heading);
    const actions = el("div", "widget-actions");
    this.upButton = button(`Переместить «${this.title}» раньше`, "up");
    this.downButton = button(`Переместить «${this.title}» позже`, "down");
    this.toggleButton = button(`Свернуть «${this.title}»`, null);
    this.toggleButton.textContent = "−";
    this.toggleButton.setAttribute("aria-controls", `${this.id}-body`);
    const closeButton = button(`Удалить виджет «${this.title}»`, "close");
    this.listen(this.upButton, "click", () => this.onMove?.(this.id, -1));
    this.listen(this.downButton, "click", () => this.onMove?.(this.id, 1));
    this.listen(this.toggleButton, "click", () => this.minimize());
    this.listen(closeButton, "click", () => this.onClose?.(this.id));
    actions.append(
      this.upButton,
      this.downButton,
      this.toggleButton,
      closeButton,
    );
    header.append(titleGroup, actions);
    this.body = el("div", "widget-body");
    this.body.id = `${this.id}-body`;
    root.append(header, this.body);
    this.root = root;
    this.syncMinimize();
    return root;
  }
  syncMinimize() {
    this.body.hidden = this.minimized;
    this.root.classList.toggle("is-minimized", this.minimized);
    this.toggleButton.textContent = this.minimized ? "+" : "−";
    this.toggleButton.setAttribute("aria-expanded", String(!this.minimized));
    this.toggleButton.setAttribute(
      "aria-label",
      `${this.minimized ? "Развернуть" : "Свернуть"} «${this.title}»`,
    );
  }
  minimize() {
    this.minimized = !this.minimized;
    this.syncMinimize();
    this.changed();
  }
  changed() {
    if (!this.destroyed) this.onChange?.();
  }
  serialize() {
    return { id: this.id, type: this.type, minimized: this.minimized };
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.#listeners.splice(0).forEach((remove) => remove());
    this.root?.remove();
  }
}

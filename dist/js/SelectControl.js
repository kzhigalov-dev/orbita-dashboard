import { el, icon } from "./dom.js";

// HTML listbox avoids platform select popups that fail inside embedded browsers.
export default class SelectControl {
  #controller = new AbortController();
  #active = 0;
  #search = "";
  #searchAt = 0;
  constructor({ id, label, options, value, className = "", onChange }) {
    Object.assign(this, { options, value, onChange });
    this.root = el("div", `select-control ${className}`);
    this.trigger = el("button", "select-trigger");
    this.trigger.type = "button";
    this.trigger.id = id;
    this.trigger.setAttribute("role", "combobox");
    this.trigger.setAttribute("aria-label", label);
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-controls", `${id}-options`);
    this.text = el("span", "select-value");
    this.trigger.append(this.text, icon("down"));
    this.root.append(this.trigger);
    this.menu = el("div", "select-menu");
    this.menu.id = `${id}-options`;
    this.menu.setAttribute("role", "listbox");
    this.menu.setAttribute("aria-label", label);
    this.menu.hidden = true;
    this.items = options.map((option, index) => {
      const item = el("button", "select-option", option.label);
      item.type = "button";
      item.tabIndex = -1;
      item.id = `${id}-option-${index}`;
      item.setAttribute("role", "option");
      this.listen(item, "click", () => this.choose(index));
      this.listen(item, "pointermove", () => this.activate(index));
      this.menu.append(item);
      return item;
    });
    // Portal: the menu cannot be clipped by a widget or its scrolling container.
    document.body.append(this.menu);
    this.sync();
    this.listen(this.trigger, "click", () => this.menu.hidden ? this.open() : this.close());
    this.listen(this.trigger, "keydown", (event) => this.keydown(event));
    this.listen(this.trigger, "blur", () => this.close());
    this.listen(document, "pointerdown", (event) => {
      if (!this.root.contains(event.target) && !this.menu.contains(event.target)) this.close();
    });
    // Prevent pointer focus from leaving the combobox before an option's click.
    this.listen(this.menu, "pointerdown", (event) => event.preventDefault());
    this.listen(window, "resize", () => this.position());
    this.listen(document, "scroll", () => this.position(), true);
  }
  listen(target, name, handler, capture = false) {
    target.addEventListener(name, handler, { signal: this.#controller.signal, capture });
  }
  sync() {
    const selected = this.options.findIndex((option) => option.value === this.value);
    this.text.textContent = this.options[selected]?.label ?? "";
    this.items.forEach((item, index) => item.setAttribute("aria-selected", String(index === selected)));
  }
  open() {
    this.menu.hidden = false;
    this.trigger.setAttribute("aria-expanded", "true");
    this.position();
    this.activate(Math.max(0, this.options.findIndex((option) => option.value === this.value)));
  }
  close() {
    this.menu.hidden = true;
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.removeAttribute("aria-activedescendant");
    this.#search = "";
  }
  position() {
    if (this.menu.hidden) return;
    const rect = this.trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    if (rect.bottom <= 0 || rect.top >= viewportHeight || !this.trigger.getClientRects().length) {
      this.close();
      return;
    }
    const margin = 8;
    const width = Math.min(Math.max(rect.width, 200), viewportWidth - margin * 2);
    const below = viewportHeight - rect.bottom - margin * 2;
    const above = rect.top - margin * 2;
    const desired = Math.min(this.menu.scrollHeight, 280);
    const upward = below < desired && above > below;
    const height = Math.min(desired, Math.max(44, upward ? above : below));
    Object.assign(this.menu.style, {
      width: `${width}px`,
      maxHeight: `${height}px`,
      left: `${Math.max(margin, Math.min(rect.left, viewportWidth - width - margin))}px`,
      top: `${Math.max(margin, upward ? rect.top - height - margin : rect.bottom + margin)}px`,
    });
  }
  activate(index) {
    this.#active = index;
    this.items.forEach((item, i) => item.classList.toggle("is-active", i === index));
    this.trigger.setAttribute("aria-activedescendant", this.items[index].id);
    const item = this.items[index];
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < this.menu.scrollTop) this.menu.scrollTop = top;
    else if (bottom > this.menu.scrollTop + this.menu.clientHeight)
      this.menu.scrollTop = bottom - this.menu.clientHeight;
  }
  choose(index) {
    const next = this.options[index].value;
    const changed = next !== this.value;
    this.value = next;
    this.sync();
    this.close();
    this.trigger.focus({ preventScroll: true });
    if (changed) this.onChange?.(next);
  }
  keydown(event) {
    if (event.key === "Tab") { this.close(); return; }
    if (event.key === "Escape") {
      if (!this.menu.hidden) { event.preventDefault(); this.close(); }
      return;
    }
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (this.menu.hidden) this.open(); else this.choose(this.#active);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const wasClosed = this.menu.hidden;
      if (wasClosed) this.open();
      if (event.key === "Home") this.activate(0);
      else if (event.key === "End") this.activate(this.items.length - 1);
      else if (!wasClosed) this.activate(
        (this.#active + (event.key === "ArrowDown" ? 1 : -1) + this.items.length) % this.items.length);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (this.menu.hidden) this.open();
      this.#search = Date.now() - this.#searchAt > 700 ? event.key : this.#search + event.key;
      this.#searchAt = Date.now();
      const index = this.options.findIndex((option) => option.label.toLocaleLowerCase().startsWith(this.#search.toLocaleLowerCase()));
      if (index >= 0) this.activate(index);
    }
  }
  destroy() {
    this.close();
    this.#controller.abort();
    this.menu.remove();
    this.root.remove();
  }
}

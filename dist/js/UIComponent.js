import SelectControl from "./SelectControl.js";
import { el, button, icon } from "./dom.js";
export default class UIComponent {
  #listeners = [];
  #animations = new Map();
  constructor({
    id = crypto.randomUUID(),
    title,
    type,
    minimized = false,
    customTitle = "",
    tone = "default",
    width = "auto",
    density = "comfortable",
    onDuplicate,
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
    this.defaultTitle = title;
    this.customTitle =
      typeof customTitle === "string" ? customTitle.trim().slice(0, 60) : "";
    this.title = this.customTitle || title;
    this.tone = ["sage", "sand", "lavender", "peach", "sky"].includes(tone)
      ? tone
      : "default";
    this.width = ["narrow", "wide"].includes(width) ? width : "auto";
    this.density = density === "compact" ? "compact" : "comfortable";
    this.onDuplicate = onDuplicate;
    this.settingsControls = [];
    this.destroyed = false;
    this.root = null;
  }
  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.#listeners.push(() =>
      target.removeEventListener(event, handler, options),
    );
  }
  animate(node, keyframes, options = {}) {
    if (
      this.destroyed ||
      !node?.animate ||
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    this.stopAnimation(node);
    const animation = node.animate(keyframes, {
      duration: 280,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      ...options,
    });
    this.#animations.set(node, animation);
    const cleanup = () => {
      if (this.#animations.get(node) === animation)
        this.#animations.delete(node);
    };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }
  stopAnimation(node) {
    this.#animations.get(node)?.cancel();
    this.#animations.delete(node);
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
          notes: "notes",
          focus: "focus",
          habits: "habits",
          clock: "clock",
          calculator: "calculator",
        }[this.type],
      ),
    );
    const heading = el("h2", "", this.title);
    this.heading = heading;
    heading.id = `${this.id}-title`;
    titleGroup.append(heading);
    const actions = el("div", "widget-actions");
    this.upButton = button(`Переместить «${this.title}» раньше`, "up");
    this.downButton = button(`Переместить «${this.title}» позже`, "down");
    this.toggleButton = button(`Свернуть «${this.title}»`, null);
    this.toggleButton.textContent = "−";
    this.toggleButton.setAttribute("aria-controls", `${this.id}-body`);
    const settingsButton = (this.settingsButton = button(
      `Настроить «${this.title}»`,
      "settings",
    ));
    const closeButton = (this.closeButton = button(
      `Удалить виджет «${this.title}»`,
      "close",
    ));
    this.listen(this.upButton, "click", () => this.onMove?.(this.id, -1));
    this.listen(this.downButton, "click", () => this.onMove?.(this.id, 1));
    this.listen(this.toggleButton, "click", () => this.minimize());
    this.listen(closeButton, "click", () => this.onClose?.(this.id));
    actions.append(
      this.upButton,
      this.downButton,
      this.toggleButton,
      settingsButton,
      closeButton,
    );
    header.append(titleGroup, actions);
    this.body = el("div", "widget-body");
    this.body.id = `${this.id}-body`;
    root.append(header, this.body);
    this.root = root;
    this.syncMinimize();
    this.syncAppearance();
    this.listen(settingsButton, "click", () => this.toggleSettings());
    settingsButton.setAttribute("aria-expanded", "false");
    settingsButton.setAttribute("aria-controls", `${this.id}-settings`);
    return root;
  }
  syncAppearance() {
    this.root.dataset.tone = this.tone;
    this.root.dataset.width = this.width;
    this.root.dataset.density = this.density;
  }
  toggleSettings() {
    if (!this.settingsPanel) this.renderSettings();
    this.settingsPanel.hidden = !this.settingsPanel.hidden;
    this.settingsButton.setAttribute(
      "aria-expanded",
      String(!this.settingsPanel.hidden),
    );
    if (this.settingsPanel.hidden)
      this.settingsControls.forEach((c) => c.close());
  }
  renderSettings() {
    const panel = (this.settingsPanel = el("form", "widget-settings"));
    panel.id = `${this.id}-settings`;
    panel.hidden = true;
    panel.setAttribute("aria-label", "Оформление виджета");
    const nameLabel = el("label", "field-label", "Название");
    nameLabel.htmlFor = `${this.id}-name`;
    this.nameInput = el("input");
    Object.assign(this.nameInput, {
      id: nameLabel.htmlFor,
      maxLength: 60,
      value: this.title,
    });
    panel.append(nameLabel, this.nameInput);
    for (const [key, label, choices] of [
      [
        "width",
        "Ширина",
        {
          auto: "По типу виджета",
          narrow: "Одна колонка",
          wide: "Две колонки",
        },
      ],
      [
        "tone",
        "Цвет",
        {
          default: "По типу виджета",
          sage: "Шалфей",
          sand: "Песок",
          lavender: "Лаванда",
          peach: "Персик",
          sky: "Небо",
        },
      ],
      [
        "density",
        "Плотность",
        { comfortable: "Свободная", compact: "Компактная" },
      ],
    ]) {
      const field = el("div", "settings-field");
      const control = new SelectControl({
        id: `${this.id}-${key}`,
        label,
        value: this[key],
        options: Object.entries(choices).map(([value, label]) => ({
          value,
          label,
        })),
        onChange: (value) => {
          this[key] = value;
          this.syncAppearance();
          this.changed();
        },
      });
      this.settingsControls.push(control);
      field.append(el("span", "field-label", label), control.root);
      panel.append(field);
    }
    const actions = el("div", "widget-toolbar");
    const save = button("Сохранить название", null, "button button-primary");
    save.type = "submit";
    const duplicate = button("Создать копию", null, "button button-secondary");
    this.listen(duplicate, "click", () => this.onDuplicate?.(this.id));
    actions.append(save, duplicate);
    panel.append(actions);
    this.listen(panel, "submit", (event) => {
      event.preventDefault();
      this.customTitle = this.nameInput.value.trim();
      this.title = this.customTitle || this.defaultTitle;
      this.nameInput.value = this.title;
      this.heading.textContent = this.title;
      for (const [b, verb] of [
        [this.upButton, "Переместить"],
        [this.downButton, "Переместить"],
        [this.closeButton, "Удалить виджет"],
        [this.settingsButton, "Настроить"],
      ]) {
        const direction =
          b === this.upButton
            ? " раньше"
            : b === this.downButton
              ? " позже"
              : "";
        b.title = `${verb} «${this.title}»${direction}`;
        b.setAttribute("aria-label", b.title);
      }
      this.syncMinimize();
      this.changed();
      this.toggleSettings();
      this.settingsButton.focus();
      this.announce("Название сохранено.");
    });
    this.root.insertBefore(panel, this.body);
  }
  syncMinimize() {
    this.body.hidden = this.minimized;
    this.root.classList.toggle("is-minimized", this.minimized);
    this.toggleButton.textContent = this.minimized ? "+" : "−";
    this.toggleButton.setAttribute("aria-expanded", String(!this.minimized));
    const label = `${this.minimized ? "Развернуть" : "Свернуть"} «${this.title}»`;
    this.toggleButton.setAttribute("aria-label", label);
    this.toggleButton.title = label;
  }
  minimize() {
    this.minimized = !this.minimized;
    this.syncMinimize();
    if (!this.minimized)
      this.animate(this.body, [
        { opacity: 0.5, transform: "translateY(-8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ]);
    this.changed();
  }
  changed() {
    if (!this.destroyed) this.onChange?.();
  }
  serialize() {
    return {
      id: this.id,
      type: this.type,
      minimized: this.minimized,
      customTitle: this.customTitle,
      tone: this.tone,
      width: this.width,
      density: this.density,
    };
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.#animations.forEach((animation) => animation.cancel());
    this.#animations.clear();
    this.#listeners.splice(0).forEach((remove) => remove());
    this.settingsControls.forEach((c) => c.destroy());
    this.root?.remove();
  }
}

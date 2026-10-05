import UIComponent from "./UIComponent.js";
import { el, button } from "./dom.js";
export default class NotesWidget extends UIComponent {
  constructor(config = {}) {
    super({ ...config, title: "Заметки", type: "notes" });
    this.text =
      typeof config.text === "string" ? config.text.slice(0, 3000) : "";
    this.preview = config.preview === true;
  }
  render() {
    if (this.root) return this.root;
    const root = super.render();
    const label = el("label", "field-label", "Оставьте мысль, ссылку или план");
    this.editor = el("textarea", "notes-editor");
    Object.assign(this.editor, {
      id: `${this.id}-text`,
      maxLength: 3000,
      rows: 7,
      value: this.text,
      placeholder: "Что хочется сохранить?",
    });
    label.htmlFor = this.editor.id;
    this.reading = el("div", "notes-reading");
    this.count = el("span", "muted");
    this.modeButton = button("Режим чтения", null, "button button-secondary");
    const copy = button("Копировать", null, "button button-secondary");
    const clear = button("Очистить", null, "button button-secondary");
    this.undoButton = button("Вернуть текст", null, "button button-secondary");
    this.undoButton.hidden = true;
    this.listen(this.editor, "input", () => {
      this.text = this.editor.value;
      this.undoButton.hidden = true;
      this.paint();
      this.changed();
    });
    this.listen(this.modeButton, "click", () => {
      this.preview = !this.preview;
      this.paint();
      this.changed();
    });
    this.listen(copy, "click", async () => {
      try {
        await navigator.clipboard.writeText(this.text);
        if (!this.destroyed) this.announce("Заметка скопирована.");
      } catch {
        if (!this.destroyed) {
          this.preview = false;
          this.paint();
          this.editor.focus();
          this.editor.select();
          this.announce("Текст выделен. Скопируйте его вручную.");
        }
      }
    });
    this.listen(clear, "click", () => {
      if (!this.text) return;
      this.previousText = this.text;
      this.text = "";
      this.editor.value = "";
      this.undoButton.hidden = false;
      this.paint();
      this.changed();
    });
    this.listen(this.undoButton, "click", () => {
      this.text = this.previousText;
      this.editor.value = this.text;
      this.undoButton.hidden = true;
      this.paint();
      this.changed();
    });
    const toolbar = el("div", "widget-toolbar");
    toolbar.append(this.modeButton, copy, clear, this.undoButton);
    this.body.append(label, this.editor, this.reading, this.count, toolbar);
    this.paint();
    return root;
  }
  paint() {
    this.editor.hidden = this.preview;
    this.reading.hidden = !this.preview;
    this.reading.textContent =
      this.text ||
      "Пока чистый лист. Перейдите к редактированию, чтобы добавить заметку.";
    this.modeButton.textContent = this.preview
      ? "Редактировать"
      : "Режим чтения";
    this.modeButton.setAttribute("aria-label", this.modeButton.textContent);
    this.modeButton.title = this.modeButton.textContent;
    this.modeButton.setAttribute("aria-pressed", String(this.preview));
    this.count.textContent = `${this.text.length} / 3 000 символов`;
  }
  serialize() {
    return { ...super.serialize(), text: this.text, preview: this.preview };
  }
}

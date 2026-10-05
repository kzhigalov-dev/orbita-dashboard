// Small grid tracks let CSS fill holes while keeping cards at their natural height.
export const ROW_HEIGHT = 4;

export default class WidgetLayout {
  constructor(container) {
    this.container = container;
    this.cards = new Set();
    this.frame = null;
    this.destroyed = false;
    this.containerWidth = null;
    if (typeof ResizeObserver !== "function") return;
    this.observer = new ResizeObserver((entries) => {
      const changed = entries.some((entry) => {
        if (entry.target !== this.container)
          return this.cards.has(entry.target);
        // Row spans change the grid's height. Only its width requires another pass.
        const width = entry.contentRect.width;
        if (width === this.containerWidth) return false;
        this.containerWidth = width;
        return true;
      });
      if (changed) this.schedule();
    });
    this.observer.observe(container);
  }

  add(card) {
    if (this.destroyed || !this.observer) return;
    this.cards.add(card);
    this.observer.observe(card);
    // Measure before paint, so a new card never temporarily overlaps its neighbours.
    this.refresh();
  }

  remove(card) {
    this.cards.delete(card);
    this.observer?.unobserve(card);
    card.style?.removeProperty("grid-row-end");
  }

  schedule() {
    if (this.destroyed || !this.observer || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.refresh();
    });
  }

  refresh() {
    if (this.destroyed || !this.observer) return;
    const gap =
      Number.parseFloat(
        getComputedStyle(this.container).getPropertyValue("--widget-gap"),
      ) || 0;
    // Computed height excludes animated transforms and includes border/padding
    // under the app's border-box sizing. Read all sizes before writing any spans.
    const spans = [...this.cards].map((card) => [
      card,
      Math.max(
        1,
        Math.ceil(
          (Number.parseFloat(getComputedStyle(card).height) + gap) / ROW_HEIGHT,
        ),
      ),
    ]);
    for (const [card, span] of spans) {
      const value = `span ${span}`;
      if (card.style.gridRowEnd !== value) card.style.gridRowEnd = value;
    }
    this.container.classList.add("is-packed");
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const card of this.cards) card.style.removeProperty("grid-row-end");
    this.cards.clear();
    this.container.classList.remove("is-packed");
  }
}

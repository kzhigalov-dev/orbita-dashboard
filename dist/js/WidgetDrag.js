import { el } from "./dom.js";

// Hit testing uses resting grid positions, not the temporary FLIP transforms.
export function insertionTarget(point, cards) {
  let nearest = null;
  let distance = Infinity;
  for (const card of cards) {
    const r = card.rect;
    const dx = Math.max(r.left - point.x, 0, point.x - r.right);
    const dy = Math.max(r.top - point.y, 0, point.y - r.bottom);
    const next = dx * dx + dy * dy;
    if (next < distance) {
      nearest = card;
      distance = next;
    }
  }
  if (!nearest) return null;
  return {
    node: nearest.node,
    before: point.y < (nearest.rect.top + nearest.rect.bottom) / 2,
  };
}

export function edgeScroll(y, height) {
  const edge = 72;
  if (y < edge) return -Math.ceil(14 * Math.min(1, Math.max(0, 1 - y / edge)));
  if (y > height - edge)
    return Math.ceil(14 * Math.min(1, Math.max(0, 1 - (height - y) / edge)));
  return 0;
}

export default class WidgetDrag {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.container = dashboard.container;
    this.state = null;
    this.frame = null;
    this.listeners = new AbortController();
    if (!this.container.addEventListener || typeof window === "undefined")
      return;
    const options = { signal: this.listeners.signal };
    this.container.addEventListener(
      "pointerdown",
      (e) => this.down(e),
      options,
    );
    this.container.addEventListener(
      "pointermove",
      (e) => this.move(e),
      options,
    );
    this.container.addEventListener(
      "pointerup",
      (e) => {
        if (e.pointerId === this.state?.pointerId) {
          this.state.point = { x: e.clientX, y: e.clientY };
          this.finish();
        }
      },
      options,
    );
    for (const name of ["pointercancel", "lostpointercapture"])
      this.container.addEventListener(
        name,
        (e) => {
          if (e.pointerId === this.state?.pointerId) this.cancel();
        },
        options,
      );
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && this.state) {
          e.preventDefault();
          this.cancel();
        }
      },
      options,
    );
    window.addEventListener("blur", () => this.cancel(), options);
    window.addEventListener("resize", () => this.cancel(), options);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.cancel();
      },
      options,
    );
    // A release after dragging must not accidentally activate a button.
    this.container.addEventListener(
      "click",
      (e) => {
        if (this.suppressClick && e.detail > 0) {
          const header = e.target.closest?.(".widget-title");
          if (
            e.target === this.container ||
            header?.closest(".widget") === this.suppressClick
          ) {
            e.preventDefault();
            e.stopPropagation();
          }
          this.suppressClick = false;
        }
      },
      { ...options, capture: true },
    );
  }

  down(event) {
    if (this.state || event.button !== 0 || event.isPrimary === false) return;
    const handle = event.target.closest?.(".widget-title");
    if (!handle || !this.container.contains(handle)) return;
    const root = handle.closest(".widget");
    const widget = this.dashboard.widgets.find((w) => w.root === root);
    if (!widget) return;
    this.suppressClick = false;
    this.state = {
      widget,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      point: { x: event.clientX, y: event.clientY },
      active: false,
    };
    this.container.setPointerCapture(event.pointerId);
  }

  move(event) {
    const s = this.state;
    if (!s || event.pointerId !== s.pointerId) return;
    s.point = { x: event.clientX, y: event.clientY };
    if (
      !s.active &&
      Math.hypot(s.point.x - s.start.x, s.point.y - s.start.y) >= 8
    )
      this.begin();
    if (s.active) event.preventDefault();
  }

  begin() {
    const s = this.state;
    const root = s.widget.root;
    this.dashboard.widgets.forEach((w) => w.stopAnimation(w.root));
    s.rect = root.getBoundingClientRect();
    s.originalStyle = root.getAttribute("style");
    s.active = true;
    s.lastX = s.point.x;
    s.placeholder = el("div", "widget-drop-slot");
    s.placeholder.setAttribute("aria-hidden", "true");
    s.placeholder.append(el("span", "", "Отпустите здесь"));
    Object.assign(s.placeholder.style, {
      height: `${s.rect.height}px`,
      gridColumn: getComputedStyle(root).gridColumn,
    });
    root.before(s.placeholder);
    this.dashboard.layout.remove(root);
    Object.assign(root.style, {
      left: `${s.rect.left}px`,
      top: `${s.rect.top}px`,
      width: `${s.rect.width}px`,
      height: `${s.rect.height}px`,
    });
    root.classList.add("is-dragging");
    document.body.classList.add("is-widget-dragging");
    this.dashboard.layout.add(s.placeholder);
    this.dashboard.announce(
      `Перетаскивание «${s.widget.title}». Отпустите в нужном месте. Escape — отмена.`,
    );
    this.tick();
  }

  tick() {
    const s = this.state;
    if (!s?.active) return;
    const speed = edgeScroll(s.point.y, window.innerHeight);
    if (speed) window.scrollBy({ top: speed, behavior: "instant" });
    const dx = s.point.x - s.start.x,
      dy = s.point.y - s.start.y;
    const tilt = Math.max(-2, Math.min(2, (s.point.x - s.lastX) / 5));
    s.widget.root.style.setProperty("--drag-x", `${dx}px`);
    s.widget.root.style.setProperty("--drag-y", `${dy}px`);
    s.widget.root.style.setProperty("--drag-tilt", `${tilt}deg`);
    s.lastX = s.point.x;
    if (
      !s.hitPoint ||
      Math.hypot(s.point.x - s.hitPoint.x, s.point.y - s.hitPoint.y) >= 6 ||
      s.hitScroll !== window.scrollY
    ) {
      this.place();
      s.hitPoint = { ...s.point };
      s.hitScroll = window.scrollY;
    }
    this.frame = requestAnimationFrame(() => this.tick());
  }

  inside() {
    const r = this.container.getBoundingClientRect();
    const p = this.state.point;
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }

  restingRect(node) {
    const r = node.getBoundingClientRect();
    const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
    return {
      left: r.left - matrix.m41,
      right: r.right - matrix.m41,
      top: r.top - matrix.m42,
      bottom: r.bottom - matrix.m42,
    };
  }

  place() {
    const s = this.state;
    if (!this.inside()) {
      s.placeholder.classList.add("is-drop-outside");
      return;
    }
    s.placeholder.classList.remove("is-drop-outside");
    const slot = s.placeholder.getBoundingClientRect();
    if (
      s.point.x >= slot.left &&
      s.point.x <= slot.right &&
      s.point.y >= slot.top &&
      s.point.y <= slot.bottom
    )
      return;
    const cards = [...this.container.children]
      .filter((n) => n !== s.widget.root && n !== s.placeholder)
      .map((node) => ({ node, rect: this.restingRect(node) }));
    const target = insertionTarget(s.point, cards);
    if (!target) return;
    // Ignore the floating source when comparing adjacent grid items.
    const order = [...this.container.children].filter(
      (n) => n !== s.widget.root,
    );
    const from = order.indexOf(s.placeholder);
    const to = order.indexOf(target.node) + (target.before ? 0 : 1);
    if (from === to || from + 1 === to) return;
    const positions = this.dashboard.positions(s.widget);
    if (target.before) target.node.before(s.placeholder);
    else target.node.after(s.placeholder);
    this.dashboard.animatePositions(positions, s.widget);
  }

  finish(cancelled = false) {
    const s = this.state;
    if (!s) return;
    // A quick release can arrive before the next animation frame.
    if (s.active && !cancelled) this.place();
    this.state = null;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.container.hasPointerCapture(s.pointerId))
      this.container.releasePointerCapture(s.pointerId);
    if (!s.active) return;
    this.suppressClick = s.widget.root;
    const root = s.widget.root;
    const floating = root.getBoundingClientRect();
    const positions = this.dashboard.positions(s.widget);
    const valid =
      !cancelled &&
      s.point.x >= this.container.getBoundingClientRect().left &&
      s.point.x <= this.container.getBoundingClientRect().right &&
      s.point.y >= this.container.getBoundingClientRect().top &&
      s.point.y <= this.container.getBoundingClientRect().bottom;
    if (valid) s.placeholder.before(root);
    else this.dashboard.widgets.forEach((w) => this.container.append(w.root));
    this.dashboard.layout.remove(s.placeholder);
    s.placeholder.remove();
    root.classList.remove("is-dragging");
    document.body.classList.remove("is-widget-dragging");
    if (s.originalStyle === null) root.removeAttribute("style");
    else root.setAttribute("style", s.originalStyle);
    this.dashboard.layout.add(root);
    if (valid)
      this.dashboard.widgets.sort(
        (a, b) =>
          [...this.container.children].indexOf(a.root) -
          [...this.container.children].indexOf(b.root),
      );
    this.dashboard.update();
    if (valid) this.dashboard.save();
    this.dashboard.animatePositions(positions, s.widget);
    const after = root.getBoundingClientRect();
    s.widget.animate(
      root,
      [
        {
          transform: `translate(${floating.left - after.left}px, ${floating.top - after.top}px) scale(1.025)`,
          boxShadow: "0 24px 56px #26352b33",
        },
        { transform: "translate(0, 0) scale(1)", boxShadow: "0 0 0 #26352b00" },
      ],
      { duration: 360 },
    );
    s.widget.dragButton.focus({ preventScroll: true });
    this.dashboard.announce(
      valid
        ? `«${s.widget.title}»: позиция ${this.dashboard.widgets.indexOf(s.widget) + 1} из ${this.dashboard.widgets.length}. Порядок сохранён.`
        : "Перетаскивание отменено.",
    );
  }

  cancel() {
    this.finish(true);
  }

  destroy() {
    this.cancel();
    this.listeners.abort();
  }
}

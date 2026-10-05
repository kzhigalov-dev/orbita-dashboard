// Small state models keep timing and calculation independent of rendering.
export class Countdown {
  constructor({ duration = 1500, remaining, deadline } = {}, now = Date.now()) {
    this.duration =
      Number.isInteger(duration) && duration >= 60 && duration <= 7200
        ? duration
        : 1500;
    this.remaining = Number.isFinite(remaining)
      ? Math.max(0, Math.min(this.duration, remaining))
      : this.duration;
    this.deadline =
      Number.isFinite(deadline) && deadline <= now + this.duration * 1000
        ? deadline
        : null;
  }
  tick(now = Date.now()) {
    if (this.deadline === null) return false;
    this.remaining = Math.max(0, Math.ceil((this.deadline - now) / 1000));
    if (this.remaining > 0) return false;
    this.deadline = null;
    return true;
  }
  start(now = Date.now()) {
    if (this.deadline !== null) return;
    if (!this.remaining) this.remaining = this.duration;
    this.deadline = now + this.remaining * 1000;
  }
  pause(now = Date.now()) {
    this.tick(now);
    this.deadline = null;
  }
  reset(duration = this.duration) {
    this.duration = duration;
    this.remaining = duration;
    this.deadline = null;
  }
  serialize() {
    return {
      duration: this.duration,
      remaining: this.remaining,
      deadline: this.deadline,
    };
  }
}
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function weekDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6 + i,
      12,
    );
    return {
      key: localDay(day),
      label: new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(day),
      date: new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
      }).format(day),
    };
  });
}
export function calculate(expression) {
  if (
    typeof expression !== "string" ||
    expression.length > 120 ||
    !expression.trim()
  )
    throw new Error("Введите пример");
  const normalized = expression
    .replaceAll(",", ".")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-");
  const tokens = normalized.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+\-*/()%]/g) ?? [];
  if (tokens.join("") !== normalized.replace(/\s/g, ""))
    throw new Error("Используйте числа и знаки действий");
  let index = 0;
  const factor = () => {
    let value;
    if (["+", "-"].includes(tokens[index])) {
      const sign = tokens[index++] === "-" ? -1 : 1;
      value = sign * factor();
    } else if (tokens[index] === "(") {
      index++;
      value = sum();
      if (tokens[index++] !== ")") throw new Error("Закройте скобки");
    } else {
      const token = tokens[index++];
      if (!token || !/^\d|^\./.test(token)) throw new Error("Допишите пример");
      value = Number(token);
    }
    while (tokens[index] === "%") {
      index++;
      value /= 100;
    }
    return value;
  };
  const term = () => {
    let value = factor();
    while (["*", "/"].includes(tokens[index])) {
      const op = tokens[index++];
      const next = factor();
      if (op === "/" && next === 0) throw new Error("На ноль делить нельзя");
      value = op === "*" ? value * next : value / next;
    }
    return value;
  };
  const sum = () => {
    let value = term();
    while (["+", "-"].includes(tokens[index])) {
      const op = tokens[index++];
      const next = term();
      value = op === "+" ? value + next : value - next;
    }
    return value;
  };
  const result = sum();
  if (index !== tokens.length || !Number.isFinite(result))
    throw new Error("Проверьте пример");
  return Number(result.toPrecision(12));
}

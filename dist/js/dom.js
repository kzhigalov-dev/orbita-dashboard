export function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
const paths = {
  settings: "M4 7h16M4 17h16M9 4v6M15 14v6",
  edit: "m14 4 6 6M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15l-1 5Z",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z",
  notes: "M6 3h9l4 4v14H6V3ZM14 3v5h5M9 12h7M9 16h5",
  focus:
    "M9 2h6M12 2v3M18 5l2 2M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM12 9v4l3 2",
  habits: "M4 5h16v16H4V5ZM8 3v4M16 3v4M4 10h16M8 15l3 3 5-5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 2",
  calculator: "M6 3h12v18H6V3ZM9 7h6M9 12h1M14 12h1M9 16h1M14 16h1",
  tasks: "M9 6h11M9 12h11M9 18h11M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2",
  weather:
    "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  currency: "M12 3v18M16 6H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7",
  cloud: "M6 18a4 4 0 0 1-.4-8A6 6 0 0 1 17 8a5 5 0 1 1 1 10H6Z",
  rain: "M6 15a3 3 0 0 1-.4-6A5 5 0 0 1 15 7a4 4 0 0 1 3 8M8 18l-1 3M13 18l-1 3M18 18l-1 3",
  snow: "M6 13a3 3 0 0 1-.4-6A5 5 0 0 1 15 5a4 4 0 0 1 3 8M12 16v6M9.4 17.5l5.2 3M9.4 20.5l5.2-3",
  thunder:
    "M6 15a3 3 0 0 1-.4-6A5 5 0 0 1 15 7a4 4 0 0 1 3 8M13 13l-3 5h4l-3 5",
  quote: "M5 6h5v7H5v-7Zm9 0h5v7h-5v-7ZM10 13c0 4-2 5-4 5M19 13c0 4-2 5-4 5",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  up: "m6 14 6-6 6 6",
  down: "m6 10 6 6 6-6",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M18 17a7 7 0 0 1-12 1l-2-6",
  check: "m5 12 4 4L19 6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7",
};
export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }))
    svg.setAttribute(key, value);
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[name] ?? paths.plus);
  svg.append(path);
  return svg;
}
export function button(label, iconName, className = "icon-button") {
  const node = el("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.title = label;
  if (iconName) node.append(icon(iconName));
  else node.textContent = label;
  return node;
}
export function sourceLink(url, text) {
  const a = el("a", "source-link", text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
export const format = (value, digits = 0) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

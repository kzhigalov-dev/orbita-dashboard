import APIWidget from "./APIWidget.js";
import { el, button, sourceLink, format, icon } from "./dom.js";
import { cities, parseWeather, weatherDescription } from "./data.js";
import SelectControl from "./SelectControl.js";
export default class WeatherWidget extends APIWidget {
  constructor(config = {}) {
    super({ ...config, title: "Погода", type: "weather" });
    this.unit = config.unit === "F" ? "F" : "C";
    this.hours = [6, 12, 24].includes(config.hours) ? config.hours : 12;
    this.city = Object.hasOwn(cities, config.city) ? config.city : "spb";
  }
  render() {
    if (this.root) return this.root;
    const root = super.render();
    const label = el("label", "sr-only", "Город");
    label.htmlFor = `${this.id}-city`;
    this.select = new SelectControl({
      id: label.htmlFor,
      label: "Город",
      className: "city-select",
      options: Object.entries(cities).map(([value, city]) => ({
        value,
        label: city.name,
      })),
      value: this.city,
      onChange: (value) => {
        this.city = value;
        this.changed();
        this.load();
      },
    });
    const options = el("div", "widget-toolbar weather-options");
    this.unitButton = button(
      "Температура в °F",
      null,
      "button button-secondary",
    );
    this.listen(this.unitButton, "click", () => {
      this.unit = this.unit === "C" ? "F" : "C";
      this.syncOptions();
      if (this.data) this.renderData(this.data);
      this.changed();
    });
    this.rangeButtons = [6, 12, 24].map((hours) => {
      const b = button(`${hours} ч`, null, "button button-secondary");
      this.listen(b, "click", () => {
        this.hours = hours;
        this.syncOptions();
        if (this.data) this.renderData(this.data);
        this.changed();
      });
      options.append(b);
      return b;
    });
    options.append(this.unitButton);
    this.syncOptions();
    const footer = el("footer", "api-footer");
    footer.append(
      sourceLink("https://open-meteo.com/", "Open-Meteo · CC BY 4.0"),
      this.refreshButton,
    );
    this.body.append(
      label,
      this.select.root,
      options,
      this.statusNode,
      this.resultNode,
      footer,
    );
    return root;
  }
  syncOptions() {
    this.rangeButtons.forEach((b, i) =>
      b.setAttribute("aria-pressed", String([6, 12, 24][i] === this.hours)),
    );
    this.unitButton.textContent = `°${this.unit}`;
    this.unitButton.setAttribute(
      "aria-label",
      this.unit === "C" ? "Температура в °F" : "Температура в °C",
    );
    this.unitButton.title = this.unitButton.getAttribute("aria-label");
  }
  load() {
    const city = cities[this.city];
    const params = new URLSearchParams({
      latitude: city.latitude,
      longitude: city.longitude,
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      hourly: "temperature_2m",
      forecast_days: "2",
      timezone: "auto",
    });
    return this.runRequest(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      parseWeather,
    );
  }
  renderData(data) {
    this.resultNode.replaceChildren();
    const temperature = (value) =>
      this.unit === "F" ? (value * 9) / 5 + 32 : value;
    const forecast = data.hours.slice(0, this.hours);
    const hero = el("div", "weather-hero");
    const value = el(
      "div",
      "temperature",
      `${format(temperature(data.temperature))}°`,
    );
    value.append(el("span", "temperature-unit", this.unit));
    const conditionIcon =
      data.code <= 1
        ? "weather"
        : data.code >= 95
          ? "thunder"
          : data.code >= 71 && data.code <= 77
            ? "snow"
            : data.code >= 51 && data.code <= 86
              ? "rain"
              : "cloud";
    hero.append(value, icon(conditionIcon));
    const detail = el(
      "p",
      "weather-description",
      weatherDescription(data.code),
    );
    const feels = el(
      "p",
      "muted",
      `Ощущается как ${format(temperature(data.feels))}°`,
    );
    const metrics = el("dl", "weather-metrics");
    for (const [label, value] of [
      ["Ветер", `${format(data.wind, 1)} км/ч`],
      ["Влажность", `${format(data.humidity)}%`],
    ]) {
      const group = el("div");
      group.append(el("dt", "muted", label), el("dd", "", value));
      metrics.append(group);
    }
    this.resultNode.append(hero, detail, feels, metrics);
    if (forecast.length > 1) {
      const values = forecast.map((h) => temperature(h.value));
      const low = Math.min(...values);
      const range = Math.max(...values) - low || 1;
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 320 70");
      svg.setAttribute("class", "weather-chart");
      svg.setAttribute("role", "img");
      svg.setAttribute(
        "aria-label",
        `Прогноз на ${forecast.length} ч: от ${format(low)} до ${format(Math.max(...values))} градусов ${this.unit}.`,
      );
      const poly = document.createElementNS(ns, "polyline");
      poly.setAttribute(
        "points",
        values
          .map(
            (n, i) =>
              `${(i * 316) / (values.length - 1) + 2},${60 - ((n - low) / range) * 46}`,
          )
          .join(" "),
      );
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke", "currentColor");
      poly.setAttribute("stroke-width", "3");
      poly.setAttribute("pathLength", "1");
      svg.append(poly);
      const hours = el("div", "chart-labels");
      hours.append(
        el("span", "", forecast[0].time.slice(11, 16)),
        el("span", "", `Ближайшие ${forecast.length} ч`),
        el("span", "", forecast.at(-1).time.slice(11, 16)),
      );
      this.resultNode.append(svg, hours);
    }
    this.resultNode.append(
      el(
        "p",
        "data-time",
        `Данные модели: ${data.time.slice(11, 16)} · местное время`,
      ),
    );
  }
  serialize() {
    return {
      ...super.serialize(),
      city: this.city,
      unit: this.unit,
      hours: this.hours,
    };
  }
  destroy() {
    this.select?.destroy();
    super.destroy();
  }
}

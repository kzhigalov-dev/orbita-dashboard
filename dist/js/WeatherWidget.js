import APIWidget from "./APIWidget.js";
import { el, sourceLink, format, icon } from "./dom.js";
import { cities, parseWeather, weatherDescription } from "./data.js";
import SelectControl from "./SelectControl.js";
export default class WeatherWidget extends APIWidget {
  constructor(config = {}) {
    super({ ...config, title: "Погода", type: "weather" });
    this.city = Object.hasOwn(cities, config.city) ? config.city : "spb";
  }
  render() {
    const root = super.render();
    const label = el("label", "sr-only", "Город");
    label.htmlFor = `${this.id}-city`;
    this.select = new SelectControl({
      id: label.htmlFor,
      label: "Город",
      className: "city-select",
      options: Object.entries(cities).map(([value, city]) => ({ value, label: city.name })),
      value: this.city,
      onChange: (value) => {
        this.city = value;
        this.changed();
        this.load();
      },
    });
    const footer = el("footer", "api-footer");
    footer.append(
      sourceLink("https://open-meteo.com/", "Open-Meteo · CC BY 4.0"),
      this.refreshButton,
    );
    this.body.append(
      label,
      this.select.root,
      this.statusNode,
      this.resultNode,
      footer,
    );
    return root;
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
    const hero = el("div", "weather-hero");
    const value = el("div", "temperature", `${format(data.temperature)}°`);
    value.append(el("span", "temperature-unit", "C"));
    hero.append(value, icon("weather"));
    const detail = el(
      "p",
      "weather-description",
      weatherDescription(data.code),
    );
    const feels = el("p", "muted", `Ощущается как ${format(data.feels)}°`);
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
    if (data.hours.length > 1) {
      const values = data.hours.map((h) => h.value);
      const low = Math.min(...values);
      const range = Math.max(...values) - low || 1;
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 320 70");
      svg.setAttribute("class", "weather-chart");
      svg.setAttribute("role", "img");
      svg.setAttribute(
        "aria-label",
        `Прогноз на 12 часов: от ${format(low)} до ${format(Math.max(...values))} градусов.`,
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
      svg.append(poly);
      const hours = el("div", "chart-labels");
      hours.append(
        el("span", "", data.hours[0].time.slice(11, 16)),
        el("span", "", "Ближайшие 12 часов"),
        el("span", "", data.hours.at(-1).time.slice(11, 16)),
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
    return { ...super.serialize(), city: this.city };
  }
  destroy() {
    this.select?.destroy();
    super.destroy();
  }
}

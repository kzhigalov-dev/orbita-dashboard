const number = (value) => typeof value === "number" && Number.isFinite(value);
export const currencies = {
  USD: "Доллар США",
  EUR: "Евро",
  CNY: "Китайский юань",
  GBP: "Фунт стерлингов",
};
export const cities = {
  spb: { name: "Санкт-Петербург", latitude: 59.94, longitude: 30.31 },
  moscow: { name: "Москва", latitude: 55.75, longitude: 37.62 },
  kazan: { name: "Казань", latitude: 55.79, longitude: 49.12 },
  sochi: { name: "Сочи", latitude: 43.6, longitude: 39.73 },
  kaliningrad: { name: "Калининград", latitude: 54.71, longitude: 20.51 },
};
export function parseWeather(raw) {
  if (!raw || typeof raw !== "object")
    throw new Error("Некорректный ответ сервиса погоды.");
  if (raw.current == null) return null;
  const c = raw.current;
  if (
    ![
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m",
    ].every((key) => number(c[key])) ||
    typeof c.time !== "string" ||
    !Number.isFinite(Date.parse(c.time))
  )
    throw new Error("Сервис погоды вернул неполные данные.");
  const hours = [];
  const h = raw.hourly;
  if (Array.isArray(h?.time) && Array.isArray(h?.temperature_2m)) {
    for (let i = 0; i < h.time.length; i++) {
      if (
        typeof h.time[i] === "string" &&
        h.time[i] >= c.time.slice(0, 13) &&
        number(h.temperature_2m[i])
      )
        hours.push({ time: h.time[i], value: h.temperature_2m[i] });
      if (hours.length === 24) break;
    }
  }
  return {
    temperature: c.temperature_2m,
    feels: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m,
    code: c.weather_code,
    time: c.time,
    hours,
  };
}
export function parseRates(raw) {
  if (!raw || typeof raw.Valute !== "object" || raw.Valute === null)
    throw new Error("Сервис валют вернул неполные данные.");
  if (Object.keys(raw.Valute).length === 0) return null;
  if (typeof raw.Date !== "string" || !Number.isFinite(Date.parse(raw.Date)))
    throw new Error("Не удалось определить дату курсов.");
  const rates = Object.keys(currencies).map((code) => {
    const item = raw.Valute[code];
    if (
      !item ||
      ![item.Value, item.Previous, item.Nominal].every(number) ||
      item.Value <= 0 ||
      item.Previous <= 0 ||
      item.Nominal <= 0
    )
      throw new Error("Сервис валют вернул неполные данные.");
    return {
      code,
      rate: item.Value / item.Nominal,
      change: (item.Value - item.Previous) / item.Nominal,
    };
  });
  return { date: raw.Date, rates };
}
export function weatherDescription(code) {
  if (code === 0) return "Ясно";
  if ([1, 2].includes(code)) return "Переменная облачность";
  if (code === 3) return "Облачно";
  if ([45, 48].includes(code)) return "Туман";
  if (code >= 51 && code <= 67) return "Дождь";
  if (code >= 71 && code <= 77) return "Снег";
  if (code >= 80 && code <= 86) return "Осадки";
  if (code >= 95) return "Гроза";
  return "Переменчивая погода";
}

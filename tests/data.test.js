import test from "node:test";
import assert from "node:assert/strict";
const moduleURL = new URL("../dist/js/data.js", import.meta.url);
test("data module exists and exposes explicit response validation", async () => {
  const available = await import(moduleURL).catch(() => null);
  assert.ok(available, "Response validation has not been implemented");
});
test("weather: malformed numbers are rejected, empty response is distinguishable", async () => {
  const { parseWeather } = await import(moduleURL);
  assert.equal(parseWeather({}), null);
  assert.throws(() =>
    parseWeather({
      current: {
        temperature_2m: "<img>",
        relative_humidity_2m: 60,
        apparent_temperature: 15,
        weather_code: 1,
        wind_speed_10m: 3,
        time: "2026-10-05T12:00",
      },
      hourly: { time: [], temperature_2m: [] },
    }),
  );
});
test("weather: valid result retains numeric values and bounded hourly data", async () => {
  const { parseWeather } = await import(moduleURL);
  const value = parseWeather({
    current: {
      temperature_2m: 12,
      relative_humidity_2m: 60,
      apparent_temperature: 10,
      weather_code: 3,
      wind_speed_10m: 9,
      time: "2026-10-05T12:00",
    },
    hourly: {
      time: ["2026-10-05T12:00", "2026-10-05T13:00"],
      temperature_2m: [12, 13],
    },
  });
  assert.equal(value.temperature, 12);
  assert.equal(value.hours.length, 2);
});
test("rates: normalizes nominal amounts, rejects malformed contracts, handles empty data", async () => {
  const { parseRates } = await import(moduleURL);
  assert.equal(parseRates({ Valute: {} }), null);
  const value = parseRates({
    Date: "2026-10-05T11:30:00+03:00",
    Valute: {
      USD: { Value: 90, Previous: 89, Nominal: 1 },
      EUR: { Value: 100, Previous: 99, Nominal: 1 },
      CNY: { Value: 125, Previous: 124, Nominal: 10 },
      GBP: { Value: 120, Previous: 119, Nominal: 1 },
    },
  });
  assert.equal(value.rates.find((x) => x.code === "CNY").rate, 12.5);
  assert.throws(() =>
    parseRates({ Date: "invalid", Valute: { USD: { Value: "bad" } } }),
  );
});

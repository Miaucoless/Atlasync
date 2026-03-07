/**
 * services/weather.js
 *
 * Client-side service for weather data via OpenWeatherMap.
 * Requires: OPENWEATHER_API_KEY in .env.local
 *
 * Normalized shape (current):
 *   {
 *     temp, feelsLike, high, low,
 *     description, icon,   // icon = weather emoji
 *     humidity, windSpeed, // kph
 *     cityName, country,
 *   }
 *
 * Normalized shape (forecast day):
 *   { date, high, low, description, icon, pop } // pop = probability of precipitation
 */

import { fetchWithCache } from '../utils/apiCache';

const WEATHER_ICONS = {
  '01': '☀️',  // clear sky
  '02': '🌤️', // few clouds
  '03': '⛅',  // scattered clouds
  '04': '☁️',  // broken clouds
  '09': '🌧️', // shower rain
  '10': '🌦️', // rain
  '11': '⛈️', // thunderstorm
  '13': '❄️',  // snow
  '50': '🌫️', // mist
};

function iconCode(owmIcon = '') {
  return WEATHER_ICONS[owmIcon.slice(0, 2)] ?? '🌡️';
}

/**
 * Get current weather for coordinates.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Object|null>}
 */
export async function getCurrentWeather(lat, lng) {
  if (!lat || !lng) return null;
  const key = `weather:current:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  return fetchWithCache(key, async () => {
    const res = await fetch(`/api/weather/current?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const { data, available } = await res.json();
    if (!available || !data) return null;
    return normalizeCurrentWeather(data);
  }, 10 * 60 * 1000); // 10 min
}

/**
 * Get 5-day forecast for coordinates.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Array|null>} Array of up to 5 daily summaries
 */
export async function getWeatherForecast(lat, lng) {
  if (!lat || !lng) return null;
  const key = `weather:forecast:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  return fetchWithCache(key, async () => {
    const res = await fetch(`/api/weather/forecast?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const { data, available } = await res.json();
    if (!available || !data) return null;
    return normalizeForecast(data);
  }, 30 * 60 * 1000); // 30 min
}

/* ── Normalization ─────────────────────────────────────────────────────── */

function normalizeCurrentWeather(d) {
  return {
    temp:        Math.round(d.main?.temp ?? 0),
    feelsLike:   Math.round(d.main?.feels_like ?? 0),
    high:        Math.round(d.main?.temp_max ?? 0),
    low:         Math.round(d.main?.temp_min ?? 0),
    description: d.weather?.[0]?.description ?? '',
    icon:        iconCode(d.weather?.[0]?.icon ?? ''),
    humidity:    d.main?.humidity ?? 0,
    windSpeed:   Math.round((d.wind?.speed ?? 0) * 3.6), // m/s → kph
    cityName:    d.name ?? '',
    country:     d.sys?.country ?? '',
  };
}

function normalizeForecast(raw) {
  // OpenWeather 5-day/3-hour → group by day
  const byDay = {};
  (raw.list ?? []).forEach((item) => {
    const date = item.dt_txt?.slice(0, 10);
    if (!date) return;
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(item);
  });

  return Object.entries(byDay).slice(0, 5).map(([date, items]) => {
    const temps    = items.map((i) => i.main?.temp ?? 0);
    const midday   = items.find((i) => i.dt_txt?.includes('12:00')) ?? items[0];
    const pops     = items.map((i) => i.pop ?? 0);
    return {
      date,
      high:        Math.round(Math.max(...temps)),
      low:         Math.round(Math.min(...temps)),
      description: midday.weather?.[0]?.description ?? '',
      icon:        iconCode(midday.weather?.[0]?.icon ?? ''),
      pop:         Math.round(Math.max(...pops) * 100), // %
    };
  });
}

// Weather service for D Block RWA, Indraprastha Awasiya Yojna, Ghaziabad (Tila Mod / Loni coordinates)
const LATITUDE = 28.73;
const LONGITUDE = 77.28;
const CACHE_KEY = "rwa_weather_data";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const WEATHER_CODE_MAP = {
  0: { condition: "Clear Sky", icon: "☀️", isSunny: true },
  1: { condition: "Mainly Clear", icon: "🌤️", isSunny: true },
  2: { condition: "Partly Cloudy", icon: "⛅", isSunny: true },
  3: { condition: "Overcast", icon: "☁️", isSunny: false },
  45: { condition: "Foggy", icon: "🌫️", isSunny: false },
  48: { condition: "Depositing Rime Fog", icon: "🌫️", isSunny: false },
  51: { condition: "Light Drizzle", icon: "🌦️", isSunny: false },
  53: { condition: "Moderate Drizzle", icon: "🌦️", isSunny: false },
  55: { condition: "Dense Drizzle", icon: "🌧️", isSunny: false },
  61: { condition: "Slight Rain", icon: "🌧️", isSunny: false },
  63: { condition: "Moderate Rain", icon: "🌧️", isSunny: false },
  65: { condition: "Heavy Rain", icon: "🌧️", isSunny: false },
  71: { condition: "Slight Snow Fall", icon: "❄️", isSunny: false },
  73: { condition: "Moderate Snow Fall", icon: "❄️", isSunny: false },
  75: { condition: "Heavy Snow Fall", icon: "❄️", isSunny: false },
  80: { condition: "Rain Showers", icon: "🌧️", isSunny: false },
  81: { condition: "Moderate Rain Showers", icon: "🌧️", isSunny: false },
  82: { condition: "Violent Rain Showers", icon: "⛈️", isSunny: false },
  95: { condition: "Thunderstorm", icon: "⛈️", isSunny: false },
  96: { condition: "Thunderstorm with Hail", icon: "⛈️", isSunny: false },
  99: { condition: "Heavy Thunderstorm", icon: "⛈️", isSunny: false },
};

export async function fetchSocietyWeather() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    }

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`
    );
    if (!res.ok) throw new Error("Failed to fetch weather data");
    const json = await res.json();
    const current = json?.current_weather;

    const codeInfo = WEATHER_CODE_MAP[current?.weathercode] || {
      condition: "Clear Sky",
      icon: "☀️",
      isSunny: true,
    };

    const temp = Math.round(current?.temperature ?? 28);
    const isDay = current?.is_day === 1;

    let condition = codeInfo.condition;
    let icon = isDay ? codeInfo.icon : "🌙";

    // Matching real Indian summer hot daylight presentation
    if (isDay && temp >= 38 && codeInfo.isSunny) {
      condition = "Hot & Sunny";
      icon = "☀️🌡️";
    }

    const weatherData = {
      temp,
      condition,
      icon,
      isDay,
    };

    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: weatherData })
    );

    return weatherData;
  } catch (err) {
    console.warn("Weather fetch error, using realistic fallback:", err?.message);
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 19;
    return {
      temp: 28,
      condition: "Clear Sky",
      icon: isDay ? "☀️" : "🌙",
      isDay,
    };
  }
}

export function formatCurrentDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

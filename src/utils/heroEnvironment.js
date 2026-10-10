/**
 * Environmental Resolver for D Block RWA Resident Dashboard Hero
 * Handles automatic adaptation based on:
 * 1. Time of Day (Morning, Day, Evening, Night)
 * 2. Weather conditions (Sunny, Clear, Partly Cloudy, Cloudy, Rain, Thunderstorm, Fog, Mist)
 * 3. Temperature bands (Winter <15°C, Pleasant 15-25°C, Warm 25-35°C, Hot 35-40°C, Extreme Hot >40°C)
 * 
 * 100% Client-side. Free / Spark compliant. Zero Firebase Storage or backend required.
 */

export function getTimePeriod(date = new Date()) {
  try {
    const d = date instanceof Date && !isNaN(date) ? date : new Date();
    const hour = d.getHours();
    const minutes = d.getMinutes();
    const decimalHour = hour + minutes / 60;

    // Morning / Sunrise: 5:00 AM to 11:59 AM
    if (decimalHour >= 5.0 && decimalHour < 12.0) {
      return "morning";
    }
    // Day: 12:00 PM to 4:59 PM
    if (decimalHour >= 12.0 && decimalHour < 17.0) {
      return "day";
    }
    // Evening / Sunset: 5:00 PM to 7:30 PM
    if (decimalHour >= 17.0 && decimalHour < 19.5) {
      return "evening";
    }
    // Night: 7:30 PM to 4:59 AM
    return "night";
  } catch {
    return "day";
  }
}

export function normalizeWeatherCondition(rawCondition = "") {
  if (!rawCondition || typeof rawCondition !== "string") {
    return "clear";
  }

  const c = rawCondition.toLowerCase();

  // Severe / Rain weather priority
  if (c.includes("thunder") || c.includes("storm") || c.includes("lightning") || c.includes("hail")) {
    return "thunderstorm";
  }
  if (c.includes("heavy rain") || c.includes("violent") || c.includes("torrential")) {
    return "heavy-rain";
  }
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) {
    return "rain";
  }
  if (c.includes("fog") || c.includes("rime")) {
    return "fog";
  }
  if (c.includes("mist") || c.includes("haze")) {
    return "mist";
  }
  if (c.includes("snow") || c.includes("flurry")) {
    return "snow";
  }
  if (c.includes("partly") || c.includes("scattered")) {
    return "partly-cloudy";
  }
  if (c.includes("cloud") || c.includes("overcast")) {
    return "cloudy";
  }
  if (c.includes("sun") || c.includes("bright")) {
    return "sunny";
  }

  return "clear";
}

export function getTemperatureBand(temperature) {
  const num = typeof temperature === "number" ? temperature : parseFloat(temperature);
  if (isNaN(num)) return "normal";

  if (num < 15) return "winter"; // Cold / Winter
  if (num < 25) return "normal"; // Pleasant
  if (num < 35) return "warm";   // Warm normal
  if (num <= 40) return "hot";   // Hot summer
  return "extreme-hot";          // Above 40°C Extreme Hot
}

// Optimized static assets in /public/assets/hero/
const HERO_IMAGES = {
  morning: "/assets/hero/hero-morning.webp",
  day: "/assets/hero/hero-day.webp",
  evening: "/assets/hero/hero-evening.webp",
  night: "/assets/hero/hero-night.webp",
  rain: "/assets/hero/hero-rain.webp",
  fallback: "/society-banner.jpg",
};

/**
 * Resolves complete environmental state for hero banner
 * Priority:
 * 1. Severe weather (Thunderstorm, Heavy Rain, Rain)
 * 2. Time of day (Night, Evening, Morning, Day)
 * 3. Temperature atmosphere (Extreme Hot haze, Winter coolness)
 */
export function getHeroEnvironment({
  currentTime = new Date(),
  temperature = 28,
  weatherCondition = "Clear Sky",
} = {}) {
  const timePeriod = getTimePeriod(currentTime);
  const weather = normalizeWeatherCondition(weatherCondition);
  const tempBand = getTemperatureBand(temperature);

  const isRainy = weather === "rain" || weather === "heavy-rain" || weather === "thunderstorm";
  const isFoggy = weather === "fog" || weather === "mist";

  // Select base image according to priority
  let heroImage;
  let heroState = `${timePeriod}-${weather}`;

  if (isRainy) {
    heroImage = HERO_IMAGES.rain;
    heroState = `${timePeriod}-${weather}`;
  } else {
    switch (timePeriod) {
      case "morning":
        heroImage = HERO_IMAGES.morning;
        break;
      case "evening":
        heroImage = HERO_IMAGES.evening;
        break;
      case "night":
        heroImage = HERO_IMAGES.night;
        break;
      case "day":
      default:
        heroImage = HERO_IMAGES.day;
        break;
    }
  }

  // Atmospheric Overlay Configuration
  const effects = {
    // Rain streaks / wet sheen
    rainOverlay: isRainy,
    // Thunderstorm ambient lightning flash
    thunderstormFlash: weather === "thunderstorm",
    // Atmospheric mist / fog
    fogMist: isFoggy || (tempBand === "winter" && timePeriod === "morning"),
    // Hot / Extreme-hot solar glow & heat haze
    heatAtmosphere: (tempBand === "hot" || tempBand === "extreme-hot") && (timePeriod === "day" || timePeriod === "morning"),
    extremeHotHaze: tempBand === "extreme-hot" && timePeriod === "day",
    // Cold winter tone
    winterAtmosphere: tempBand === "winter",
  };

  return {
    timePeriod,
    weather,
    temperatureBand: tempBand,
    heroImage,
    heroState,
    effects,
    altText: `D Block RWA Society Indraprastha - ${timePeriod.toUpperCase()} view (${weatherCondition}, ${Math.round(temperature)}°C)`,
  };
}

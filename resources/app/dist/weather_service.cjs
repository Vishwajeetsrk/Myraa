/**
 * =============================================================================
 * MYRAA AI OS — Weather & Geolocation Service (with Durable Memory Core)
 * =============================================================================
 * Checks Memory Core first for saved location preference.
 * If missing, resolves via Windows Location API or IP Geolocation, then
 * writes to Memory Core as a durable preference so it never asks again.
 * Fetches real live weather data from Open-Meteo.
 * =============================================================================
 */

'use strict';

const http = require('http');
const https = require('https');
const memoryCore = require('./memory_core_service.cjs');

// WMO Weather interpretation codes
const WEATHER_CODES = {
  0: 'Clear sky ☀️',
  1: 'Mainly clear 🌤️',
  2: 'Partly cloudy ⛅',
  3: 'Overcast ☁️',
  45: 'Fog 🌫️',
  48: 'Depositing rime fog 🌫️',
  51: 'Light drizzle 🌦️',
  53: 'Moderate drizzle 🌦️',
  55: 'Dense drizzle 🌧️',
  61: 'Slight rain 🌧️',
  63: 'Moderate rain 🌧️',
  65: 'Heavy rain 🌧️',
  71: 'Slight snow fall 🌨️',
  73: 'Moderate snow fall 🌨️',
  75: 'Heavy snow fall ❄️',
  80: 'Slight rain showers 🌦️',
  81: 'Moderate rain showers 🌧️',
  82: 'Violent rain showers ⛈️',
  95: 'Thunderstorm ⚡',
  96: 'Thunderstorm with slight hail ⛈️',
  99: 'Thunderstorm with heavy hail ⛈️'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'MYRAA-AI-OS/1.0' }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

class WeatherService {
  /**
   * Resolves location:
   * 1. Check Memory Core (durable user preference)
   * 2. If absent, probe IP-based geolocation
   * 3. Save to Memory Core so it's never asked again
   */
  async resolveLocation(forceRefresh = false) {
    if (!forceRefresh) {
      const stored = memoryCore.getUserLocation();
      if (stored && (stored.city || (stored.lat && stored.lon))) {
        return {
          source: 'memory_core',
          city: stored.city || 'Saved Location',
          region: stored.region || '',
          country: stored.country || '',
          lat: Number(stored.lat) || 12.9716,
          lon: Number(stored.lon) || 77.5946
        };
      }
    }

    // Resolve via IP Geolocation
    try {
      const geo = await fetchJson('https://ip-api.com/json');
      if (geo && geo.status === 'success') {
        const resolved = {
          source: 'ip_geolocation',
          city: geo.city || 'Local City',
          region: geo.regionName || '',
          country: geo.country || '',
          lat: geo.lat,
          lon: geo.lon
        };
        // Persist to Memory Core as durable preference!
        memoryCore.setUserLocation(resolved);
        return resolved;
      }
    } catch (err) {
      console.warn('[WeatherService] IP Geolocation primary failed, trying backup:', err.message);
    }

    // Secondary IP fallback
    try {
      const backup = await fetchJson('https://ipapi.co/json/');
      if (backup && backup.city) {
        const resolved = {
          source: 'ip_backup',
          city: backup.city,
          region: backup.region || '',
          country: backup.country_name || '',
          lat: backup.latitude,
          lon: backup.longitude
        };
        memoryCore.setUserLocation(resolved);
        return resolved;
      }
    } catch (e) {}

    // If completely offline and no memory, default to last known or null
    return null;
  }

  /**
   * Fetches real weather report
   * @param {string|null} optionalCity If user explicitly specifies a city (e.g. "Weather in Paris")
   */
  async getWeather(optionalCity = null) {
    let lat = null;
    let lon = null;
    let locationName = '';

    if (optionalCity) {
      // Geocode the city via Open-Meteo geocoding API
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(optionalCity)}&count=1&language=en&format=json`;
        const geoData = await fetchJson(geoUrl);
        if (geoData && geoData.results && geoData.results.length > 0) {
          const match = geoData.results[0];
          lat = match.latitude;
          lon = match.longitude;
          locationName = `${match.name}, ${match.country || ''}`;
        }
      } catch (e) {
        console.warn('[WeatherService] Geocoding city failed:', e.message);
      }
    }

    // If no city or geocoding failed, use resolved location from Memory Core
    if (!lat || !lon) {
      const resolved = await this.resolveLocation();
      if (!resolved) {
        return {
          ok: false,
          needsLocation: true,
          message: "I couldn't detect your location automatically. What city are you in?"
        };
      }
      lat = resolved.lat;
      lon = resolved.lon;
      locationName = `${resolved.city}${resolved.country ? ', ' + resolved.country : ''}`;
    }

    // Fetch live weather from Open-Meteo
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const wData = await fetchJson(weatherUrl);

      const current = wData.current || {};
      const code = current.weather_code !== undefined ? current.weather_code : 0;
      const condition = WEATHER_CODES[code] || 'Partly cloudy';
      const tempC = Math.round(current.temperature_2m);
      const tempF = Math.round((tempC * 9/5) + 32);
      const feelsLikeC = Math.round(current.apparent_temperature || tempC);
      const humidity = current.relative_humidity_2m || 50;
      const windKmh = Math.round(current.wind_speed_10m || 0);

      const summary = `Currently in ${locationName}: ${tempC}°C (${tempF}°F), ${condition}. Feels like ${feelsLikeC}°C. Humidity: ${humidity}%, Wind: ${windKmh} km/h.`;

      return {
        ok: true,
        location: locationName,
        coordinates: { lat, lon },
        temperature: {
          celsius: tempC,
          fahrenheit: tempF,
          feelsLikeC
        },
        condition,
        weatherCode: code,
        humidity,
        windSpeedKmh: windKmh,
        summary,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        ok: false,
        error: `Weather service error: ${err.message}`
      };
    }
  }

  /**
   * Explicitly set location preference and persist
   */
  async setLocation(cityName) {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
      const geoData = await fetchJson(geoUrl);
      if (geoData && geoData.results && geoData.results.length > 0) {
        const match = geoData.results[0];
        const record = {
          city: match.name,
          region: match.admin1 || '',
          country: match.country || '',
          lat: match.latitude,
          lon: match.longitude,
          source: 'user_explicit'
        };
        memoryCore.setUserLocation(record);
        return { ok: true, location: record };
      }
    } catch (e) {}

    // Fallback: save city name string
    memoryCore.setUserLocation({ city: cityName, source: 'user_text' });
    return { ok: true, location: { city: cityName } };
  }
}

const weatherService = new WeatherService();
module.exports = weatherService;

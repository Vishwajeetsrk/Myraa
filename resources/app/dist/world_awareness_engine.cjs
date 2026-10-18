const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

class WorldAwarenessEngine extends EventEmitter {
  constructor() {
    super();
    this.weatherCache = null;
    this.newsCache = null;
    this.locationCache = null;
    this.lastWeatherUpdate = 0;
    this.lastNewsUpdate = 0;
    this.weatherInterval = null;
    this.newsInterval = null;
    this.factCheckerResults = new Map();
    this.weatherApiKey = process.env.WEATHER_API_KEY || '';
    this.newsApiKey = process.env.NEWS_API_KEY || '';
    this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.userLocale = process.env.USER_LOCALE || 'en-US';
    this._loadConfig();
  }

  _loadConfig() {
    try {
      const configPath = path.join(os.homedir(), '.myraa', 'world_config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.weatherApiKey = config.weatherApiKey || this.weatherApiKey;
        this.newsApiKey = config.newsApiKey || this.newsApiKey;
        this.userTimezone = config.timezone || this.userTimezone;
        this.userLocale = config.locale || this.userLocale;
      }
    } catch (e) { /* use defaults */ }
  }

  _saveConfig() {
    try {
      const configDir = path.join(os.homedir(), '.myraa');
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'world_config.json');
      const config = { weatherApiKey: this.weatherApiKey, newsApiKey: this.newsApiKey, timezone: this.userTimezone, locale: this.userLocale };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) { /* best effort */ }
  }

  configure({ weatherApiKey, newsApiKey, timezone, locale }) {
    if (weatherApiKey) this.weatherApiKey = weatherApiKey;
    if (newsApiKey) this.newsApiKey = newsApiKey;
    if (timezone) this.userTimezone = timezone;
    if (locale) this.userLocale = locale;
    this._saveConfig();
    return { configured: true };
  }

  _httpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { headers, timeout: 15000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data, headers: res.headers });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    });
  }

  async getTime() {
    const now = new Date();
    const timezone = this.userTimezone;
    const locale = this.userLocale;
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    const shortFormatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true
    });
    const dateOnly = new Intl.DateTimeFormat(locale, {
      timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    const timeOnly = shortFormatter.format(now);
    const fullDate = dateOnly.format(now);
    const full = formatter.format(now);
    const unix = Math.floor(now.getTime() / 1000);
    const hour = now.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
    const greeting = parseInt(hour) < 12 ? 'Good morning' : parseInt(hour) < 17 ? 'Good afternoon' : parseInt(hour) < 21 ? 'Good evening' : 'Good night';
    const dayOfWeek = now.toLocaleString('en-US', { timeZone: timezone, weekday: 'long' });
    const isWeekend = ['Saturday', 'Sunday'].includes(dayOfWeek);
    const dateObj = { time: timeOnly, date: fullDate, full, unix, timezone, greeting, dayOfWeek, isWeekend, hour: parseInt(hour) };
    this.emit('time_updated', dateObj);
    return dateObj;
  }

  async getWeather(city = null, units = 'metric') {
    if (this.weatherCache && (Date.now() - this.lastWeatherUpdate) < 300000) {
      return this.weatherCache;
    }
    const cityQuery = city || await this._detectCity();
    if (!cityQuery) {
      return { error: 'Unable to determine location. Please specify a city.', cached: false };
    }
    try {
      if (this.weatherApiKey) {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityQuery)}&appid=${this.weatherApiKey}&units=${units}`;
        const response = await this._httpGet(url);
        const data = JSON.parse(response.data);
        const weather = this._formatOpenWeather(data, units);
        this.weatherCache = weather;
        this.lastWeatherUpdate = Date.now();
        this.emit('weather_updated', weather);
        return weather;
      } else {
        return await this._getWeatherFallback(cityQuery, units);
      }
    } catch (e) {
      return { error: `Weather fetch failed: ${e.message}`, city: cityQuery, cached: false };
    }
  }

  _formatOpenWeather(data, units) {
    const tempUnit = units === 'imperial' ? 'F' : 'C';
    const speedUnit = units === 'imperial' ? 'mph' : 'm/s';
    return {
      city: data.name, country: data.sys?.country, temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like), humidity: data.main.humidity,
      description: data.weather[0]?.description, icon: data.weather[0]?.icon,
      main: data.weather[0]?.main, windSpeed: data.wind?.speed, windDirection: data.wind?.deg,
      visibility: data.visibility, pressure: data.main?.pressure,
      tempUnit, speedUnit, timestamp: Date.now(), cached: false,
      sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000).toLocaleTimeString() : null,
      sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000).toLocaleTimeString() : null,
      alerts: data.alerts || []
    };
  }

  async _getWeatherFallback(city, units) {
    try {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const response = await this._httpGet(url);
      const data = JSON.parse(response.data);
      const current = data.current_condition?.[0];
      if (!current) return { error: 'No weather data available', city, cached: false };
      const tempC = parseInt(current.temp_C);
      const temp = units === 'imperial' ? Math.round(tempC * 9/5 + 32) : tempC;
      const tempUnit = units === 'imperial' ? 'F' : 'C';
      return {
        city: city, country: data.nearest_area?.[0]?.country?.[0]?.value,
        temperature: temp, feelsLike: units === 'imperial' ? Math.round(parseInt(current.FeelsLikeF)) : parseInt(current.FeelsLikeC),
        humidity: parseInt(current.humidity), description: current.weatherDesc?.[0]?.value,
        main: current.weatherDesc?.[0]?.value, windSpeed: parseInt(current.windspeedKmph),
        visibility: parseInt(current.visibility), pressure: parseInt(current.pressure),
        tempUnit, speedUnit: 'km/h', timestamp: Date.now(), cached: false,
        alerts: []
      };
    } catch (e) {
      return { error: `Fallback weather failed: ${e.message}`, city, cached: false };
    }
  }

  async _detectCity() {
    if (this.locationCache) return this.locationCache;
    try {
      const response = await this._httpGet('https://ipapi.co/json/');
      const data = JSON.parse(response.data);
      if (data.city) {
        this.locationCache = data.city;
        return data.city;
      }
    } catch (e) { /* fall through */ }
    try {
      const response = await this._httpGet('https://ip-api.com/json');
      const data = JSON.parse(response.data);
      if (data.city) {
        this.locationCache = data.city;
        return data.city;
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  async getLocation() {
    if (this.locationCache) return { city: this.locationCache, source: 'cached' };
    try {
      const response = await this._httpGet('https://ipapi.co/json/');
      const data = JSON.parse(response.data);
      this.locationCache = data.city;
      return {
        city: data.city, region: data.region, country: data.country_name,
        latitude: data.latitude, longitude: data.longitude, timezone: data.timezone,
        ip: data.ip, org: data.org, source: 'ipapi'
      };
    } catch (e) {
      try {
        const response = await this._httpGet('https://ip-api.com/json');
        const data = JSON.parse(response.data);
        this.locationCache = data.city;
        return {
          city: data.city, region: data.regionName, country: data.country,
          latitude: data.lat, longitude: data.lon, timezone: data.timezone,
          ip: data.query, org: data.isp, source: 'ip-api'
        };
      } catch (e2) {
        return { error: 'Unable to determine location', source: 'none' };
      }
    }
  }

  async getNews(category = 'general', country = 'us', maxResults = 10) {
    if (this.newsCache && this.newsCache.category === category && (Date.now() - this.lastNewsUpdate) < 600000) {
      return this.newsCache;
    }
    try {
      if (this.newsApiKey) {
        const url = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&pageSize=${maxResults}&apiKey=${this.newsApiKey}`;
        const response = await this._httpGet(url);
        const data = JSON.parse(response.data);
        const articles = (data.articles || []).map(a => ({
          title: a.title, description: a.description, source: a.source?.name,
          url: a.url, imageUrl: a.urlToImage, publishedAt: a.publishedAt,
          author: a.author, content: a.content
        }));
        const result = { articles, totalResults: data.totalResults, category, country, timestamp: Date.now(), cached: false };
        this.newsCache = result;
        this.lastNewsUpdate = Date.now();
        this.emit('news_updated', result);
        return result;
      } else {
        return await this._getNewsFallback(category, maxResults);
      }
    } catch (e) {
      return { error: `News fetch failed: ${e.message}`, category, cached: false };
    }
  }

  async _getNewsFallback(category, maxResults) {
    try {
      const feedUrl = category === 'technology' ? 'https://hacker-news.firebaseio.com/v0/topstories.json'
        : category === 'science' ? 'https://hacker-news.firebaseio.com/v0/topstories.json'
        : 'https://hacker-news.firebaseio.com/v0/topstories.json';
      const response = await this._httpGet(feedUrl);
      const storyIds = JSON.parse(response.data).slice(0, maxResults);
      const articles = [];
      for (const id of storyIds) {
        try {
          const storyResp = await this._httpGet(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          const story = JSON.parse(storyResp.data);
          if (story && story.title) {
            articles.push({ title: story.title, url: story.url, source: 'Hacker News', publishedAt: story.time ? new Date(story.time * 1000).toISOString() : null, score: story.score, author: story.by });
          }
        } catch (e) { /* skip */ }
      }
      return { articles, totalResults: articles.length, category, timestamp: Date.now(), cached: false };
    } catch (e) {
      return { error: `Fallback news failed: ${e.message}`, category, cached: false };
    }
  }

  async searchWeb(query, maxResults = 10) {
    // Tavily (primary): structured live search with snippets. Falls back to DuckDuckGo below.
    try {
      const tavily = require('./tavily_search.cjs');
      const t = await tavily.search(query, { maxResults });
      if (t && Array.isArray(t.results) && t.results.length) {
        return {
          query, results: t.results, totalResults: t.results.length,
          timestamp: Date.now(), provider: 'tavily',
          answer: t.answer || undefined
        };
      }
    } catch (e) { /* fall through to DuckDuckGo */ }
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await this._httpGet(searchUrl, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
      const results = this._parseDDGResults(response.data, maxResults);
      return { query, results, totalResults: results.length, timestamp: Date.now() };
    } catch (e) {
      try {
        const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
        const response = await this._httpGet(liteUrl, { 'User-Agent': 'Mozilla/5.0' });
        const results = this._parseLiteResults(response.data, maxResults);
        return { query, results, totalResults: results.length, timestamp: Date.now() };
      } catch (e2) {
        return { error: `Search failed: ${e2.message}`, query, results: [] };
      }
    }
  }

  _parseDDGResults(html, maxResults) {
    const results = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
    let match;
    const urls = [];
    while ((match = resultRegex.exec(html)) && urls.length < maxResults) {
      let url = match[1];
      if (url.includes('uddg=')) {
        try { url = new URL(url).searchParams.get('uddg') || url; } catch (e) { /* keep */ }
      }
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      if (title && url) urls.push({ url, title });
    }
    const snippets = [];
    while ((match = snippetRegex.exec(html)) && snippets.length < maxResults) {
      snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
    }
    for (let i = 0; i < urls.length; i++) {
      results.push({ ...urls[i], snippet: snippets[i] || '', source: 'DuckDuckGo' });
    }
    return results;
  }

  _parseLiteResults(html, maxResults) {
    const results = [];
    const linkRegex = /<a[^>]*rel="nofollow"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs;
    let match;
    while ((match = linkRegex.exec(html)) && results.length < maxResults) {
      const url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      if (title && url && !url.includes('duckduckgo.com')) {
        results.push({ url, title, snippet: '', source: 'DuckDuckGo Lite' });
      }
    }
    return results;
  }

  async verifySource(claim) {
    const searchResults = await this.searchWeb(claim, 5);
    const sources = searchResults.results || [];
    const verification = {
      claim, sources: sources.map(s => ({ title: s.title, url: s.url, snippet: s.snippet })),
      verificationStatus: sources.length > 3 ? 'multiple_sources' : sources.length > 0 ? 'limited_sources' : 'no_sources',
      confidence: sources.length >= 5 ? 'high' : sources.length >= 2 ? 'medium' : sources.length >= 1 ? 'low' : 'none',
      timestamp: Date.now()
    };
    this.factCheckerResults.set(claim, verification);
    return verification;
  }

  async truthCheck(statement) {
    const searchResults = await this.searchWeb(statement, 5);
    const sources = searchResults.results || [];
    const hasCorroboration = sources.length >= 2;
    const corroborationDetails = sources.map(s => ({
      title: s.title, url: s.url, snippet: s.snippet,
      matchesStatement: s.snippet?.toLowerCase().includes(statement.toLowerCase().substring(0, 30)) || false
    }));
    const matchingSources = corroborationDetails.filter(s => s.matchesStatement).length;
    let verdict;
    if (matchingSources >= 3) verdict = 'likely_true';
    else if (matchingSources >= 1) verdict = 'partially_corroborated';
    else if (sources.length >= 3) verdict = 'unverified';
    else if (sources.length >= 1) verdict = 'limited_evidence';
    else verdict = 'no_evidence';
    return {
      statement, verdict, confidence: matchingSources >= 3 ? 'high' : matchingSources >= 1 ? 'medium' : 'low',
      matchingSources, totalSources: sources.length, corroborationDetails, timestamp: Date.now()
    };
  }

  async checkFreshness(topic) {
    const searchResults = await this.searchWeb(`${topic} latest news today`, 5);
    const sources = searchResults.results || [];
    let mostRecentDate = null;
    for (const s of sources) {
      if (s.publishedAt) {
        const d = new Date(s.publishedAt);
        if (!mostRecentDate || d > mostRecentDate) mostRecentDate = d;
      }
    }
    const now = new Date();
    const daysSinceUpdate = mostRecentDate ? Math.floor((now - mostRecentDate) / (1000 * 60 * 60 * 24)) : null;
    let freshness;
    if (daysSinceUpdate === null) freshness = 'unknown';
    else if (daysSinceUpdate <= 1) freshness = 'very_fresh';
    else if (daysSinceUpdate <= 7) freshness = 'recent';
    else if (daysSinceUpdate <= 30) freshness = 'moderate';
    else freshness = 'stale';
    return { topic, freshness, mostRecentDate: mostRecentDate?.toISOString(), daysSinceUpdate, sources: sources.length, timestamp: Date.now() };
  }

  async getMorningBriefing(city = null) {
    const [time, weather, techNews, worldNews, location] = await Promise.all([
      this.getTime(), this.getWeather(city), this.getNews('technology', 'us', 5),
      this.getNews('general', 'us', 5), this.getLocation()
    ]);
    const briefing = { time, weather, techNews: techNews.articles || [], worldNews: worldNews.articles || [], location, timestamp: Date.now() };
    this.emit('morning_briefing', briefing);
    return briefing;
  }

  async getBreakingNews(category = 'general') {
    return await this.getNews(category, 'us', 15);
  }

  async startAutoUpdate(weatherIntervalMs = 300000, newsIntervalMs = 600000) {
    this.stopAutoUpdate();
    this.weatherInterval = setInterval(() => { this.getWeather().catch(() => {}); }, weatherIntervalMs);
    this.newsInterval = setInterval(() => { this.getNews().catch(() => {}); }, newsIntervalMs);
    await Promise.all([this.getWeather(), this.getNews()]);
    return { started: true, weatherIntervalMs, newsIntervalMs };
  }

  stopAutoUpdate() {
    if (this.weatherInterval) { clearInterval(this.weatherInterval); this.weatherInterval = null; }
    if (this.newsInterval) { clearInterval(this.newsInterval); this.newsInterval = null; }
    return { stopped: true };
  }

  getState() {
    return {
      weatherCache: this.weatherCache, newsCache: this.newsCache, locationCache: this.locationCache,
      lastWeatherUpdate: this.lastWeatherUpdate, lastNewsUpdate: this.lastNewsUpdate,
      timezone: this.userTimezone, locale: this.userLocale,
      weatherApiKeyConfigured: !!this.weatherApiKey, newsApiKeyConfigured: !!this.newsApiKey,
      factCheckerCacheSize: this.factCheckerResults.size
    };
  }
}

module.exports = WorldAwarenessEngine;

/* =============================================================================
 * MYRAA AI OS — Free Public API Registry (public-apis integration)
 * =============================================================================
 * Catalogs ALL free (no-auth, HTTPS) APIs from github.com/public-apis/public-apis
 * and provides a unified fetch/execute layer for MYRAA agents, skills, and chat.
 *
 * Categories: Animals, Anime, Books, Crypto, Currency, Development, Entertainment,
 * Environment, Food, Geocoding, Health, Music, News, Science, Sports, Text,
 * Transportation, Weather, and more.
 * ========================================================================== */
'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── API Catalog (all free, no-auth, HTTPS) ──────────────────────────────────
const APIS = [
  // ── ANIMALS ──
  { id: 'cat-facts', name: 'Cat Facts', category: 'Animals', description: 'Random cat facts', url: 'https://catfact.ninja/fact', method: 'GET', responseField: 'fact' },
  { id: 'dog-facts', name: 'Dog Facts', category: 'Animals', description: 'Random dog facts', url: 'https://dog-api.kinduff.com/api/facts', method: 'GET', responseField: 'facts' },
  { id: 'random-dog', name: 'Random Dog', category: 'Animals', description: 'Random dog images', url: 'https://random.dog/woof.json', method: 'GET', responseField: 'url' },
  { id: 'random-cat', name: 'Random Cat', category: 'Animals', description: 'Random cat images from cataas', url: 'https://cataas.com/cat', method: 'GET', raw: true },
  { id: 'random-fox', name: 'Random Fox', category: 'Animals', description: 'Random fox images', url: 'https://randomfox.ca/floof/', method: 'GET', responseField: 'image' },
  { id: 'http-cat', name: 'HTTP Cat', category: 'Animals', description: 'Cat image for any HTTP status code', url: 'https://http.cat/{status}', method: 'GET', params: ['status'], raw: true },
  { id: 'http-dog', name: 'HTTP Dog', category: 'Animals', description: 'Dog image for any HTTP status code', url: 'https://http.dog/{status}.jpg', method: 'GET', params: ['status'], raw: true },
  { id: 'shibe', name: 'Shibe Online', category: 'Animals', description: 'Random Shiba Inu, cats or birds', url: 'https://shibe.online/api/shibes?count=1', method: 'GET' },

  // ── ANIME ──
  { id: 'anime-quotes', name: 'AnimeChan', category: 'Anime', description: 'Random anime quotes (10k+)', url: 'https://animechan.io/api/v1/quotes/random', method: 'GET', responseField: 'data.content' },
  { id: 'anime-facts', name: 'AnimeFacts', category: 'Anime', description: 'Random anime facts', url: 'https://anime-facts-rest-api.vercel.app/api/v1/facts', method: 'GET', responseField: 'data[0].fact' },
  { id: 'jikan-anime', name: 'Jikan (MAL)', category: 'Anime', description: 'Top anime from MyAnimeList', url: 'https://api.jikan.moe/v4/top/anime?limit=5', method: 'GET', responseField: 'data' },
  { id: 'jikan-manga', name: 'Jikan Manga', category: 'Anime', description: 'Top manga from MyAnimeList', url: 'https://api.jikan.moe/v4/top/manga?limit=5', method: 'GET', responseField: 'data' },
  { id: 'anime-characters', name: 'Jikan Characters', category: 'Anime', description: 'Top anime characters', url: 'https://api.jikan.moe/v4/top/characters?limit=5', method: 'GET', responseField: 'data' },
  { id: 'waifu-pics', name: 'Waifu.pics', category: 'Anime', description: 'Random waifu images', url: 'https://api.waifu.pics/sfw/waifu', method: 'GET', responseField: 'url' },
  { id: 'studio-ghibli', name: 'Studio Ghibli', category: 'Anime', description: 'Studio Ghibli films data', url: 'https://ghibliapi.vercel.app/films', method: 'GET' },
  { id: 'anime-search', name: 'Jikan Search', category: 'Anime', description: 'Search anime by name', url: 'https://api.jikan.moe/v4/anime?q={query}&limit=5', method: 'GET', params: ['query'], responseField: 'data' },

  // ── BOOKS & KNOWLEDGE ──
  { id: 'bible-verse', name: 'Bible API', category: 'Books', description: 'Random Bible verse', url: 'https://bible-api.com/?random=verse', method: 'GET', responseField: 'text' },
  { id: 'gutenberg-books', name: 'Gutendex', category: 'Books', description: 'Project Gutenberg top books', url: 'https://gutendex.com/books?sort=-download_count&page=1', method: 'GET', responseField: 'results' },
  { id: 'open-library', name: 'Open Library', category: 'Books', description: 'Search books on Open Library', url: 'https://openlibrary.org/search.json?title={query}&limit=5', method: 'GET', params: ['query'], responseField: 'docs' },
  { id: 'poetry-db', name: 'Poetry DB', category: 'Books', description: 'Random poem', url: 'https://poetrydb.org/random', method: 'GET' },
  { id: 'quran-verse', name: 'Quran API', category: 'Books', description: 'Random Quran verse', url: 'https://api.alquran.cloud/v1/random', method: 'GET', responseField: 'data' },
  { id: 'harry-potter', name: 'Wizard World', category: 'Books', description: 'Harry Potter characters/spells', url: 'https://wizard-world-api.herokuapp.com/characters', method: 'GET' },
  { id: 'gita-verse', name: 'Bhagavad Gita', category: 'Books', description: 'Bhagavad Gita verse', url: 'https://gita-api.com/1/1', method: 'GET', responseField: 'data' },

  // ── CRYPTOCURRENCY ──
  { id: 'coincap', name: 'CoinCap', category: 'Crypto', description: 'Real-time crypto prices (top 100)', url: 'https://api.coincap.io/v2/assets?limit=10', method: 'GET', responseField: 'data' },
  { id: 'coingecko', name: 'CoinGecko', category: 'Crypto', description: 'Crypto prices, market cap, volume', url: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10', method: 'GET' },
  { id: 'coindesk-bpi', name: 'CoinDesk BPI', category: 'Crypto', description: 'Bitcoin Price Index', url: 'https://api.coindesk.com/v1/bpi/currentprice.json', method: 'GET', responseField: 'bpi', deprecated: true, alt: 'coinpaprika' },
  { id: 'coinlore', name: 'Coinlore', category: 'Crypto', description: 'Crypto prices and market data', url: 'https://api.coinlore.net/api/tickers/?limit=10', method: 'GET', responseField: 'data' },
  { id: 'coinpaprika', name: 'Coinpaprika', category: 'Crypto', description: 'Crypto prices, volume, market cap', url: 'https://api.coinpaprika.com/v1/tickers?limit=10', method: 'GET' },
  { id: 'crypto-compare', name: 'CryptoCompare', category: 'Crypto', description: 'Crypto comparison data', url: 'https://min-api.cryptocompare.com/data/top/mktcapfull?limit=10&page=0', method: 'GET', responseField: 'Data' },
  { id: 'defillama', name: 'DefiLlama', category: 'Crypto', description: 'DeFi TVL and protocol data', url: 'https://api.llama.fi/protocols', method: 'GET' },
  { id: 'btc-mempool', name: 'Mempool', category: 'Crypto', description: 'Bitcoin mempool and fee data', url: 'https://mempool.space/api/mempool', method: 'GET' },
  { id: 'btc-halving', name: 'Bitcoin Halving', category: 'Crypto', description: 'Bitcoin halving info', url: 'https://why21million.com/halving-api/v1/current', method: 'GET' },

  // ── CURRENCY ──
  { id: 'currency-api', name: 'Currency API', category: 'Currency', description: 'Free exchange rates (150+ currencies)', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', method: 'GET' },
  { id: 'frankfurter', name: 'Frankfurter', category: 'Currency', description: 'ECB exchange rates', url: 'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,INR', method: 'GET', responseField: 'rates' },
  { id: 'exchangerate-host', name: 'ExchangeRate.host', category: 'Currency', description: 'Free forex & crypto rates', url: 'https://api.exchangerate.host/latest?base=USD', method: 'GET' },
  { id: 'open-er-api', name: 'Open ER API', category: 'Currency', description: 'Exchange rates API', url: 'https://open.er-api.com/v6/latest/USD', method: 'GET', responseField: 'rates' },

  // ── DEVELOPMENT ──
  { id: 'json-placeholder', name: 'JSONPlaceholder', category: 'Development', description: 'Fake REST API for testing', url: 'https://jsonplaceholder.typicode.com/posts?_limit=5', method: 'GET' },
  { id: 'github-repos', name: 'GitHub (public)', category: 'Development', description: 'Public GitHub repos search', url: 'https://api.github.com/search/repositories?q={query}&sort=stars&per_page=5', method: 'GET', params: ['query'], responseField: 'items' },
  { id: 'github-user', name: 'GitHub User', category: 'Development', description: 'GitHub user profile', url: 'https://api.github.com/users/{query}', method: 'GET', params: ['query'] },
  { id: 'httpbin', name: 'HTTPBin', category: 'Development', description: 'HTTP request/response testing', url: 'https://httpbin.org/ip', method: 'GET', responseField: 'origin' },
  { id: 'random-user', name: 'RandomUser', category: 'Development', description: 'Generate random user data', url: 'https://randomuser.me/api/', method: 'GET', responseField: 'results[0]' },
  { id: 'random-uuid', name: 'UUID Generator', category: 'Development', description: 'Generate random UUIDs', url: 'https://www.uuidgenerator.net/api/guid', method: 'GET' },
  { id: 'wrong-number', name: 'Wrong Number', category: 'Development', description: 'Random wrong number SMS texts', url: 'https://wrongnumber.herokuapp.com/random', method: 'GET' },
  { id: 'dev-quotes', name: 'Dev Quotes', category: 'Development', description: 'Random developer quotes', url: 'https://quotes.rest/qod?category=code', method: 'GET', responseField: 'quotes[0]' },

  // ── ENTERTAINMENT ──
  { id: 'joke', name: 'JokeAPI', category: 'Entertainment', description: 'Random jokes (safe mode)', url: 'https://v2.jokeapi.dev/joke/Any?safe-mode', method: 'GET' },
  { id: 'trivia', name: 'Open Trivia', category: 'Entertainment', description: 'Trivia questions', url: 'https://opentdb.com/api.php?amount=1&type=multiple', method: 'GET', responseField: 'results[0]' },
  { id: 'random-activity', name: 'Bored API', category: 'Entertainment', description: 'Random activity suggestions', url: 'https://www.boredapi.com/api/activity', method: 'GET', deprecated: true, alt: 'advice' },
  { id: 'dad-joke', name: 'ICanHazDadJoke', category: 'Entertainment', description: 'Random dad jokes', url: 'https://icanhazdad joke.com/', method: 'GET' },
  { id: 'chuck-norris', name: 'Chuck Norris', category: 'Entertainment', description: 'Random Chuck Norris jokes', url: 'https://api.chucknorris.io/jokes/random', method: 'GET', responseField: 'value' },
  { id: 'useless-facts', name: 'Useless Facts', category: 'Entertainment', description: 'Random useless facts', url: 'https://uselessfacts.jsph.pl/api/v2/facts/random', method: 'GET', responseField: 'text' },
  { id: 'advice', name: 'Advice Slip', category: 'Entertainment', description: 'Random advice', url: 'https://api.adviceslip.com/advice', method: 'GET', responseField: 'slip.advice' },
  { id: 'affirmation', name: 'Affirmations', category: 'Entertainment', description: 'Random positive affirmations', url: 'https://www.affirmations.dev/', method: 'GET', responseField: 'affirmation' },

  // ── ENVIRONMENT ──
  { id: 'air-quality', name: 'WAQI (Air)', category: 'Environment', description: 'World Air Quality Index', url: 'https://api.waqi.info/feed/here/?token=demo', method: 'GET', responseField: 'data' },
  { id: 'co2-data', name: 'CO2 Data', category: 'Environment', description: 'Atmospheric CO2 levels', url: 'https://global-warming.org/api/co2-api', method: 'GET' },
  { id: 'earthquake', name: 'USGS Earthquakes', category: 'Environment', description: 'Recent earthquakes worldwide', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson', method: 'GET', responseField: 'features' },
  { id: 'weather-alerts', name: 'NWS Alerts', category: 'Environment', description: 'US weather alerts', url: 'https://api.weather.gov/alerts/active?limit=5', method: 'GET', responseField: 'features' },

  // ── FOOD & DRINK ──
  { id: 'cocktail-random', name: 'CocktailDB Random', category: 'Food', description: 'Random cocktail recipe', url: 'https://www.thecocktaildb.com/api/json/v1/1/random.php', method: 'GET', responseField: 'drinks[0]' },
  { id: 'cocktail-search', name: 'CocktailDB Search', category: 'Food', description: 'Search cocktails by name', url: 'https://www.thecocktaildb.com/api/json/v1/1/search.php?s={query}', method: 'GET', params: ['query'], responseField: 'drinks' },
  { id: 'meal-random', name: 'MealDB Random', category: 'Food', description: 'Random meal recipe', url: 'https://www.themealdb.com/api/json/v1/1/random.php', method: 'GET', responseField: 'meals[0]' },
  { id: 'meal-search', name: 'MealDB Search', category: 'Food', description: 'Search meals by name', url: 'https://www.themealdb.com/api/json/v1/1/search.php?s={query}', method: 'GET', params: ['query'], responseField: 'meals' },
  { id: 'meal-by-letter', name: 'MealDB By Letter', category: 'Food', description: 'Meals starting with letter', url: 'https://www.themealdb.com/api/json/v1/1/search.php?f={query}', method: 'GET', params: ['query'], responseField: 'meals' },
  { id: 'coffee-random', name: 'Coffee Facts', category: 'Food', description: 'Random coffee facts', url: 'https://coffee.alexflipnote.dev/random.json', method: 'GET' },
  { id: 'beer-random', name: 'PunkAPI Beer', category: 'Food', description: 'Random beer info', url: 'https://api.punkapi.com/v2/beers/random', method: 'GET' },
  { id: 'recipe-by-ingredient', name: 'MealDB Ingredient', category: 'Food', description: 'Meals by ingredient', url: 'https://www.themealdb.com/api/json/v1/1/filter.php?i={query}', method: 'GET', params: ['query'], responseField: 'meals' },

  // ── GEOCODING ──
  { id: 'nominatim', name: 'Nominatim', category: 'Geocoding', description: 'Forward/reverse geocoding (OSM)', url: 'https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=3', method: 'GET', params: ['query'] },
  { id: 'ip-location', name: 'IP-API', category: 'Geocoding', description: 'IP geolocation', url: 'https://ip-api.com/json/', method: 'GET' },
  { id: 'timezone', name: 'TimezoneDB', category: 'Geocoding', description: 'Timezone by lat/lon', url: 'https://api.timezonedb.com/v2.1/get-time-zone?key=demo&format=json&by=position&lat={lat}&lng={lng}', method: 'GET', params: ['lat', 'lng'] },

  // ── HEALTH ──
  { id: 'bmi-calc', name: 'BMI Calculator', category: 'Health', description: 'Calculate BMI', url: 'https://api.calorieninjas.com/v1/bmi?weight={weight}&height={height}', method: 'GET', params: ['weight', 'height'], headers: { 'X-Api-Key': 'demo' } },
  { id: 'nutrition', name: 'CalorieNinjas', category: 'Health', description: 'Nutrition data by food name', url: 'https://api.calorieninjas.com/v1/nutrition?query={query}', method: 'GET', params: ['query'], headers: { 'X-Api-Key': 'demo' } },

  // ── MACHINE LEARNING ──
  { id: 'sentiment', name: 'Sentiment Analysis', category: 'ML', description: 'Text sentiment analysis', url: 'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english', method: 'POST', bodyField: 'inputs' },

  // ── MUSIC ──
  { id: 'itunes-search', name: 'iTunes Search', category: 'Music', description: 'Search music on iTunes', url: 'https://itunes.apple.com/search?term={query}&media=music&limit=5', method: 'GET', params: ['query'], responseField: 'results' },
  { id: 'itunes-lookup', name: 'iTunes Lookup', category: 'Music', description: 'Lookup iTunes track by ID', url: 'https://itunes.apple.com/lookup?id={query}', method: 'GET', params: ['query'], responseField: 'results[0]' },

  // ── NEWS ──
  { id: 'newsapi-org', name: 'NewsAPI (headlines)', category: 'News', description: 'Top headlines (requires free key)', url: 'https://newsapi.org/v2/top-headlines?country=us&pageSize=5&apiKey=demo', method: 'GET', responseField: 'articles' },

  // ── PHOTOGRAPHY ──
  { id: 'unsplash-random', name: 'Unsplash Random', category: 'Photography', description: 'Random photo from Unsplash', url: 'https://source.unsplash.com/random/800x600', method: 'GET', raw: true },

  // ── SCIENCE & MATH ──
  { id: 'numbers', name: 'Numbers API', category: 'Science', description: 'Facts about numbers', url: 'http://numbersapi.com/random/trivia?json', method: 'GET', responseField: 'text' },
  { id: 'science-facts', name: 'Science Facts', category: 'Science', description: 'Random science facts', url: 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', method: 'GET', responseField: 'text' },
  { id: 'mars-photos', name: 'NASA Mars', category: 'Science', description: 'Mars rover photos (DEMO_KEY)', url: 'https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?sol=1000&page=1&api_key=DEMO_KEY', method: 'GET', responseField: 'photos' },
  { id: 'apod', name: 'NASA APOD', category: 'Science', description: 'Astronomy Picture of the Day', url: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', method: 'GET' },
  { id: 'space-news', name: 'Spaceflight News', category: 'Science', description: 'Latest spaceflight news', url: 'https://api.spaceflightnewsapi.net/v4/articles/?limit=5', method: 'GET', responseField: 'results' },
  { id: 'iss-location', name: 'ISS Location', category: 'Science', description: 'Current ISS position', url: 'http://api.open-notify.org/iss-now.json', method: 'GET', responseField: 'iss_position' },
  { id: 'people-space', name: 'People in Space', category: 'Science', description: 'People currently in space', url: 'http://api.open-notify.org/astros.json', method: 'GET', responseField: 'people' },
  { id: 'cat-facts-science', name: 'Cat Facts (Sci)', category: 'Science', description: 'Cat facts for science', url: 'https://catfact.ninja/fact', method: 'GET', responseField: 'fact' },

  // ── SPORTS ──
  { id: 'football-scores', name: 'Football-data', category: 'Sports', description: 'Football scores and standings', url: 'https://api.football-data.org/v4/competitions/PL/standings', method: 'GET', headers: { 'X-Auth-Token': 'demo' }, responseField: 'standings' },

  // ── TEXT ANALYSIS ──
  { id: 'text-stats', name: 'Text Statistics', category: 'Text', description: 'Text readability and stats', url: 'https://api.textgears.com/analyze?text={query}', method: 'GET', params: ['query'] },
  { id: 'ip-info', name: 'IP Info', category: 'Text', description: 'IP address information', url: 'https://ipinfo.io/{query}/json', method: 'GET', params: ['query'] },

  // ── TRANSPORTATION ──
  { id: 'transport-nsw', name: 'Transport API', category: 'Transport', description: 'Transport data', url: 'https://api.transport.nsw.gov.au/v1/live/departures/TfNSWGTFS?apikey=demo', method: 'GET' },

  // ── URL ──
  { id: 'url-check', name: 'Check URL', category: 'URL', description: 'Check if URL is reachable', url: 'https://isitdown.site/api/check/{query}', method: 'GET', params: ['query'] },

  // ── WEATHER ──
  { id: 'wttr-weather', name: 'wttr.in', category: 'Weather', description: 'Weather for any location (text/JSON)', url: 'https://wttr.in/{query}?format=j1', method: 'GET', params: ['query'] },
  { id: 'open-meteo', name: 'Open-Meteo', category: 'Weather', description: 'Free weather forecast (no key)', url: 'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true', method: 'GET', params: ['lat', 'lon'] },
  { id: '7timer', name: '7Timer', category: 'Weather', description: 'Weather forecast', url: 'https://www.7timer.info/bin/api.pl?lon={lon}&lat={lat}&product=civil&output=json', method: 'GET', params: ['lat', 'lon'] },

  // ── QUOTES ──
  { id: 'zen-quotes', name: 'Zen Quotes', category: 'Quotes', description: 'Inspirational quotes', url: 'https://zenquotes.io/api/random', method: 'GET', responseField: '[0]' },
  { id: 'quotable', name: 'Quotable', category: 'Quotes', description: 'Random quotes', url: 'https://api.quotable.io/random', method: 'GET' },
  { id: 'programming-quotes', name: 'Programming Quotes', category: 'Quotes', description: 'Random programming quotes', url: 'https://programming-quotes-api.vercel.app/api/random', method: 'GET' },

  // ── GAMES ──
  { id: 'pokemon', name: 'Pokemon', category: 'Games', description: 'Pokemon data', url: 'https://pokeapi.co/api/v2/pokemon/{query}', method: 'GET', params: ['query'] },
  { id: 'pokemon-random', name: 'Pokemon Random', category: 'Games', description: 'Random Pokemon', url: 'https://pokeapi.co/api/v2/pokemon/{random}', method: 'GET' },
  { id: 'nba-stats', name: 'NBA Players', category: 'Games', description: 'NBA player data', url: 'https://www.balldontlie.io/api/v1/players?per_page=5', method: 'GET', responseField: 'data' },

  // ── IDENTITY ──
  { id: 'uuid-gen', name: 'UUID Generator', category: 'Utility', description: 'Generate random UUID v4', url: 'https://uuidgen-api.herokuapp.com/', method: 'GET' },
  { id: 'lorem-text', name: 'Lorem Ipsum', category: 'Utility', description: 'Generate lorem ipsum text', url: 'https://baconipsum.com/api/?type=all-meat&paras=2&format=text', method: 'GET' },
];

// ── Category list ──
const CATEGORIES = [...new Set(APIS.map((a) => a.category))].sort();

// ── Fetch helper ──
function fetchJSON(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': 'MYRAA-AI-OS/7.5', Accept: 'application/json', ...opts.headers };
    const reqOpts = { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: opts.method || 'GET', headers, timeout: 10000 };
    const req = mod.request(reqOpts, (res) => {
      if (opts.raw) {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        return;
      }
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

// ── Resolve response field (e.g. 'data[0].name') ──
function resolveField(obj, field) {
  if (!field) return obj;
  const parts = field.replace(/\[(\d+)\]/g, '.$1').split('.');
  let val = obj;
  for (const p of parts) {
    if (val == null) return undefined;
    val = val[p];
  }
  return val;
}

// ── Build URL with params ──
function buildUrl(api, params) {
  let url = api.url;
  if (api.params && params) {
    for (const p of api.params) {
      url = url.replace(`{${p}}`, encodeURIComponent(params[p] || ''));
    }
  }
  // auto-fill random numbers for pokemon-random
  if (url.includes('{random}')) url = url.replace('{random}', Math.floor(Math.random() * 898) + 1);
  return url;
}

// ── Main execute function ──
async function execute(apiId, params = {}) {
  const api = APIS.find((a) => a.id === apiId);
  if (!api) return { ok: false, error: `API "${apiId}" not found. Use list() to see available APIs.` };
  const url = buildUrl(api, params);
  try {
    const result = await fetchJSON(url, { method: api.method, headers: api.headers, raw: api.raw, body: api.bodyField ? params[api.bodyField] : undefined });
    if (api.raw) return { ok: true, api: api.id, category: api.category, raw: true, dataLength: result.length, url };
    const data = api.responseField ? resolveField(result, api.responseField) : result;
    return { ok: true, api: api.id, name: api.name, category: api.category, description: api.description, data, url };
  } catch (e) {
    return { ok: false, api: api.id, error: e.message, url };
  }
}

// ── List / search ──
function list(category) {
  if (category) return APIS.filter((a) => a.category.toLowerCase() === category.toLowerCase());
  return APIS;
}

function search(query) {
  const q = String(query || '').toLowerCase();
  return APIS.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
}

function stats() {
  const cats = {};
  for (const a of APIS) cats[a.category] = (cats[a.category] || 0) + 1;
  return { total: APIS.length, categories: CATEGORIES.length, byCategory: cats };
}

module.exports = { APIS, CATEGORIES, execute, list, search, stats, fetchJSON };

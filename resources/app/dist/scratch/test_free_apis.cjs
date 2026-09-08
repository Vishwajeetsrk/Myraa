'use strict';
const { execute, list, search, stats, CATEGORIES } = require('../free_api_registry.cjs');

let pass = 0, fail = 0, skip = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}
function skip_(name, reason) { skip++; console.log(`  SKIP  ${name} (${reason})`); }

(async () => {

console.log('== 1. Registry stats ==');
const s = stats();
t('total APIs > 50', s.total > 50);
t('categories > 10', s.categories > 10);
t('Animals category exists', s.byCategory.Animals > 0);
t('Crypto category exists', s.byCategory.Crypto > 0);

console.log('== 2. List / search ==');
t('list() returns all', list().length === s.total);
t('list(category) filters', list('Animals').every((a) => a.category === 'Animals'));
t('search finds crypto', search('bitcoin').length > 0);
t('search finds weather', search('weather').length > 0);
t('search finds food', search('meal').length > 0);

console.log('== 3. Live API calls (reliable) ==');
const cat = await execute('cat-facts');
t('cat-facts returns text', cat.ok && typeof cat.data === 'string' && cat.data.length > 10);

const joke = await execute('joke');
t('joke returns object', joke.ok && joke.data && joke.data.setup);

const advice = await execute('advice');
t('advice returns slip', advice.ok && advice.data);

const meal = await execute('meal-random');
t('meal-random returns meal name', meal.ok && meal.data && meal.data.strMeal);

const joke2 = await execute('chuck-norris');
t('chuck-norris returns value', joke2.ok && typeof joke2.data === 'string' && joke2.data.length > 10);

const trivia = await execute('trivia');
t('trivia returns question', trivia.ok && trivia.data && trivia.data.question);

const uuid = await execute('uuid-gen');
t('uuid-gen returns string', uuid.ok && typeof uuid.data === 'string');

const poem = await execute('poetry-db');
t('poetry-db returns poem', poem.ok && poem.data);

const httpCat = await execute('http-cat', { status: '200' });
t('http-cat 200 returns image', httpCat.ok && httpCat.raw);

console.log('== 4. Live API calls (may be down externally) ==');
const coin = await execute('coinpaprika');
if (coin.ok) t('coinpaprika returns data', coin.ok && Array.isArray(coin.data));
else skip_('coinpaprika', 'external API down');

const gita = await execute('gita-verse');
if (gita.ok) t('gita-verse returns text', gita.ok && gita.data);
else skip_('gita-verse', 'external API down or redirected');

const coindesk = await execute('coindesk-bpi');
if (coindesk.ok) t('coindesk-bpi returns bpi', coindesk.ok && coindesk.data);
else skip_('coindesk-bpi', 'external API down (DNS)');

const bored = await execute('random-activity');
if (bored.ok) t('random-activity returns activity', bored.ok && bored.data);
else skip_('random-activity', 'external API down (DNS)');

const openlib = await execute('open-library', { query: 'harry' });
if (openlib.ok) t('open-library search works', openlib.ok && openlib.data);
else skip_('open-library', 'external API timeout');

console.log('== 5. Error handling ==');
const bad = await execute('nonexistent-api');
t('unknown API returns error', bad.ok === false && bad.error);

console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${skip} skipped (external)`);
process.exit(fail ? 1 : 0);

})().catch((e) => { console.error('TEST CRASH:', e); process.exit(2); });

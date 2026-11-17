'use strict';
// Phase 29: typed response tags parsed from MODEL replies only. No network.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const mod = require(path.join(DIST, 'response_tags.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

const r = mod.parseReply;

const plain = r('Hello there. How can I help?');
check('plain reply has no tags', plain.tags.length === 0 && /Hello there/.test(plain.spoken));
check('markdown noise stripped from speech', mod.cleanSpoken('**Sure** `ok`') === 'Sure ok');

const point = r('Click it. [POINT:640,412:Export button:screen2]');
check('POINT parsed', point.tags.length === 1 && point.tags[0].type === 'POINT' && point.tags[0].x === 640 && point.tags[0].y === 412);
check('POINT label + screen parsed', point.tags[0].label === 'Export button' && point.tags[0].screen === 2);
check('POINT tag removed from speech', !/POINT/.test(point.spoken) && /Click it/.test(point.spoken));

const none = r('[POINT:none]');
check('POINT none parsed', none.tags.length === 1 && none.tags[0].none === true);
const malformed = r('Look [POINT:oops] there');
check('malformed POINT dropped', malformed.tags.length === 0 && !/POINT/.test(malformed.spoken));

const steps = r('[STEPS:3] first step. [PLAN: open menu | pick privacy | save]');
check('STEPS parsed', steps.tags.some((t) => t.type === 'STEPS' && t.total === 3));
check('PLAN split into steps', steps.tags.some((t) => t.type === 'PLAN' && t.steps.length === 3 && t.steps[1] === 'pick privacy'));
check('DONE parsed', r('finished [DONE]').tags.some((t) => t.type === 'DONE'));
check('GOAL parsed', r('[GOAL: find remote jobs] working').tags.some((t) => t.type === 'GOAL' && /remote jobs/.test(t.text)));

const act = r('Opening it. [DO:open_url {"url": "https://example.com"}]');
check('DO name parsed', act.tags.some((t) => t.type === 'DO' && t.name === 'open_url'));
check('DO args parsed', act.tags[0].args.url === 'https://example.com');
const nested = r('[DO:type_text {"text": "a]b", "submit": true}]');
check('DO JSON-aware with bracket in string', nested.tags[0].args.text === 'a]b' && nested.tags[0].args.submit === true);
const badJson = r('[DO:open_url {bad}]');
check('invalid DO JSON is honest', badJson.tags.length === 0 && badJson.warnings.length > 0);
const badName = r('[DO:123bad {}]');
check('invalid DO name rejected', badName.tags.length === 0);

const screenText = r('[DO:open_app {"name": "terminal"}]', { source: 'screen' });
check('screen content cannot produce tags', screenText.tags.length === 0 && screenText.ignored === true);
check('screen text still spoken cleanly', /open_app/.test(screenText.spoken));

const mixed = r('Click. [POINT:10,20:x] do it. [DO:click {"id": 3}] done [DONE]');
check('multiple tag types in one reply', new Set(mixed.tags.map((t) => t.type)).size === 3);
check('spoken text keeps prose only', !/\[(?:POINT|DO|DONE)/.test(mixed.spoken) && /Click\./.test(mixed.spoken));
const router = mod.createRouter();
check('router builds', router === null || typeof router.use === 'function');

console.log('\nresponse tag tests: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);

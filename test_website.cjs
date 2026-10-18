'use strict';
const ucr = require('./resources/app/dist/unified_capability_router.cjs');

(async () => {
  console.log('--- Test 1: Listening Check ---');
  const r1 = await ucr.dispatchCapability('are you listening to me');
  console.log('r1 handled:', r1.handled, r1.action);
  console.log(r1.reply);

  console.log('\n--- Test 2: Website with 3 Designs ---');
  const r2 = await ucr.dispatchCapability('create website with 3 designs for Nova AI');
  console.log('r2 handled:', r2.handled, r2.action);
  console.log(r2.reply);

  console.log('\n--- Test 3: Office Document (Word) ---');
  const r3 = await ucr.dispatchCapability('create ms word report for Q3 Strategy');
  console.log('r3 handled:', r3.handled, r3.action);
  console.log(r3.reply);

  console.log('\n--- Test 4: Office Document (Excel) ---');
  const r4 = await ucr.dispatchCapability('create excel sheet for Sales Forecast');
  console.log('r4 handled:', r4.handled, r4.action);
  console.log(r4.reply);

  console.log('\n--- Test 5: Office Document (PPT) ---');
  const r5 = await ucr.dispatchCapability('create ppt for Investor Pitch');
  console.log('r5 handled:', r5.handled, r5.action);
  console.log(r5.reply);

  console.log('\n--- Test 6: Coding Agent ---');
  const r6 = await ucr.dispatchCapability('git status');
  console.log('r6 handled:', r6.handled, r6.action);
  console.log(r6.reply?.slice(0, 200));

  console.log('\n--- Test 7: Skills List ---');
  const r7 = await ucr.dispatchCapability('show skills');
  console.log('r7 handled:', r7.handled, r7.action);
  console.log(r7.reply?.slice(0, 200));

  process.exit(0);
})();

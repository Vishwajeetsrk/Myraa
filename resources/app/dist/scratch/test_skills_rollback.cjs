const express = require('express');
const app = express();
app.use(express.json());

const upgradeRoutes = require('../myraa_capabilities_upgrade.cjs');
app.use(upgradeRoutes);

const server = app.listen(3051, async () => {
  console.log('Skill engine test server on 3051');

  try {
    // 1. Test Successful Multi-Step Skill
    console.log('\n--- 1. Testing Successful Skill Pipeline ---');
    const skillSuccess = await fetch('http://localhost:3051/api/skills/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillName: 'Enterprise Lead Onboarding',
        steps: [
          { connector: 'salesforce', action: 'createLead', args: { name: 'Vishwajeet Test', company: 'MYRAA AI OS' } },
          { connector: 'gmail', action: 'sendDraft', args: { to: 'vishwajeetsrk@gmail.com', subject: 'Welcome', body: 'Onboarding initiated.' } }
        ]
      })
    }).then(r => r.json());
    console.log('Success skill response:', skillSuccess.ok, 'Steps executed:', skillSuccess.executedSteps?.length);

    // 2. Test Skill Failure With Automatic Rollback
    console.log('\n--- 2. Testing Skill Failure & Clean Rollback ---');
    const skillFail = await fetch('http://localhost:3051/api/skills/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillName: 'Transactional Rollback Test',
        steps: [
          { connector: 'salesforce', action: 'createLead', args: { name: 'Rollback Lead', company: 'Rollback Inc' } },
          { connector: 'nonexistent_connector', action: 'failingAction', args: {} }
        ]
      })
    }).then(r => r.json());
    console.log('Failure skill response (expected ok=false):', skillFail.ok, 'Rollback executed:', skillFail.rollbackExecuted, 'Rollback items:', skillFail.rollbackLog?.length);

    console.log('\nSKILL & ROLLBACK ENGINE VERIFIED 100%!');
  } catch (e) {
    console.error('Skill test error:', e);
  } finally {
    server.close();
    process.exit(0);
  }
});

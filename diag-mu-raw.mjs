// Quick diagnostic: print raw XBRL structure for MU FY2024 Q1
// Run from repo root with: node diag-mu-raw.mjs
import { SecEdgarClient, fetchRawCompanyFacts } from '@equitylens/data';

const client = new SecEdgarClient('EquityLens research@equitylens.ai');

async function main() {
  const facts = await fetchRawCompanyFacts(client, 'MU');
  if (!facts) { console.error('No facts'); return; }

  console.log('Entity:', facts.entityName, 'CIK:', facts.cik);

  // Check key concepts and what fy/fp values they have
  const concepts = [
    'Revenues', 'CostOfRevenue', 'GrossProfit',
    'NetIncomeLoss', 'OperatingIncome',
    'CashAndCashEquivalentsAtCarryingValue',
    'Assets', 'Liabilities',
    'AccountsPayableCurrent',
    'PropertyPlantAndEquipmentNet',
    'ShortTermInvestments',
  ];

  for (const concept of concepts) {
    const entry = facts.facts['us-gaap']?.[concept];
    if (!entry) {
      console.log(`${concept}: NOT FOUND`);
      continue;
    }
    const usdUnits = entry.units['USD'] || [];
    // Show all FY/Q1 entries
    const q1Entries = usdUnits.filter(u => u.fp === 'Q1');
    console.log(`${concept}: ${usdUnits.length} USD entries, Q1 entries by fy:`);
    const byFy = {};
    for (const u of q1Entries) {
      if (!byFy[u.fy]) byFy[u.fy] = [];
      byFy[u.fy].push({ form: u.form, filed: u.filed, val: u.val });
    }
    for (const [fy, vals] of Object.entries(byFy)) {
      console.log(`  fy=${fy}: ${JSON.stringify(vals[0])}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });

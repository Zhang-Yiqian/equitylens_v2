import { SecEdgarClient, fetchRawCompanyFacts } from '@equitylens/data';

const client = new SecEdgarClient('EquityLens research@equitylens.ai');
console.log('Base URL:', client.getBaseUrl());

// Test CIK lookup via SEC company tickers
try {
  const tickers = await client.fetch('https://www.sec.gov/files/company_tickers.json');
  const entries = Object.values(tickers);
  const mu = entries.find(e => e.ticker === 'MU');
  console.log('MU CIK:', JSON.stringify(mu));
} catch(e) {
  console.error('CIK lookup failed:', e.message);
}

// Test raw company facts
try {
  const facts = await fetchRawCompanyFacts(client, 'MU');
  if (!facts) {
    console.error('No facts returned for MU');
  } else {
    console.log('Entity name:', facts.entityName);
    const rev = facts.facts['us-gaap']?.Revenues;
    if (rev) {
      const units = rev.units['USD'] || [];
      console.log('Revenue entries count:', units.length);
      const fy2021 = units.filter(u => u.fy === 2021);
      console.log('FY2021 entries:', fy2021.map(u => `FP=${u.fp} form=${u.form} filed=${u.filed} val=${u.val}`));
      // Show all
      units.forEach(u => {
        console.log(`  FY=${u.fy}, FP=${u.fp}, form=${u.form}, filed=${u.filed}, val=${u.val}`);
      });
    } else {
      console.log('No Revenues in us-gaap. Checking RevenueFromContract...');
      const rfce = facts.facts['us-gaap']?.RevenueFromContractWithCustomerExcludingAssessedTax;
      if (rfce) {
        const units = rfce.units['USD'] || [];
        console.log('RevenueFromContract entries:', units.length);
        units.slice(0, 5).forEach(u => {
          console.log(`  FY=${u.fy}, FP=${u.fp}, form=${u.form}, filed=${u.filed}, val=${u.val}`);
        });
      }
    }
  }
} catch(e) {
  console.error('fetchRawCompanyFacts failed:', e.message);
}

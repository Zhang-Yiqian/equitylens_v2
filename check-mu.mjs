import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = '/Users/zhangyiqian/Documents/code/equitylens_v2/data/equitylens.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const rows = db.prepare(`
  SELECT filing_type, year, quarter, filing_date,
         item1_business, item7_md_and_a, item2_md_and_a,
         is_raw_fallback
  FROM ten_k_cache
  WHERE ticker = 'MU'
  ORDER BY year DESC, quarter DESC
  LIMIT 5
`).all();

for (const r of rows) {
  console.log('type:', r.filing_type, 'year:', r.year, 'q:', r.quarter, 'date:', r.filing_date);
  console.log('  item1Business:', r.item1_business ? r.item1_business.substring(0, 120) : 'NULL');
  console.log('  item7MdAndA:', r.item7_md_and_a ? r.item7_md_and_a.substring(0, 120) : 'NULL');
  console.log('  item2MdAndA:', r.item2_md_and_a ? r.item2_md_and_a.substring(0, 120) : 'NULL');
  console.log('  isRawFallback:', r.is_raw_fallback);
  console.log();
}

db.close();

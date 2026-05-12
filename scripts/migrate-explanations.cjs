require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  await client.connect();
  console.log('Connected to DB');

  await client.query(`ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT FALSE`);
  console.log('Added is_latest');

  await client.query(`ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS revisado_em TIMESTAMPTZ`);
  console.log('Added revisado_em');

  await client.query(`ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS revisado_por UUID`);
  console.log('Added revisado_por');

  await client.query(`
    UPDATE promise_explanations pe1
    SET is_latest = true
    WHERE pe1.id = (
      SELECT pe2.id FROM promise_explanations pe2
      WHERE pe2.promise_id = pe1.promise_id
      ORDER BY pe2.gerado_em DESC
      LIMIT 1
    )
  `);
  console.log('Set is_latest=true for latest per promise');

  await client.query(`CREATE INDEX IF NOT EXISTS idx_promise_explanations_latest ON promise_explanations(promise_id, is_latest) WHERE is_latest = TRUE`);
  console.log('Created index');

  await client.end();
  console.log('Done!');
}

migrate().catch(e => { console.error(e); process.exit(1); });
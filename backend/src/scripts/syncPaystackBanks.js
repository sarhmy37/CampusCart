// scripts/syncPaystackBanks.js
//
// Replaces the made-up bank codes (001–021) in your `banks` table with the real
// codes Paystack uses for Ghana. The 3 mobile money rows (MTN, VOD, AT) are untouched.
//
// Run from your backend folder with your env loaded:
//   node -r dotenv/config scripts/syncPaystackBanks.js
// (if you don't use dotenv, just run it somewhere PAYSTACK_SECRET_KEY is already set)

const pool = require('../db/pool');
const { paystackRequest } = require('../utils/paystack');

async function fetchGhanaBanks() {
    const all = [];
    let next = null;
    do {
        const qs = new URLSearchParams({ currency: 'GHS', perPage: '100' });
        if (next) qs.set('next', next);
        const res = await paystackRequest(`/bank?${qs.toString()}`);
        all.push(...(res.data || []));
        next = res.meta?.next || null;
    } while (next);

    // Keep real bank accounts only; mobile money is handled by the app's own MTN/VOD/AT rows.
    const seen = new Set();
    return all.filter((b) => {
        if (b.type === 'mobile_money' || b.active === false || !b.code || seen.has(b.code)) return false;
        seen.add(b.code);
        return true;
    });
}

(async () => {
    const client = await pool.connect();
    try {
        const fresh = await fetchGhanaBanks();
        if (fresh.length === 0) throw new Error('Paystack returned no Ghana banks. Check your key and currency.');

        console.log(`Paystack returned ${fresh.length} Ghana banks:`);
        fresh.forEach((b) => console.log(`  ${b.code}  ${b.name}`));

        await client.query('BEGIN');

        // Old rows that are not in the fresh list
        const freshCodes = fresh.map((b) => b.code);
        const old = await client.query(
            `SELECT code, name FROM banks WHERE type = 'bank' AND NOT (code = ANY($1::text[]))`,
            [freshCodes]
        );
        for (const row of old.rows) {
            const used = await client.query(
                'SELECT 1 FROM seller_payout_accounts WHERE bank_code = $1 LIMIT 1',
                [row.code]
            );
            if (used.rows.length > 0) {
                console.warn(`KEPT old code ${row.code} (${row.name}): a seller payout account still uses it.`);
            } else {
                await client.query('DELETE FROM banks WHERE code = $1', [row.code]);
            }
        }

        for (const b of fresh) {
            await client.query('DELETE FROM banks WHERE code = $1', [b.code]);
            await client.query(`INSERT INTO banks (code, name, type) VALUES ($1, $2, 'bank')`, [b.code, b.name]);
        }

        await client.query('COMMIT');
        console.log('Done.');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Sync failed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();
const { createClient } = require('@sanity/client');
const fs = require('fs');
const path = require('path');

const client = createClient({
    projectId: 'qkevx4jq',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_TOKEN,
    useCdn: false,
});

const ASSETS_DIR = path.join(__dirname, 'assets');
const OUT_FILE = path.join(__dirname, 'urls.json');
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

async function main() {
    if (!process.env.SANITY_TOKEN) {
        console.error('Set SANITY_TOKEN first.');
        process.exit(1);
    }

    // Resume support: files already uploaded are skipped if you re-run after a network drop.
    const out = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {};
    const files = fs.readdirSync(ASSETS_DIR);

    for (const file of files) {
        if (out[file]) {
            console.log(`skip   ${file}`);
            continue;
        }
        const full = path.join(ASSETS_DIR, file);
        if (!fs.statSync(full).isFile()) continue;

        const type = IMAGE_EXTS.includes(path.extname(file).toLowerCase()) ? 'image' : 'file';
        try {
            const doc = await client.assets.upload(type, fs.createReadStream(full), { filename: file });
            out[file] = doc.url;
            fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
            console.log(`ok     ${file}`);
        } catch (err) {
            console.error(`FAILED ${file}: ${err.message}`);
        }
    }
    console.log(`\nDone. ${Object.keys(out).length} files in urls.json`);
}

main();
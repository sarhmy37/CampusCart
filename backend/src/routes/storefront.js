const express = require('express');
const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');
const pool = require('../db/pool');

const router = express.Router();

// Your deployed React app's origin — real visitors get redirected here.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://your-frontend.vercel.app';

// Known link-preview / crawler user agents. Only these ever see the
// server-rendered HTML below — everyone else is redirected immediately.
const BOT_UA_PATTERN = /(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|SkypeUriPreview|Pinterest|redditbot|Googlebot)/i;

// satori can't use system fonts — it needs an actual font file loaded into
// memory. Download a .ttf (e.g. Inter, from https://fonts.google.com/specimen/Inter)
// and place it at the path below, or update this path.
const FONT_PATH = path.join(__dirname, '../../assets/fonts/Inter-Bold.ttf');
let fontData = null;
try {
    fontData = fs.readFileSync(FONT_PATH);
} catch {
    console.warn('OG image font not found at', FONT_PATH, '— og-image.png route will fail until you add one.');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

async function getSellerSummary(id) {
    const userResult = await pool.query(
        'SELECT id, name, school, verified, avatar_url, location FROM users WHERE id = $1',
        [id]
    );
    const seller = userResult.rows[0];
    if (!seller) return null;

    const [listingsResult, reviewsResult, salesResult] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM products WHERE seller_id = $1 AND stock > 0', [id]),
        pool.query('SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS total FROM reviews WHERE seller_id = $1', [id]),
        pool.query('SELECT COUNT(*) FROM order_items WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL', [id]),
    ]);

    return {
        ...seller,
        listingCount: parseInt(listingsResult.rows[0].count, 10),
        avgRating: parseFloat(reviewsResult.rows[0].avg_rating),
        reviewCount: parseInt(reviewsResult.rows[0].total, 10),
        salesCount: parseInt(salesResult.rows[0].count, 10),
    };
}

// GET /store/:id — the link sellers actually copy/share.
// Bots get meta tags; humans get redirected to the real React storefront.
router.get('/store/:id', async (req, res) => {
    const { id } = req.params;
    const isBot = BOT_UA_PATTERN.test(req.headers['user-agent'] || '');
    const pageUrl = `${FRONTEND_URL}/store/${id}`;

    if (!isBot) {
        const appUrl = `app://seller/${encodeURIComponent(id)}`;
        res.set('Content-Type', 'text/html');
        return res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Opening TreX…</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding-top:40px">
<p>Opening TreX…</p>
<p><a href="${appUrl}">Open in app</a> · <a href="${pageUrl}">Continue on web</a></p>
<script>
  var t = setTimeout(function () { window.location.href = ${JSON.stringify(pageUrl)}; }, 1500);
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(t); });
  window.location.href = ${JSON.stringify(appUrl)};
</script>
</body>
</html>`);
    }

    const seller = await getSellerSummary(id).catch(() => null);
    if (!seller) {
        return res.redirect(302, pageUrl);
    }

    const theme = req.query.theme === 'dark' ? 'dark' : 'light';
    const imageUrl = `${req.protocol}://${req.get('host')}/store/${id}/og-image.png?theme=${theme}`;

    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="900" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
</head>
<body></body>
</html>`);
});

// GET /store/:id/og-image.png — the generated share image itself
router.get('/store/:id/og-image.png', async (req, res) => {
    if (!fontData) {
        return res.status(500).send('Font not configured — see FONT_PATH in storefront.js');
    }
    try {
        const seller = await getSellerSummary(req.params.id);
        if (!seller) return res.status(404).end();

        let avatarSrc = null;
        if (seller.avatar_url) {
            try {
                const url = seller.avatar_url.includes('cdn.sanity.io')
                    ? `${seller.avatar_url}${seller.avatar_url.includes('?') ? '&' : '?'}w=600&h=600&fit=crop&fm=png`
                    : seller.avatar_url;
                const r = await fetch(url);
                if (r.ok) {
                    const type = r.headers.get('content-type') || 'image/png';
                    avatarSrc = `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
                }
            } catch {}
        }

        const dark = req.query.theme === 'dark';
        const T = dark
            ? { bg: '#161411', alt: '#211e19', text: '#f5f0e6', muted: '#a89f8d', fade: 'rgba(22,20,17,0)' }
            : { bg: '#ffffff', alt: '#f8fafc', text: '#0f172a', muted: '#64748b', fade: 'rgba(255,255,255,0)' };

        const stat = (value, label) => ({
            type: 'div',
            props: {
                style: { display: 'flex', flexDirection: 'column' },
                children: [
                    { type: 'div', props: { style: { fontSize: 56, fontWeight: 800, color: T.text }, children: String(value) } },
                    { type: 'div', props: { style: { fontSize: 26, color: T.muted, marginTop: '4px' }, children: label } },
                ],
            },
        });

        const svg = await satori(
            {
                type: 'div',
                props: {
                    style: {
                        width: '1200px', height: '900px', display: 'flex', flexDirection: 'column',
                        background: T.bg, fontFamily: 'Inter',
                    },
                    children: [
                        {
                            type: 'div',
                            props: {
                                style: { position: 'relative', display: 'flex', width: '1200px', height: '400px', background: T.alt, overflow: 'hidden' },
                                children: [
                                    avatarSrc && {
                                        type: 'img',
                                        props: { src: avatarSrc, width: 1200, height: 400, style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '400px', objectFit: 'cover' } },
                                    },
                                    {
                                        type: 'div',
                                        props: { style: { position: 'absolute', bottom: 0, left: 0, width: '1200px', height: '220px', background: `linear-gradient(to bottom, ${T.fade}, ${T.bg})` } },
                                    },
                                ].filter(Boolean),
                            },
                        },
                        {
                            type: 'div',
                            props: {
                                style: {
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                    width: '200px', height: '200px', borderRadius: '100px',
                                    marginTop: '-100px', marginLeft: '64px',
                                    border: `8px solid ${T.bg}`, background: T.alt,
                                },
                                children: avatarSrc
                                    ? { type: 'img', props: { src: avatarSrc, width: 200, height: 200, style: { width: '200px', height: '200px', objectFit: 'cover' } } }
                                    : { type: 'div', props: { style: { fontSize: 80, fontWeight: 800, color: T.muted }, children: (seller.name || '?')[0].toUpperCase() } },
                            },
                        },
                        {
                            type: 'div',
                            props: {
                                style: { display: 'flex', flexDirection: 'column', padding: '20px 64px 0 64px' },
                                children: [
                                    { type: 'div', props: { style: { fontSize: 64, fontWeight: 800, color: T.text }, children: seller.name } },
                                    seller.school && { type: 'div', props: { style: { fontSize: 30, color: T.muted, marginTop: '6px' }, children: seller.school } },
                                    seller.location && { type: 'div', props: { style: { fontSize: 30, color: T.muted, marginTop: '6px' }, children: seller.location } },
                                    {
                                        type: 'div',
                                        props: {
                                            style: { display: 'flex', gap: '72px', marginTop: '40px' },
                                            children: [
                                                stat(seller.listingCount, seller.listingCount === 1 ? 'Listing' : 'Listings'),
                                                stat(seller.salesCount, seller.salesCount === 1 ? 'Sale' : 'Sales'),
                                                seller.reviewCount > 0
                                                    ? stat(seller.avgRating.toFixed(1), `${seller.reviewCount} review${seller.reviewCount === 1 ? '' : 's'}`)
                                                    : stat('-', 'No reviews yet'),
                                            ],
                                        },
                                    },
                                ].filter(Boolean),
                            },
                        },
                    ],
                },
            },
            {
                width: 1200,
                height: 900,
                fonts: [{ name: 'Inter', data: fontData, weight: 800, style: 'normal' }],
            }
        );

        const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
        const png = resvg.render().asPng();

        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=3600'); // 1hr — balances freshness vs regen cost
        res.send(png);
    } catch (err) {
        console.error('OG image generation error:', err);
        res.status(500).end();
    }
});

module.exports = router;
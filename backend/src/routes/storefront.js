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
        'SELECT id, name, school, verified, avatar_url FROM users WHERE id = $1',
        [id]
    );
    const seller = userResult.rows[0];
    if (!seller) return null;

    const [listingsResult, reviewsResult] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM products WHERE seller_id = $1 AND status = 'available'", [id]),
        pool.query('SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS total FROM reviews WHERE seller_id = $1', [id]),
    ]);

    return {
        ...seller,
        listingCount: parseInt(listingsResult.rows[0].count, 10),
        avgRating: parseFloat(reviewsResult.rows[0].avg_rating),
        reviewCount: parseInt(reviewsResult.rows[0].total, 10),
    };
}

// GET /store/:id — the link sellers actually copy/share.
// Bots get meta tags; humans get redirected to the real React storefront.
router.get('/store/:id', async (req, res) => {
    const { id } = req.params;
    const isBot = BOT_UA_PATTERN.test(req.headers['user-agent'] || '');
    const pageUrl = `${FRONTEND_URL}/store/${id}`;

    if (!isBot) {
        return res.redirect(302, pageUrl);
    }

    const seller = await getSellerSummary(id).catch(() => null);
    if (!seller) {
        return res.redirect(302, pageUrl);
    }

    const title = `${seller.name} — TreX Store`;
    const description = `${seller.listingCount} listing${seller.listingCount === 1 ? '' : 's'} on TreX` +
        (seller.avgRating > 0 ? ` · ★ ${seller.avgRating.toFixed(1)} (${seller.reviewCount} reviews)` : '');
    const imageUrl = `${req.protocol}://${req.get('host')}/store/${id}/og-image.png`;

    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="TreX" />
<meta name="twitter:card" content="summary_large_image" />
</head>
<body>
<a href="${pageUrl}">View ${escapeHtml(seller.name)}'s store on TreX</a>
</body>
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

        const svg = await satori(
            {
                type: 'div',
                props: {
                    style: {
                        width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
                        background: '#161411', fontFamily: 'Inter',
                    },
                    children: [
                        {
                            type: 'div',
                            props: {
                                style: { position: 'relative', display: 'flex', width: '1200px', height: '270px', background: '#211e19', overflow: 'hidden' },
                                children: [
                                    avatarSrc && {
                                        type: 'img',
                                        props: { src: avatarSrc, width: 1200, height: 270, style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '270px', objectFit: 'cover' } },
                                    },
                                    {
                                        type: 'div',
                                        props: { style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '270px', background: 'rgba(0,0,0,0.4)' } },
                                    },
                                ].filter(Boolean),
                            },
                        },
                        {
                            type: 'div',
                            props: {
                                style: {
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                    width: '180px', height: '180px', borderRadius: '90px',
                                    marginTop: '-90px', marginLeft: '64px',
                                    border: '8px solid #161411', background: '#211e19',
                                },
                                children: avatarSrc
                                    ? { type: 'img', props: { src: avatarSrc, width: 180, height: 180, style: { width: '180px', height: '180px', objectFit: 'cover' } } }
                                    : { type: 'div', props: { style: { fontSize: 72, fontWeight: 800, color: '#E6AB2B' }, children: (seller.name || '?')[0].toUpperCase() } },
                            },
                        },
                        {
                            type: 'div',
                            props: {
                                style: { display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '16px 64px 0 64px' },
                                children: [
                                    { type: 'div', props: { style: { fontSize: 60, fontWeight: 800, color: '#f5f0e6' }, children: seller.name } },
                                    { type: 'div', props: { style: { fontSize: 28, color: '#a89f8d', marginTop: '4px' }, children: seller.school || '' } },
                                    {
                                        type: 'div',
                                        props: {
                                            style: { display: 'flex', gap: '32px', fontSize: 30, color: '#a89f8d', marginTop: '16px' },
                                            children: [
                                                { type: 'div', props: { children: `${seller.listingCount} listing${seller.listingCount === 1 ? '' : 's'}` } },
                                                {
                                                    type: 'div',
                                                    props: {
                                                        children: seller.avgRating > 0
                                                            ? `Rated ${seller.avgRating.toFixed(1)} · ${seller.reviewCount} review${seller.reviewCount === 1 ? '' : 's'}`
                                                            : 'New seller',
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            type: 'div',
                            props: {
                                style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '84px', background: '#E6AB2B' },
                                children: { type: 'div', props: { style: { fontSize: 34, fontWeight: 800, color: '#0d0c0a' }, children: 'View store →' } },
                            },
                        },
                    ],
                },
            },
            {
                width: 1200,
                height: 630,
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
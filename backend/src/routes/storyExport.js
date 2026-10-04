// backend/routes/storyExport.js
// Mount: app.use('/api/story-export', require('./routes/storyExport')({ pool, requireAuth }));
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const ffmpegPath = require('ffmpeg-static');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const LOGO = path.join(__dirname, '..', 'assets', 'watermark.png');
GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'Poppins-Bold.ttf'), 'Poppins');

const TMP = path.join(os.tmpdir(), 'trex-export');
fs.mkdirSync(TMP, { recursive: true });

const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const MAX_MS = 60000;

const sign = (obj) => {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${p}.${crypto.createHmac('sha256', SECRET).update(p).digest('base64url')}`;
};
const verify = (token) => {
  const [p, s] = String(token || '').split('.');
  if (!p || !s) return null;
  const e = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  try {
    const o = JSON.parse(Buffer.from(p, 'base64url').toString());
    return o.exp > Date.now() ? o : null;
  } catch { return null; }
};

// one ffmpeg job at a time (Render free has very little CPU/RAM)
let chain = Promise.resolve();
const queued = (fn) => {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
};

const planActive = (u) =>
  !!(u && u.plan && u.plan !== 'free' && u.plan_expires_at && new Date(u.plan_expires_at) > new Date());

const handleOf = (n) => {
  const t = String(n || '').trim();
  return `@${t.length > 12 ? t.slice(0, 10) + '..' : t}`;
};

function namePng(text) {
  const fs_ = 22;
  const lines = ['TRE-X', text];
  const m = createCanvas(10, 10).getContext('2d');
  m.font = `${fs_}px Poppins`;
  const w = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width))) + 16;
  const lh = fs_ + 6;
  const h = lh * 2 + 12;
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.font = `${fs_}px Poppins`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,0.65)';
  x.shadowBlur = 4;
  x.shadowOffsetY = 1;
  x.fillStyle = '#fff';
  lines.forEach((l, i) => x.fillText(l, w / 2, 8 + lh * i + lh / 2));
  return { buf: c.toBuffer('image/png'), width: w };
}

async function fetchSource(url, dest) {
  if (url.startsWith('data:')) {
    fs.writeFileSync(dest, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    return;
  }
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`source ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dest));
}

function renderWatermarked({ src, out, handle, startMs, durMs }) {
  return new Promise((resolve, reject) => {
    const name = namePng(handle);
    const namePath = `${out}.name.png`;
    fs.writeFileSync(namePath, name.buf);
    const cx = Math.round(720 - 24 - Math.max(name.width, 100) / 2);
    const filter =
      `[0:v]scale=720:-2,setsar=1[base];` +
      `[1:v]format=rgba,scale=w='2*trunc(45*(1+0.06*sin(2*PI*t/2.4)))':h=-2:eval=frame:flags=bicubic[logo];` +
      `[base][logo]overlay=x='if(lt(mod(t,10),5),630,90)-w/2':y='if(lt(mod(t,10),5),H-200-h/2,H*0.25-h/2)':shortest=1[b2];` +
      `[b2][2:v]overlay=x='if(lt(mod(t,10),5),630,90)-w/2':y='if(lt(mod(t,10),5),H-135,H*0.25+65)':shortest=1[v]`;
    const args = ['-y', '-loglevel', 'error'];
    if (startMs > 0) args.push('-ss', String(startMs / 1000));
    args.push('-t', String(durMs / 1000), '-i', src,
      '-loop', '1', '-framerate', '30', '-i', LOGO,
      '-loop', '1', '-framerate', '30', '-i', namePath,
      '-filter_complex', filter,
      '-map', '[v]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out);
    const p = spawn(ffmpegPath, args);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => {
      fs.rm(namePath, () => {});
      code === 0 ? resolve() : reject(new Error(err.slice(-500) || `ffmpeg ${code}`));
    });
  });
}

function sweep() {
  const cutoff = Date.now() - 2 * 3600 * 1000;
  fs.readdir(TMP, (e, files) => {
    (files || []).forEach((f) => {
      const fp = path.join(TMP, f);
      fs.stat(fp, (_e, st) => { if (st && st.mtimeMs < cutoff) fs.rm(fp, () => {}); });
    });
  });
}

module.exports = ({ pool, requireAuth }) => {
  const router = express.Router();

  // 1) app asks for an export link
  router.post('/:id', requireAuth, async (req, res) => {
    try {
      const { rows: [s] } = await pool.query(
        'SELECT id, media_type FROM stories WHERE id = $1', [req.params.id]);
      if (!s) return res.status(404).json({ error: 'Story not found' });
      if (s.media_type !== 'video') return res.status(400).json({ error: 'Only videos can be exported' });
      const { rows: [u] } = await pool.query(
        'SELECT plan, plan_expires_at FROM users WHERE id = $1', [req.userId]);
      const watermarked = !planActive(u);
      const token = sign({ sid: s.id, wm: watermarked, exp: Date.now() + 10 * 60 * 1000 });
      const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0];
      res.json({ url: `${proto}://${req.get('host')}${req.baseUrl}/file?t=${token}`, watermarked });
    } catch (e) {
      console.error('export link', e);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // 2) app downloads the file (token is the auth)
  router.get('/file', async (req, res) => {
    const tok = verify(req.query.t);
    if (!tok) return res.status(403).json({ error: 'Link expired' });
    sweep();
    const src = path.join(TMP, `${tok.sid}.src`);
    try {
      const { rows: [s] } = await pool.query(
        `SELECT s.id, s.media_url, s.trim_start_ms, s.trim_end_ms, u.name AS owner_name
           FROM stories s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [tok.sid]);
      if (!s) return res.status(404).json({ error: 'Story not found' });

      // Pro / Premium: original file, no watermark
      if (!tok.wm) {
        if (/^https?:/i.test(s.media_url)) return res.redirect(s.media_url);
        await fetchSource(s.media_url, src);
        return res.type('video/mp4').sendFile(src, () => fs.rm(src, () => {}));
      }

      // Free: watermarked copy (cached, same for every free exporter)
      const out = path.join(TMP, `${s.id}.mp4`);
      if (!fs.existsSync(out)) {
        await queued(async () => {
          if (fs.existsSync(out)) return;
          await fetchSource(s.media_url, src);
          const hasTrim = s.trim_start_ms != null && s.trim_end_ms != null && s.trim_end_ms > s.trim_start_ms;
          const startMs = hasTrim ? Number(s.trim_start_ms) : 0;
          const durMs = Math.min(hasTrim ? s.trim_end_ms - s.trim_start_ms : MAX_MS, MAX_MS);
          const tmpOut = `${out}.part.mp4`;
          try {
            await renderWatermarked({ src, out: tmpOut, handle: handleOf(s.owner_name), startMs, durMs });
            fs.renameSync(tmpOut, out);
          } finally {
            fs.rm(src, () => {});
            fs.rm(tmpOut, () => {});
          }
        });
      }
      res.type('video/mp4').sendFile(out);
    } catch (e) {
      console.error('export file', e);
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
    }
  });

  return router;
};
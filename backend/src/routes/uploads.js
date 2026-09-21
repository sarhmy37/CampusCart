const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { uploadToSanity } = require('../utils/sanity');

const router = express.Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5MB
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;  // 20MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_VIDEO_BYTES },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            return cb(null, true);
        }
        cb(new Error('Only image or video files are allowed'));
    },
});

// POST /api/uploads — one file in the "file" field, returns { url }
router.post('/', requireAuth, (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
            return res.status(400).json({ error: message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file received' });
        }
        if (req.file.mimetype.startsWith('image/') && req.file.size > MAX_IMAGE_BYTES) {
            return res.status(400).json({ error: 'Images must be under 5MB' });
        }

        try {
            const url = await uploadToSanity(req.file);
            res.json({ url });
        } catch (uploadErr) {
            console.error('Sanity upload error:', uploadErr);
            res.status(500).json({ error: 'Upload failed. Please try again.' });
        }
    });
});

module.exports = router;
const { createClient } = require('@sanity/client');

const client = createClient({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_TOKEN,
    useCdn: false,
});

// Takes a multer file, returns the public Sanity URL.
async function uploadToSanity(file) {
    const type = file.mimetype.startsWith('image/') ? 'image' : 'file';
    const doc = await client.assets.upload(type, file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
    });
    return doc.url;
}

module.exports = { uploadToSanity };
const CLOUD_NAME = 'b7fch4rp';
const UPLOAD_PRESET = 'chat_uploads'; // must exist as an UNSIGNED preset in your Cloudinary dashboard

// resourceType: 'image' for photos, 'video' for audio/voice notes
// (Cloudinary files audio under its "video" resource type — this isn't a typo)
export async function uploadToCloudinary(file, resourceType = 'image') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');
    return res.json(); // { secure_url, ... }
}
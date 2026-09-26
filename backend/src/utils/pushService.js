// Sends a push notification via Expo's push notification service.
// No extra package needed — Expo's push API is a plain HTTPS endpoint.
async function sendPushNotification(pushToken, title, body, data = {}) {
    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        return; // not a valid Expo push token — nothing to send
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const result = await response.json();
        if (result?.data?.status === 'error') {
            console.error('Push send error:', result.data.message, result.data.details);
        }
    } catch (err) {
        console.error('Push notification request failed:', err);
    }
}

module.exports = { sendPushNotification };
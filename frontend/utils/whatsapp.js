export function formatWhatsAppNumber(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '233' + digits.slice(1);
    return digits;
}

export function buildOrderMessage(sellerName, items, buyerLocation, deliveryMethod) {
    const lines = [
        `Hi ${sellerName || ''}, I'd like to order the following from CampusCart:`,
        '',
        ...items.map(
            (i) => `• ${i.title} — Qty: ${i.quantity} — GHS ${(parseFloat(i.price) * i.quantity).toFixed(2)}`
        ),
        '',
        `Subtotal: GHS ${items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2)}`,
        '',
        deliveryMethod === 'delivery'
            ? `Delivery location: ${buyerLocation || 'Not set — please ask'}`
            : `I'll meet you on campus to pick this up.`,
        '',
        'Is this still available?',
    ];
    return lines.join('\n');
}

export function groupItemsBySeller(items) {
    return items.reduce((groups, item) => {
        const key = item.seller_whatsapp || item.seller_name || 'unknown';
        if (!groups[key]) {
            groups[key] = { sellerName: item.seller_name, whatsapp: item.seller_whatsapp, items: [] };
        }
        groups[key].items.push(item);
        return groups;
    }, {});
}

export function openWhatsAppChats(items, buyerLocation, deliveryMethod) {
    const groups = groupItemsBySeller(items);
    Object.values(groups).forEach((group) => {
        const number = formatWhatsAppNumber(group.whatsapp);
        if (!number) return;
        const message = buildOrderMessage(group.sellerName, group.items, buyerLocation, deliveryMethod);
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
    });
}
import { Linking } from 'react-native';

export function formatWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '233' + digits.slice(1);
  return digits;
}

export function buildOrderMessage(
  sellerName: string | null | undefined,
  items: any[],
  buyerLocation: string | null | undefined,
  deliveryMethod: 'delivery' | 'pickup'
) 
{
  const lines = [
    `Hello ${sellerName || 'there'} 👋`,
    '',
    `I found the following on Tre-X and I'd love to place an order:`,
    '',
    ...items.map(
      (i) => `🛍️ ${i.title} × ${i.quantity} — GHS ${(parseFloat(i.price) * i.quantity).toFixed(2)}`
    ),
    '',
    `💰 Total: GHS ${items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0).toFixed(2)}`,
    '',
    deliveryMethod === 'delivery'
      ? `📍 Delivery to: ${buyerLocation || 'Not set yet, kindly confirm with me'}`
      : `🤝 I'll pick it up on campus, kindly let me know a convenient meeting point.`,
    '',
    'Please confirm if this is still available. Thank you!',
  ];
  return lines.join('\n');
}

export function groupItemsBySeller(items: any[]) {
  return items.reduce((groups: Record<string, any>, item) => {
    const key = item.seller_whatsapp || item.seller_name || 'unknown';
    if (!groups[key]) {
      groups[key] = { sellerName: item.seller_name, whatsapp: item.seller_whatsapp, items: [] };
    }
    groups[key].items.push(item);
    return groups;
  }, {});
}

export async function openWhatsAppChats(
  items: any[],
  buyerLocation: string | null | undefined,
  deliveryMethod: 'delivery' | 'pickup'
) {
  const groups = groupItemsBySeller(items);
  for (const group of Object.values(groups) as any[]) {
    const number = formatWhatsAppNumber(group.whatsapp);
    if (!number) continue;
    const message = buildOrderMessage(group.sellerName, group.items, buyerLocation, deliveryMethod);
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      // ignore per-seller open failures
    }
  }
}
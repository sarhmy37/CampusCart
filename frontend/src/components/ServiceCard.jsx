import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MapPin, Star, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

function parseAvailability(raw: any) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null; // old plain-text duration values (e.g. "2hrs")
  }
}

function formatTime12(time24?: string) {
  if (!time24 || typeof time24 !== 'string') return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return '';
  const period = h < 12 ? 'AM' : 'PM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${mStr} ${period}`;
}

export default function ServiceCard({ service }: { service: any }) {
  const colors = useColors();
  const router = useRouter();

  const hasRating = service.rating && parseFloat(service.rating) > 0;

  const durationLabel = useMemo(() => {
    const availability = parseAvailability(service.service_duration);
    const legacyDuration = !availability ? service.service_duration : null;
    const hasScheduledHours = !!(
      availability && !availability.is_24_7 &&
      Array.isArray(availability.days) && availability.days.length > 0
    );
    if (availability) {
      if (availability.is_24_7) return 'Open 24/7';
      if (hasScheduledHours) {
        const d = availability.days[0];
        const extra = availability.days.length > 1 ? ` +${availability.days.length - 1}` : '';
        return `${d.day} ${formatTime12(d.open)}–${formatTime12(d.close)}${extra}`;
      }
      return null;
    }
    return legacyDuration;
  }, [service.service_duration]);

  const isPlanActive = service.seller_plan && service.seller_plan !== 'free' &&
    service.seller_plan_expires_at && new Date(service.seller_plan_expires_at) > new Date();
  const planTier = isPlanActive ? service.seller_plan.toLowerCase() : null;

  return (
    <Pressable
      onPress={() => router.push(`/service/${service.id}`)}
      style={{
        width: '100%',
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {/* IMAGE (4:3 like web) */}
      <View style={{ aspectRatio: 4 / 3, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
        {service.primary_image ? (
          <Image
            source={{ uri: service.primary_image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} color={colors.textFaint} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />
      </View>

      {/* BODY */}
      <View style={{ padding: 8 }}>
        {/* Title + badges */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.text, lineHeight: 14 }}
          >
            {service.title || service.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 }}>
            {planTier === 'premium' && <Sparkles size={10} color="#a855f7" />}
            {planTier === 'pro' && <Star size={10} color="#3b82f6" fill="#3b82f6" />}
            {service.seller_verified && <ShieldCheck size={10} color="#10b981" />}
          </View>
        </View>

        {!!service.description && (
          <Text numberOfLines={2} style={{ fontSize: 100, color: colors.textFaint, marginTop: 2, lineHeight: 12 }}>
            {service.description}
          </Text>
        )}

        {/* Rating + location */}
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderMuted, gap: 3 }}>
          {hasRating && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={9} color="#f59e0b" fill="#f59e0b" />
              <Text style={{ fontSize: 100, fontWeight: '600', color: colors.textSecondary }}>
                {parseFloat(service.rating).toFixed(1)}
              </Text>
              {service.review_count > 0 && (
                <Text style={{ fontSize: 100, color: colors.textFaint }}>({service.review_count})</Text>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
            <MapPin size={9} color={colors.textFaint} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 100, color: colors.textMuted }}>
                {service.seller_school || 'Location not specified'}
              </Text>
              {!!service.seller_meeting_place && (
                <Text numberOfLines={1} style={{ fontSize: 100, color: colors.textFaint, marginTop: 1 }}>
                  {service.seller_meeting_place}
                </Text>
              )}
            </View>
          </View>

          {!!durationLabel && (
            <Text numberOfLines={1} style={{ fontSize: 100, color: colors.textFaint }}>
              {durationLabel}
            </Text>
          )}
        </View>

        {/* CTA */}
        <View
          style={{
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            paddingVertical: 7,
            borderRadius: 8,
            backgroundColor: colors.brand,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textOnGold }}>Book now</Text>
          <ArrowRight size={10} color={colors.textOnGold} />
        </View>
      </View>
    </Pressable>
  );
}
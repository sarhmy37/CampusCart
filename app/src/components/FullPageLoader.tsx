// ─────────────────────────────────────────────────────────────────────────
// FullPageLoader (React Native)
//
// Single shared full-screen loading gate used across every page. Pass a
// `screen` name and it renders that screen's skeleton shape while data +
// assets are still loading (via usePageReady). The error state is the same
// for every screen — only the loading skeleton differs.
//
// To wire up a new page:
//   1. Add a `<ScreenName>Skeleton` function below, shaped like that page.
//   2. Add one line to the SKELETONS map at the bottom of this file.
//   3. Render <FullPageLoader screen="screenName" status={...} onRetry={...} />
// ─────────────────────────────────────────────────────────────────────────

import { View, Text, Pressable, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';

function DashboardSkeleton({ colors }: { colors: any }) {
  return (
    <View>
      {/* Header (video) area */}
      <View style={{ height: 256, backgroundColor: colors.cardAlt }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, gap: 12 }}>
        {/* Tab pills */}
        <View style={{ height: 40, backgroundColor: colors.cardAlt, borderRadius: 12, alignSelf: 'center', width: '80%' }} />
        {/* Content rows */}
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ height: 64, backgroundColor: colors.cardAlt, borderRadius: 16 }} />
        ))}
      </View>
    </View>
  );
}

function BrowseSkeleton({ colors }: { colors: any }) {
  return (
    <View>
      {/* Header (photo/slideshow) area */}
      <View style={{ height: 160, backgroundColor: colors.cardAlt }} />
      <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
        {/* Filter bar */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ height: 32, width: 96, backgroundColor: colors.cardAlt, borderRadius: 999 }} />
          ))}
        </View>
        {/* Product grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={{ width: '31%', aspectRatio: 0.75, borderRadius: 16, backgroundColor: colors.cardAlt }} />
          ))}
        </View>
      </View>
    </View>
  );
}

function ProductDetailSkeleton({ colors }: { colors: any }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 16 }}>
      <View style={{ aspectRatio: 1, backgroundColor: colors.cardAlt, borderRadius: 16 }} />
      <View style={{ height: 24, width: '66%', backgroundColor: colors.cardAlt, borderRadius: 8 }} />
      <View style={{ height: 16, width: '33%', backgroundColor: colors.cardAlt, borderRadius: 8 }} />
      <View style={{ height: 96, backgroundColor: colors.cardAlt, borderRadius: 16 }} />
    </View>
  );
}

function StoreSkeleton({ colors }: { colors: any }) {
  return (
    <View>
      <View style={{ height: 160, backgroundColor: colors.cardAlt }} />
      <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View key={i} style={{ width: '31%', aspectRatio: 0.75, borderRadius: 16, backgroundColor: colors.cardAlt }} />
          ))}
        </View>
      </View>
    </View>
  );
}

function CartSkeleton({ colors }: { colors: any }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 96, backgroundColor: colors.cardAlt, borderRadius: 16 }} />
      ))}
    </View>
  );
}

// Fallback for any screen that hasn't been given a dedicated skeleton yet.
function GenericSkeleton({ colors }: { colors: any }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 40, gap: 12 }}>
      <View style={{ height: 160, backgroundColor: colors.cardAlt, borderRadius: 16 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 64, backgroundColor: colors.cardAlt, borderRadius: 16 }} />
      ))}
    </View>
  );
}

const SKELETONS: Record<string, any> = {
  dashboard: DashboardSkeleton,
  browse: BrowseSkeleton,
  productDetail: ProductDetailSkeleton,
  store: StoreSkeleton,
  cart: CartSkeleton,
};

export default function FullPageLoader({
  screen,
  status = 'loading',
  onRetry,
}: {
  screen?: string;
  status?: 'loading' | 'ready' | 'error';
  onRetry?: () => void;
}) {
  const colors = useColors();

  if (status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 14, color: colors.textFaint, marginBottom: 16, textAlign: 'center' }}>
          Couldn't load this page right now.
        </Text>
        <Pressable
          onPress={onRetry}
          style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand }}
        >
          <Text style={{ color: colors.textOnGold, fontWeight: '700', fontSize: 14 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const Skeleton = SKELETONS[screen || ''] || GenericSkeleton;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <Skeleton colors={colors} />
      </ScrollView>
    </View>
  );
}
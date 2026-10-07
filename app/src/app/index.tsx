import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import Hero from '@/components/Hero';
import ValueStrip from '@/components/ValueStrip';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import HomeFooter from '@/components/HomeFooter';
import ExclusiveOffers from '@/components/ExclusiveOffers';
import HomePlans from '@/components/HomePlans';
import { LinearGradient } from 'expo-linear-gradient';

function InsetShadow({ direction }: { direction: 'down' | 'up' }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Gold glow: stronger in dark mode, softer in light mode
  const dark = isDark ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.14)';
  const clear = 'rgba(245,158,11,0)';

  return (
    <View pointerEvents="none">
      {/* faint light edge on dark theme so the depth is visible against near-black */}
      {direction === 'down' && (
        <View style={{ height: 1, backgroundColor: 'rgba(245,158,11,0.25)' }} />
      )}
      <LinearGradient
        colors={direction === 'down' ? [dark, 'rgba(245,158,11,0.06)', clear] : [clear, 'rgba(245,158,11,0.06)', dark]}
        style={{ height: 28, width: '100%' }}
      />
      {direction === 'up' && (
        <View style={{ height: 1, backgroundColor: 'rgba(245,158,11,0.25)' }} />
      )}
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const [scrolled, setScrolled] = useState(false);
  const [hasOffers, setHasOffers] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e: any) => {
          if (!scrolled && e.nativeEvent.contentOffset.y > 24) setScrolled(true);
        }}
      >
        <Hero />
        <ValueStrip />
        {hasOffers && <InsetShadow direction="down" />}
        <View style={{ paddingBottom: hasOffers ? 16 : 0 }}>
          <ExclusiveOffers active={scrolled} onHasOffers={setHasOffers} />
        </View>
        {hasOffers && <InsetShadow direction="up" />}
        {hasOffers && <View style={{ height: 1, backgroundColor: colors.border }} />}
        <HomePlans />
        <HomeFooter />
      </ScrollView>
    </View>
  );
}
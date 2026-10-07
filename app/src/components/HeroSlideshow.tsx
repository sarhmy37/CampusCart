import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const EPOCH = 0;

function computeIndex(length: number, interval: number) {
  if (length <= 0) return 0;
  return Math.floor((Date.now() - EPOCH) / interval) % length;
}

export default function HeroSlideshow({
  images,
  interval = 5000,
}: {
  images: (string | number)[];
  interval?: number;
}) {
  const [index, setIndex] = useState(() => computeIndex(images.length, interval));
  const opacities = useRef(images.map((_, i) => new Animated.Value(i === index ? 1 : 0))).current;

  useEffect(() => {
    if (images.length <= 1) return;

    const msIntoCurrentSlide = (Date.now() - EPOCH) % interval;
    const msUntilNextSlide = interval - msIntoCurrentSlide;
    let innerTimer: any = null;

    const alignTimeout = setTimeout(() => {
      setIndex(computeIndex(images.length, interval));
      innerTimer = setInterval(() => {
        setIndex(computeIndex(images.length, interval));
      }, interval);
    }, msUntilNextSlide);

    return () => {
      clearTimeout(alignTimeout);
      if (innerTimer) clearInterval(innerTimer);
    };
  }, [images.length, interval]);

  useEffect(() => {
    opacities.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === index ? 1 : 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    });
  }, [index]);

  return (
    <>
      {images.map((src, i) => (
        <Animated.View
          key={String(src)}
          style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}
        >
          <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        </Animated.View>
      ))}
    </>
  );
}
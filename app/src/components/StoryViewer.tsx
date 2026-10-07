import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import {
  View, Text, Pressable, Dimensions, ActivityIndicator, Animated, Easing,
  PanResponder, TextInput, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Send, Sparkles, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView);

// ─── STORY GROUP PREVIEW (shown only mid-swipe transition) ────────────
function StoryGroupPreview({ group }: { group?: any }) {
  if (!group) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  const cover = group.stories[0]; // matches goToStory(idx, 0) landing on the first story
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {cover.media_type === 'video' ? (
        <View style={{ flex: 1, backgroundColor: '#000' }} />
      ) : (
        <Image source={{ uri: cover.media_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      )}
    </View>
  );
}

// ─── FULL-SCREEN VIEWER ──────────────────────────────────────────────
export default function StoryViewer({
  group, story, durationMs, mediaReady, isOwnStory, onMediaReady, onClose, onBack, onNext,
  onSwipeNextGroup, onSwipePrevGroup, prevGroup, nextGroup, onReply, onQuickReact, notice,
}: any) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 1800);
  };
  useEffect(() => {
    if (notice) showToast(notice.text);
  }, [notice?.id]);

  const handleQuickReact = async (emoji: string) => {
    const ok = await onQuickReact(emoji);
    showToast(ok ? `Sent ${emoji}` : "Couldn't send");
  };
  const [barRowWidth, setBarRowWidth] = useState(0);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<TextInput>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates.height));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);
  const currentIndex = group.stories.indexOf(story);
  const BAR_GAP = 4;
  const barWidth = barRowWidth > 0
    ? (barRowWidth - BAR_GAP * (group.stories.length - 1)) / group.stories.length
    : 0;

  // One persistent Animated.Value per story — every bar is driven off its
  // own value, so switching which index is "current" never inherits a
  // stale in-flight number from a different bar.
  const barAnims = useMemo(
    () => group.stories.map(() => new Animated.Value(0)),
    [group.user_id]
  );
  const currentAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const advanceTimerRef = useRef<any>(null);
  // Guards against onNext firing more than once for the same story.
  const advancedRef = useRef(false);
  const advanceOnce = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onNext();
  };

  // useLayoutEffect (not useEffect) so the reset happens before paint —
  // no one-frame flash of a stale fill amount.
  useLayoutEffect(() => {
    currentAnimRef.current?.stop();
    advancedRef.current = false;
    setReplyText('');

    barAnims.forEach((val: Animated.Value, i: number) => {
      if (i < currentIndex) val.setValue(1);
      else if (i > currentIndex) val.setValue(0);
    });

    const current = barAnims[currentIndex];
    if (!current) return;
    current.setValue(0);
    if (!mediaReady) return;

    currentAnimRef.current = Animated.timing(current, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    currentAnimRef.current.start();
    clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(advanceOnce, durationMs);

    return () => {
      currentAnimRef.current?.stop();
      clearTimeout(advanceTimerRef.current);
    };
  }, [currentIndex, mediaReady, group.user_id]);

  // ── Swipe-down-to-dismiss / swipe left-right to switch story groups ──
  const DISMISS_THRESHOLD = 120;
  const HORIZONTAL_SWIPE_THRESHOLD = 60;
  const gestureAxisRef = useRef<'vertical' | 'horizontal' | 'up' | null>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const HORIZONTAL_TRANSITION_MS = 320;
  const CIRCLE_SIZE = SCREEN_WIDTH * 0.45;
  const dragOpacity = translateY.interpolate({
    inputRange: [0, 300, SCREEN_HEIGHT],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });
  const maskWidth = translateY.interpolate({
    inputRange: [0, 300],
    outputRange: [SCREEN_WIDTH, CIRCLE_SIZE],
    extrapolate: 'clamp',
  });
  const maskHeight = translateY.interpolate({
    inputRange: [0, 300],
    outputRange: [SCREEN_HEIGHT, CIRCLE_SIZE],
    extrapolate: 'clamp',
  });
  const maskRadius = translateY.interpolate({
    inputRange: [0, 300],
    outputRange: [0, CIRCLE_SIZE / 2],
    extrapolate: 'clamp',
  });

  const HALF = SCREEN_WIDTH / 2;
  const SQ_W = SCREEN_WIDTH * 0.88;
  const SQ_H = SCREEN_HEIGHT * 0.88;
  const SQ_R = 32;
  // current story: full screen -> rounded square
  const curW = translateX.interpolate({ inputRange: [-HALF, 0, HALF], outputRange: [SQ_W, SCREEN_WIDTH, SQ_W], extrapolate: 'clamp' });
  const curH = translateX.interpolate({ inputRange: [-HALF, 0, HALF], outputRange: [SQ_H, SCREEN_HEIGHT, SQ_H], extrapolate: 'clamp' });
  const curR = translateX.interpolate({ inputRange: [-HALF, 0, HALF], outputRange: [SQ_R, 0, SQ_R], extrapolate: 'clamp' });
  const curOpacity = translateX.interpolate({ inputRange: [-HALF, -HALF * 0.85, 0, HALF * 0.85, HALF], outputRange: [0, 1, 1, 1, 0], extrapolate: 'clamp' });
  // incoming story: rounded square -> full screen
  const nextW = translateX.interpolate({ inputRange: [-SCREEN_WIDTH, -HALF], outputRange: [SCREEN_WIDTH, SQ_W], extrapolate: 'clamp' });
  const nextH = translateX.interpolate({ inputRange: [-SCREEN_WIDTH, -HALF], outputRange: [SCREEN_HEIGHT, SQ_H], extrapolate: 'clamp' });
  const nextR = translateX.interpolate({ inputRange: [-SCREEN_WIDTH, -HALF], outputRange: [0, SQ_R], extrapolate: 'clamp' });
  const nextOpacity = translateX.interpolate({ inputRange: [-HALF, -HALF * 0.85], outputRange: [1, 0], extrapolate: 'clamp' });
  const prevW = translateX.interpolate({ inputRange: [HALF, SCREEN_WIDTH], outputRange: [SQ_W, SCREEN_WIDTH], extrapolate: 'clamp' });
  const prevH = translateX.interpolate({ inputRange: [HALF, SCREEN_WIDTH], outputRange: [SQ_H, SCREEN_HEIGHT], extrapolate: 'clamp' });
  const prevR = translateX.interpolate({ inputRange: [HALF, SCREEN_WIDTH], outputRange: [SQ_R, 0], extrapolate: 'clamp' });
  const prevOpacity = translateX.interpolate({ inputRange: [HALF * 0.85, HALF], outputRange: [0, 1], extrapolate: 'clamp' });
  useLayoutEffect(() => {
    translateX.setValue(0);
  }, [group.user_id]);

  // Resumes the current bar's countdown for whatever time is left,
  // rather than restarting it from zero, after a cancelled swipe.
  const resumeCurrentBar = () => {
    const current = barAnims[currentIndex];
    if (!current || !mediaReady || barPausedRef.current) return;
    current.stopAnimation((value: number) => {
      const remaining = Math.max(0, (1 - value) * durationMs);
      if (remaining <= 0) {
        advanceOnce();
        return;
      }
      currentAnimRef.current = Animated.timing(current, {
        toValue: 1,
        duration: remaining,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      currentAnimRef.current.start();
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(advanceOnce, remaining);
    });
  };

  // Fresh closure every render (no useRef wrapper) so nextGroup/prevGroup/
  // currentIndex/mediaReady inside these handlers are never stale after
  // the first swipe.
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, gesture) => {
      const absDx = Math.abs(gesture.dx);
      const absDy = Math.abs(gesture.dy);
      if (absDx < 10 && absDy < 10) return false;
      if (gesture.dy > 8 && absDy > absDx * 1.5) {
        gestureAxisRef.current = 'vertical';
        return true;
      }
      if (gesture.dy < -8 && absDy > absDx * 1.5) {
        gestureAxisRef.current = 'up';
        return true;
      }
      if (absDx > 12 && absDx > absDy * 1.5) {
        gestureAxisRef.current = 'horizontal';
        return true;
      }
      return false;
    },
    onPanResponderGrant: () => {
      currentAnimRef.current?.stop();
      clearTimeout(advanceTimerRef.current);
      heldRef.current = true;
    },
    onPanResponderMove: (_e, gesture) => {
      if (gestureAxisRef.current === 'vertical' && gesture.dy > 0) {
        translateY.setValue(gesture.dy);
      } else if (gestureAxisRef.current === 'horizontal') {
        const draggingToNext = gesture.dx < 0;
        const blocked = (draggingToNext && !nextGroup) || (!draggingToNext && !prevGroup);
        translateX.setValue(blocked ? gesture.dx / 3 : gesture.dx);
      }
    },
    onPanResponderRelease: (_e, gesture) => {
      if (gestureAxisRef.current === 'up') {
        gestureAxisRef.current = null;
        if (gesture.dy < -60 && replyInputRef.current) {
          replyInputRef.current.focus();
        } else {
          resumeCurrentBar();
        }
        return;
      }
      if (gestureAxisRef.current === 'horizontal') {
        const goingNext = gesture.dx <= -HORIZONTAL_SWIPE_THRESHOLD;
        const goingPrev = gesture.dx >= HORIZONTAL_SWIPE_THRESHOLD;

        if (goingNext && nextGroup) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: HORIZONTAL_TRANSITION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => onSwipeNextGroup());
        } else if (goingPrev && prevGroup) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: HORIZONTAL_TRANSITION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => onSwipePrevGroup());
        } else {
          if (goingNext || goingPrev) {
            // Threshold cleared but nothing that way — same "no more
            // stories" toast as before (handled in the parent), snap back.
            goingNext ? onSwipeNextGroup() : onSwipePrevGroup();
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 6,
          }).start(resumeCurrentBar);
        }
        gestureAxisRef.current = null;
        return;
      }

      if (gesture.dy > DISMISS_THRESHOLD) {
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 260,
          useNativeDriver: false,
        }).start(() => onClose());
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 6,
        }).start(resumeCurrentBar);
      }
      gestureAxisRef.current = null;
    },
    onPanResponderTerminate: () => {
      if (gestureAxisRef.current === 'up') {
        gestureAxisRef.current = null;
        resumeCurrentBar();
        return;
      }
      if (gestureAxisRef.current === 'horizontal') {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: false })
          .start(resumeCurrentBar);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false })
          .start(resumeCurrentBar);
      }
      gestureAxisRef.current = null;
    },
  });

  // ── Reply-to-story ──────────────────────────────────────────────────
  const handleReplyFocus = () => {
    setIsTyping(true);
    currentAnimRef.current?.stop();
    clearTimeout(advanceTimerRef.current);
  };

  const handleReplyBlur = () => {
    setIsTyping(false);
    resumeCurrentBar();
  };

  const handleSendReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setReplyText('');
    replyInputRef.current?.clear();
    Keyboard.dismiss();
    const ok = await onQuickReact(trimmed);
    if (!ok) setReplyText(trimmed);
    showToast(ok ? 'Sent' : "Couldn't send");
  };

  // ── Hold-to-pause ────────────────────────────────────────────────────
  // A quick tap navigates (back/next); holding past HOLD_THRESHOLD_MS just
  // pauses the timer without navigating, and releasing resumes it.
  const HOLD_THRESHOLD_MS = 200;
  const pressStartRef = useRef(0);
  const heldRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);

  const handlePressIn = () => {
    pressStartRef.current = Date.now();
    heldRef.current = false;
    currentAnimRef.current?.stop();
    clearTimeout(advanceTimerRef.current);
  };

  const handlePressOutSide = (side: 'back' | 'next') => {
    if (isTyping || keyboardHeight > 0) {
      setIsPaused(false);
      Keyboard.dismiss();
      return;
    }
    const heldMs = Date.now() - pressStartRef.current;
    if (heldMs < HOLD_THRESHOLD_MS && !heldRef.current) {
      setIsPaused(false);
      side === 'back' ? onBack() : onNext();
    } else {
      setIsPaused(false);
      resumeCurrentBar();
    }
  };

  const holdTimerRef = useRef<any>(null);
  const startHoldWatch = () => {
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      heldRef.current = true;
      setIsPaused(true);
    }, HOLD_THRESHOLD_MS);
  };

  const barPaused = isPaused || isTyping;
  const barPausedRef = useRef(false);
  barPausedRef.current = barPaused;
  const firstPauseRun = useRef(true);
  useEffect(() => {
    if (firstPauseRun.current) {
      firstPauseRun.current = false;
      return;
    }
    if (barPaused) {
      currentAnimRef.current?.stop();
      clearTimeout(advanceTimerRef.current);
      barAnims[currentIndex]?.stopAnimation();
    } else {
      resumeCurrentBar();
    }
  }, [barPaused]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          width: maskWidth,
          height: maskHeight,
          borderRadius: maskRadius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          opacity: dragOpacity,
          transform: [{ translateY }],
        }}
      >
        <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View
              style={{
                position: 'absolute', width: prevW, height: prevH, borderRadius: prevR,
                opacity: prevOpacity, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                <StoryGroupPreview group={prevGroup} />
              </View>
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute', width: nextW, height: nextH, borderRadius: nextR,
                opacity: nextOpacity, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                <StoryGroupPreview group={nextGroup} />
              </View>
            </Animated.View>
          </View>

          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                width: curW, height: curH, borderRadius: curR, opacity: curOpacity,
                overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <AnimatedKeyboardAvoidingView
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, paddingBottom: keyboardHeight }}
              >
                {/* Media area — flex:1 so it stops above the reply bar instead of
                    running full-screen underneath it */}
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                  {story.media_type === 'video' ? (
                    <StoryVideoPlayer
  key={story.id}
  uri={story.media_url}
  onReady={onMediaReady}
  paused={isPaused || isTyping}
  trimStartMs={story.trim_start_ms}
  trimEndMs={story.trim_end_ms}
  crop={story.crop}
/>
                  ) : (
                    <Image
                      key={story.id}
                      source={{ uri: story.media_url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      onLoad={() => onMediaReady()}
                    />
                  )}

                  {!mediaReady && (
                    <View
                      style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ActivityIndicator color="#fff" size="large" />
                    </View>
                  )}

                  <View
                    onLayout={(e) => setBarRowWidth(e.nativeEvent.layout.width)}
                    style={{
                      position: 'absolute',
                      top: insets.top + 10,
                      left: 10, right: 10,
                      flexDirection: 'row',
                      gap: BAR_GAP,
                      opacity: isPaused ? 0 : 1,
                    }}
                  >
                    {group.stories.map((_: any, i: number) => (
                      <View
                        key={i}
                        style={{
                          flex: 1, height: isScrubbing && i === currentIndex ? 8 : 3, borderRadius: 4,
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          overflow: 'hidden',
                        }}
                      >
                        {barWidth > 0 && (
                          <Animated.View
                            style={{
                              width: barWidth,
                              height: '100%',
                              backgroundColor: '#fff',
                              borderRadius: 2,
                              transform: [{
                                translateX: barAnims[i].interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-barWidth, 0],
                                  extrapolate: 'clamp',
                                }),
                              }],
                            }}
                          />
                        )}
                      </View>
                    ))}
                  </View>

                  <View
                    style={{
                      position: 'absolute',
                      top: insets.top + 24,
                      left: 16, right: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: isPaused ? 0 : 1,
                    }}
                  >
                    <LinearGradient
                      colors={['#f59e0b', '#ef4444', '#a855f7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 36, height: 36, borderRadius: 18, padding: 2 }}
                    >
                      <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
                        {group.user_avatar && (
                          <Image source={{ uri: group.user_avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        )}
                      </View>
                    </LinearGradient>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '800', color: '#fff' }}>
                          {group.user_name}
                        </Text>
                        <PlanBadge plan={group.user_plan} size={13} />
                      </View>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                        {relativeTime(story.created_at)} ago
                      </Text>
                    </View>
                    <Pressable onPress={onClose} style={{ padding: 6 }}>
                      <X size={22} color="#fff" />
                    </Pressable>
                  </View>

                  <Pressable
                    onPressIn={() => { handlePressIn(); startHoldWatch(); }}
                    onPressOut={() => { clearTimeout(holdTimerRef.current); handlePressOutSide('back'); }}
                    style={{
                      position: 'absolute',
                      top: insets.top + 70, bottom: 0,
                      left: 0, width: SCREEN_WIDTH * 0.5,
                    }}
                  />
                  <Pressable
                    onPressIn={() => { handlePressIn(); startHoldWatch(); }}
                    onPressOut={() => { clearTimeout(holdTimerRef.current); handlePressOutSide('next'); }}
                    style={{
                      position: 'absolute',
                      top: insets.top + 70, bottom: 0,
                      right: 0, width: SCREEN_WIDTH * 0.5,
                    }}
                  />

                  {story.caption && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: insets.top + 80,
                        bottom: isOwnStory ? insets.bottom + 20 : 16,
                        left: 24, right: 24,
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: getCaptionFontSize(story.caption),
                          lineHeight: getCaptionFontSize(story.caption) * 1.3,
                          fontWeight: '700',
                          color: '#fff',
                          textAlign: 'center',
                          textShadowColor: 'rgba(0,0,0,0.75)',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 6,
                        }}
                      >
                        {story.caption}
                      </Text>
                    </View>
                  )}
                </View>

                {toastMsg && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: insets.top + 70,
                      left: 0, right: 0,
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        borderWidth: 1,
                        borderColor: colors.brand,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{toastMsg}</Text>
                    </View>
                  </View>
                )}

                {/* Reply bar — a real, solid-background footer, not an overlay */}
                        {/* Divider between caption and reply bar */}
        {!isOwnStory && (
          <View
            style={{
              height: 2,
              backgroundColor: colors.border,
              marginHorizontal: 16,
              marginTop: 10,
              marginBottom: 6,
              borderRadius: 1,
            }}
          />
        )}

        {/* Reply bar — a real, solid-background footer, not an overlay */}
        {!isOwnStory && (
                  <View
                    style={{
                      backgroundColor: '#000',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: 14,
                      paddingTop: 8,
                      paddingBottom: keyboardHeight > 0 ? 10 : insets.bottom + 10,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        height: 38,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: 19,
                        borderWidth: 1.5,
                        borderColor: colors.brand,
                        paddingHorizontal: 18,
                      }}
                    >
                      <TextInput
                        ref={replyInputRef}
                        value={replyText}
                        onChangeText={setReplyText}
                        onFocus={handleReplyFocus}
                        onBlur={handleReplyBlur}
                        placeholder={`Send message to ${group.user_name.split(' ')[0]}...`}
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        style={{ flex: 1, color: '#fff', fontSize: 14 }}
                        returnKeyType="send"
                        onSubmitEditing={handleSendReply}
                        blurOnSubmit={false}
                      />
                      {!replyText.trim() && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                          {['❤️', '😂', '🔥', '👏'].map((emoji) => (
                            <EmojiReact key={emoji} emoji={emoji} onSend={handleQuickReact} />
                          ))}
                        </View>
                      )}
                    </View>

                    <Pressable
                      onPress={handleSendReply}
                      disabled={!replyText.trim()}
                      style={{
                        width: 38, height: 38, borderRadius: 19,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: replyText.trim() ? colors.brand : 'rgba(255,255,255,0.14)',
                      }}
                    >
                      <Send size={18} color={replyText.trim() ? colors.textOnGold : 'rgba(255,255,255,0.5)'} />
                    </Pressable>
                  </View>
                )}
              </AnimatedKeyboardAvoidingView>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function EmojiReact({ emoji, onSend }: { emoji: string; onSend: (e: string) => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.7, speed: 40, bounciness: 14, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 10, useNativeDriver: true }),
    ]).start();
    onSend(emoji);
  };
  return (
    <Pressable onPress={bounce} hitSlop={6}>
      <Animated.Text style={{ fontSize: 17, transform: [{ scale }] }}>{emoji}</Animated.Text>
    </Pressable>
  );
}

function PlanBadge({ plan, size = 12 }: { plan?: string | null; size?: number }) {
  if (plan === 'premium') return <Sparkles size={size} color="#a855f7" fill="#a855f7" />;
  if (plan === 'pro') return <Star size={size} color="#3b82f6" fill="#3b82f6" />;
  return null;
}

function getCaptionFontSize(text: string) {
  const len = text.trim().length;
  if (len <= 40) return 20;
  if (len <= 80) return 18;
  if (len <= 140) return 16;
  if (len <= 220) return 15;
  return 14;
}

// ─── UTIL ────────────────────────────────────────────────────────────
function relativeTime(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function StoryVideoPlayer({
  uri, onReady, paused, trimStartMs, trimEndMs, crop, seekRef,
}: {
  seekRef?: React.MutableRefObject<((f: number) => void) | null>;
  uri: string; onReady: (durationMs?: number) => void; paused: boolean;
  trimStartMs?: number | null; trimEndMs?: number | null;
  crop?: VideoCropT | null;
}) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = false; // duration is capped/advanced manually now
  });
  const readyRef = useRef(false);
  const durRef = useRef(0);

  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (f: number) => {
      const startS = (trimStartMs ?? 0) / 1000;
      const spanS = Math.min(durRef.current, MAX_VIDEO_DURATION_MS) / 1000;
      player.currentTime = startS + f * spanS;
    };
    return () => { seekRef.current = null; };
  }, [player, trimStartMs]);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }: { status: string }) => {
      if (status === 'readyToPlay' && !readyRef.current) {
        readyRef.current = true;
        const fullMs = player.duration ? player.duration * 1000 : undefined;
        const hasTrim = trimStartMs != null && trimEndMs != null && trimEndMs > trimStartMs;
        if (hasTrim) player.currentTime = trimStartMs! / 1000;
        if (!paused) player.play();
        const durationMs = hasTrim
          ? Math.min(trimEndMs!, fullMs ?? trimEndMs!) - trimStartMs!
          : fullMs;
        durRef.current = durationMs ?? 0;
        onReady(durationMs);
      }
    });
    return () => sub.remove();
  }, [player]);

  // Drives actual playback from the hold state — separate from the
  // ready-detection effect above so toggling paused never re-triggers onReady.
  useEffect(() => {
    if (!readyRef.current) return;
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  return <CroppedVideoView player={player} crop={crop} />;
}

type VideoCropT = { x: number; y: number; w: number; h: number; fa?: number | null };

// Shows only the cropped part of a video, filling the box
function CroppedVideoView({ player, crop }: { player: any; crop?: VideoCropT | null }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (!crop || !crop.fa || crop.w <= 0 || crop.h <= 0) {
    return (
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
    );
  }
  const fa = crop.fa;
  const s = box.w > 0 ? Math.max(box.w / (crop.w * fa), box.h / crop.h) : 0;
  const FW = fa * s;
  const FH = s;
  return (
    <View
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {s > 0 && (
        <VideoView
          player={player}
          style={{
            position: 'absolute', width: FW, height: FH,
            left: -crop.x * FW + (box.w - crop.w * FW) / 2,
            top: -crop.y * FH + (box.h - crop.h * FH) / 2,
          }}
          contentFit="fill"
          nativeControls={false}
        />
      )}
    </View>
  );
}
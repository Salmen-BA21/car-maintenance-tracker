import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { AppText, Button, Card, ProgressBar, StatusPill } from '../ui/kit';
import { useTheme } from '../ui/theme';

const SLIDES = [
  {
    title: "Know what's due, at a glance",
    body: 'Every part has its own interval. See what is healthy and what needs attention the moment you open the app.',
  },
  {
    title: 'Update your mileage in seconds',
    body: 'Type your odometer now and then. We work out how much life each part has left.',
  },
  {
    title: 'Get a nudge before it is late',
    body: 'Turn on reminders and get notified when a service is coming up.',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { fontScale, height: windowHeight } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  // Leave room for larger text and shorter phones instead of clipping the poster.
  const posterHeight = Math.min(360, Math.max(220, (windowHeight * 0.38) / Math.min(fontScale, 1.4)));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 8, paddingHorizontal: 20, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 }}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={() => setIndex((value) => Math.max(0, value - 1))}
          style={{ alignItems: 'center', height: 44, justifyContent: 'center', opacity: index === 0 ? 0 : 1, width: 44 }}
        >
          <Feather color={theme.ink} name="chevron-left" size={24} />
        </Pressable>
        <Pressable
          accessibilityLabel="Skip onboarding"
          accessibilityRole="button"
          onPress={onDone}
          style={{ alignItems: 'center', height: 44, justifyContent: 'center', opacity: last ? 0 : 1, paddingHorizontal: 12 }}
        >
          <AppText color={theme.muted} style={{ fontFamily: theme.font.extrabold, fontSize: 15 }}>Skip</AppText>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 4 }}>
        <View
          style={{
            backgroundColor: theme.panelTint,
            borderRadius: 32,
            gap: 12,
            justifyContent: 'center',
            minHeight: posterHeight,
            overflow: 'hidden',
            padding: 22,
          }}
        >
          <View
            style={{
              backgroundColor: theme.mode === 'graphite' ? '#E8501F' : theme.accent,
              borderRadius: 85,
              height: 170,
              opacity: theme.mode === 'graphite' ? 0.22 : 0.1,
              position: 'absolute',
              right: -50,
              top: -50,
              width: 170,
            }}
          />
          {index === 0 ? (
            <>
              <Card style={{ gap: 10 }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Engine oil</AppText>
                  <StatusPill status="OK" />
                </View>
                <ProgressBar percent={86} />
              </Card>
              <Card style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Timing belt</AppText>
                  <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>No interval set</AppText>
                </View>
                <StatusPill status="SetInterval" />
              </Card>
              <Card style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Spark plugs</AppText>
                  <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>No service yet</AppText>
                </View>
                <StatusPill status="Unknown" />
              </Card>
            </>
          ) : null}

          {index === 1 ? (
            <>
              <Card style={{ gap: 14, padding: 20 }}>
                <AppText color={theme.muted} style={{ fontFamily: theme.font.bold, fontSize: 13 }}>Current odometer</AppText>
                <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 6 }}>
                  <AppText maxFontSizeMultiplier={1.2} style={{ fontFamily: theme.font.number, fontSize: 42, letterSpacing: -1 }}>345,000</AppText>
                  <AppText color={theme.muted} style={{ fontFamily: theme.font.bold, fontSize: 16 }}>km</AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['+100', '+500', '+1,000'].map((chip) => (
                    <View key={chip} style={{ alignItems: 'center', borderColor: theme.border, borderRadius: theme.radius.button, borderWidth: 1.5, height: 36, justifyContent: 'center', paddingHorizontal: 12 }}>
                      <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontFamily: theme.font.extrabold, fontSize: 14 }}>{chip}</AppText>
                    </View>
                  ))}
                </View>
              </Card>
              <View style={{ alignItems: 'center', backgroundColor: theme.accent, borderRadius: theme.radius.button, height: 48, justifyContent: 'center' }}>
                <AppText style={{ color: theme.onAccent, fontFamily: theme.font.extrabold, fontSize: 16 }}>Save</AppText>
              </View>
            </>
          ) : null}

          {index === 2 ? (
            <>
              <Card style={{ alignItems: 'center', flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'center', backgroundColor: theme.warnBg, borderRadius: theme.radius.icon, height: 44, justifyContent: 'center', width: 44 }}>
                  <Feather color={theme.warn} name="bell" size={24} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Oil change due soon</AppText>
                  <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>Engine oil · in 14 days</AppText>
                </View>
              </Card>
              <Card style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Daily reminder</AppText>
                  <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>20:00</AppText>
                </View>
                <View style={{ backgroundColor: theme.ok, borderRadius: 15, height: 30, width: 52 }}>
                  <View style={{ backgroundColor: theme.onAccent, borderRadius: 12, height: 24, position: 'absolute', right: 3, top: 3, width: 24 }} />
                </View>
              </Card>
            </>
          ) : null}
        </View>
      </View>

      <View style={{ gap: 10, paddingHorizontal: 8 }}>
        <AppText maxFontSizeMultiplier={1.3} style={{ fontFamily: theme.font.extrabold, fontSize: 30, letterSpacing: -0.75, lineHeight: 33 }}>{SLIDES[index].title}</AppText>
        <AppText color={theme.muted} style={{ lineHeight: 24 }}>{SLIDES[index].body}</AppText>
      </View>
      </ScrollView>

      <View style={{ gap: 16, paddingBottom: 8, paddingHorizontal: 28, paddingTop: 12 }}>
        <View accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`} style={{ alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {SLIDES.map((_, dot) => (
            <View key={dot} style={{ backgroundColor: dot === index ? theme.accent : theme.border, borderRadius: 4, height: 8, width: dot === index ? 28 : 8 }} />
          ))}
        </View>
        <Button
          onPress={() => {
            if (last) onDone();
            else setIndex((value) => value + 1);
          }}
          title={last ? 'Get started' : 'Next'}
        />
      </View>
    </View>
  );
}

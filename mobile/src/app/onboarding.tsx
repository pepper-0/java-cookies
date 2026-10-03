import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen } from '@/components/ui';
import { setSetting } from '@/storage/database';
import { colors, spacing } from '@/theme';

const slides = [
  {
    step: '1',
    title: 'Diagnose Crops Offline',
    body: 'Take or select a crop photo. LimaDRC keeps the diagnosis flow available even when your connection is unreliable.',
  },
  {
    step: '2',
    title: 'Keep Observations Safe',
    body: 'Farmer, farm, and diagnosis records are saved on this device first. A network failure will not delete them.',
  },
  {
    step: '3',
    title: 'Sync When Connected',
    body: 'The Sync Status screen shows records waiting to upload and marks them synced only after the backend confirms receipt.',
  },
] as const;

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  async function next() {
    if (!isLast) {
      setIndex((current) => current + 1);
      return;
    }

    try {
      setFinishing(true);
      await setSetting(db, 'onboarding_complete', '1');
      await setSetting(db, 'onboarding_started', '0');
      router.replace('/');
    } catch (error) {
      Alert.alert(
        'Could Not Finish Setup',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setFinishing(false);
    }
  }

  return (
    <Screen
      eyebrow={`Quick Tour ${index + 1} of ${slides.length}`}
      includeTopInset
      title={slide.title}
      subtitle="A short introduction to the LimaDRC field workflow."
    >
      <Card>
        <View style={styles.stepCircle}>
          <Text style={styles.stepNumber}>{slide.step}</Text>
        </View>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideBody}>{slide.body}</Text>
      </Card>

      <View style={styles.dots}>
        {slides.map((item, slideIndex) => (
          <View
            key={item.step}
            style={[styles.dot, slideIndex === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        {index > 0 ? (
          <View style={styles.actionCell}>
            <ActionButton label="Back" onPress={() => setIndex((current) => current - 1)} tone="quiet" />
          </View>
        ) : null}
        <View style={styles.actionCell}>
          <ActionButton
            label={isLast ? 'Start Using LimaDRC' : 'Next'}
            loading={finishing}
            onPress={next}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  stepNumber: { color: colors.primary, fontSize: 38, fontWeight: '900' },
  slideTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  slideBody: { color: colors.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  dot: { backgroundColor: colors.border, borderRadius: 5, height: 10, width: 10 },
  dotActive: { backgroundColor: colors.primary, width: 28 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionCell: { flex: 1 },
});

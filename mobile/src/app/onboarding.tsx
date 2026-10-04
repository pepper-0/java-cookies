import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen } from '@/components/ui';
import { useTranslation } from '@/localization';
import { setSetting } from '@/storage/database';
import { colors, spacing } from '@/theme';

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const slides = [
    { step: '1', title: t('onboarding.slide1Title'), body: t('onboarding.slide1Body') },
    { step: '2', title: t('onboarding.slide2Title'), body: t('onboarding.slide2Body') },
    { step: '3', title: t('onboarding.slide3Title'), body: t('onboarding.slide3Body') },
  ];
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
        t('onboarding.finishError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      );
    } finally {
      setFinishing(false);
    }
  }

  return (
    <Screen
      eyebrow={t('onboarding.tour', { current: index + 1, total: slides.length })}
      includeTopInset
      title={slide.title}
      subtitle={t('onboarding.subtitle')}
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
            <ActionButton label={t('onboarding.back')} onPress={() => setIndex((current) => current - 1)} tone="quiet" />
          </View>
        ) : null}
        <View style={styles.actionCell}>
          <ActionButton
            label={isLast ? t('onboarding.start') : t('onboarding.next')}
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

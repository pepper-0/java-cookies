import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen, StatusBadge } from '@/components/ui';
import { useTranslation } from '@/localization';
import { getPendingCount, getProfile, getSetting, setSetting } from '@/storage/database';
import { colors, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [farmerName, setFarmerName] = useState<string | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setCheckingOnboarding(true);
        const [pending, profile, onboardingComplete, onboardingStarted] = await Promise.all([
          getPendingCount(db),
          getProfile(db),
          getSetting(db, 'onboarding_complete'),
          getSetting(db, 'onboarding_started'),
        ]);
        if (!active) return;

        if (onboardingComplete !== '1') {
          if (!profile) {
            await setSetting(db, 'onboarding_started', '1');
            if (active) {
              router.replace({ pathname: '/farm', params: { onboarding: '1' } });
            }
            return;
          }

          if (onboardingStarted === '1') {
            router.replace('/onboarding');
            return;
          }

          // A profile without an onboarding marker predates this feature.
          // Treat that person as a returning user and do not interrupt them.
          await setSetting(db, 'onboarding_complete', '1');
        }

        if (!active) return;
        setPendingCount(pending);
        setFarmerName(profile?.farmer.name ?? null);
        setCheckingOnboarding(false);
      }

      load().catch(() => {
        if (active) setCheckingOnboarding(false);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  if (checkingOnboarding) {
    return (
      <Screen
        eyebrow={t('home.eyebrow')}
        includeTopInset
        title="LimaDRC"
        subtitle={t('home.preparing')}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={t('home.eyebrow')}
      includeTopInset
      title={farmerName ? t('home.greeting', { name: farmerName }) : 'LimaDRC'}
      subtitle={t('home.subtitle')}
    >
      <Card>
        <View style={styles.heroMark}><Text style={styles.heroMarkText}>L</Text></View>
        <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
        <Text style={styles.body}>{t('home.heroBody')}</Text>
        <ActionButton label={t('home.diagnose')} onPress={() => router.push('/diagnose')} />
      </Card>

      <View style={styles.grid}>
        <HomeTile
          detail={farmerName ? t('home.profileSaved') : t('home.addDetails')}
          label={t('home.myFarm')}
          onPress={() => router.push('/farm')}
        />
        <HomeTile
          badge={<StatusBadge status={pendingCount > 0 ? 'PENDING' : 'SYNCED'} />}
          detail={pendingCount === 1 ? t('home.oneWaiting') : t('home.manyWaiting', { count: pendingCount })}
          label={t('home.syncStatus')}
          onPress={() => router.push('/sync')}
        />
      </View>

      <View style={styles.grid}>
        <HomeTile
          detail={t('home.settingsDetail')}
          label={t('home.settings')}
          onPress={() => router.push('/settings')}
        />
        <View style={styles.disabledTile}>
          <View>
            <Text style={styles.disabledTitle}>{t('home.marketPrices')}</Text>
            <Text style={styles.disabledBody}>{t('home.availableLater')}</Text>
          </View>
          <Text style={styles.soon}>{t('home.later')}</Text>
        </View>
      </View>
    </Screen>
  );
}

function HomeTile({
  label,
  detail,
  onPress,
  badge,
}: {
  label: string;
  detail: string;
  onPress: () => void;
  badge?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <Text style={styles.tileTitle}>{label}</Text>
      {badge}
      <Text style={styles.tileBody}>{detail}</Text>
      <Text style={styles.tileArrow}>{t('home.open')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroMark: {
    alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, height: 48,
    justifyContent: 'center', width: 48,
  },
  heroMarkText: { color: colors.white, fontSize: 22, fontWeight: '900' },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: 'row', gap: spacing.md },
  tile: {
    backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md,
    borderWidth: 1, flex: 1, gap: spacing.sm, minHeight: 170, padding: spacing.md,
  },
  tilePressed: { opacity: 0.75 },
  tileTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  tileBody: { color: colors.textMuted, flex: 1, fontSize: 13, lineHeight: 19 },
  tileArrow: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  disabledTile: {
    alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    flex: 1, justifyContent: 'space-between', minHeight: 170, opacity: 0.75, padding: spacing.md,
  },
  disabledTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  disabledBody: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  soon: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});

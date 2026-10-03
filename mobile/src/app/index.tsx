import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen, StatusBadge } from '@/components/ui';
import { getPendingCount, getProfile } from '@/storage/database';
import { colors, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [pendingCount, setPendingCount] = useState(0);
  const [farmerName, setFarmerName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getPendingCount(db), getProfile(db)]).then(([pending, profile]) => {
        if (!active) return;
        setPendingCount(pending);
        setFarmerName(profile?.farmer.name ?? null);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <Screen
      eyebrow="Offline field assistant"
      includeTopInset
      title={farmerName ? `Mbote, ${farmerName}` : 'LimaDRC'}
      subtitle="Capture a crop concern, keep it safely on this device, and sync when a connection is available."
    >
      <Card>
        <View style={styles.heroTop}>
          <View style={styles.heroMark}><Text style={styles.heroMarkText}>M</Text></View>
          <StatusBadge status={pendingCount > 0 ? 'PENDING' : 'SYNCED'} />
        </View>
        <Text style={styles.heroTitle}>Check a crop in the field</Text>
        <Text style={styles.body}>
          Checkpoint 1 uses a local mock diagnosis while the image model is prepared.
        </Text>
        <ActionButton label="Diagnose crop" onPress={() => router.push('/diagnose')} />
      </Card>

      <View style={styles.grid}>
        <HomeTile
          detail={farmerName ? 'Profile saved on device' : 'Add farmer and farm details'}
          label="My farm"
          onPress={() => router.push('/farm')}
        />
        <HomeTile
          detail={`${pendingCount} record${pendingCount === 1 ? '' : 's'} waiting`}
          label="Sync status"
          onPress={() => router.push('/sync')}
        />
      </View>

      <View style={styles.disabledTile}>
        <View>
          <Text style={styles.disabledTitle}>Market prices</Text>
          <Text style={styles.disabledBody}>Available after the core checkpoint</Text>
        </View>
        <Text style={styles.soon}>LATER</Text>
      </View>
    </Screen>
  );
}

function HomeTile({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <Text style={styles.tileTitle}>{label}</Text>
      <Text style={styles.tileBody}>{detail}</Text>
      <Text style={styles.tileArrow}>Open →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
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
    borderWidth: 1, flex: 1, gap: spacing.sm, minHeight: 152, padding: spacing.md,
  },
  tilePressed: { opacity: 0.75 },
  tileTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  tileBody: { color: colors.textMuted, flex: 1, fontSize: 13, lineHeight: 19 },
  tileArrow: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  disabledTile: {
    alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    flexDirection: 'row', justifyContent: 'space-between', opacity: 0.75, padding: spacing.md,
  },
  disabledTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  disabledBody: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  soon: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});

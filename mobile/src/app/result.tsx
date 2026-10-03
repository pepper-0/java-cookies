import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen, StatusBadge } from '@/components/ui';
import { saveObservation } from '@/storage/database';
import { colors, radius, spacing } from '@/theme';

export default function ResultScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{
    imageUri: string;
    diagnosisId: string;
    crop: string;
    confidence: string;
    severity: string;
  }>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const confidence = useMemo(() => Number(params.confidence) || 0, [params.confidence]);

  async function save() {
    if (!params.imageUri || !params.diagnosisId || !params.crop) {
      Alert.alert('Missing result', 'Return to Diagnose and choose a photo again.');
      return;
    }
    try {
      setSaving(true);
      await saveObservation(db, {
        imageUri: params.imageUri,
        crop: params.crop,
        diagnosisId: params.diagnosisId,
        confidence,
        severity: params.severity || undefined,
      });
      setSaved(true);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      eyebrow="Mock diagnosis"
      title="Cassava mosaic disease"
      subtitle="This hard-coded result validates the complete app flow before the real model is added."
      right={saved ? <StatusBadge status="PENDING" /> : undefined}
    >
      {params.imageUri ? (
        <Image accessibilityLabel="Diagnosed crop" source={{ uri: params.imageUri }} style={styles.image} />
      ) : null}

      <Card>
        <View style={styles.metricRow}>
          <Metric label="Crop" value={capitalize(params.crop || 'cassava')} />
          <Metric label="Confidence" value={`${Math.round(confidence * 100)}%`} />
          <Metric label="Severity" value={capitalize(params.severity || 'moderate')} />
        </View>
        <View style={styles.divider} />
        <Text style={styles.label}>Diagnosis ID</Text>
        <Text style={styles.code}>{params.diagnosisId || 'cassava_mosaic_disease'}</Text>
      </Card>

      <Card>
        <Text style={styles.adviceTitle}>Basic field guidance</Text>
        <Text style={styles.adviceBody}>
          Mark the affected plant, avoid moving cuttings from it, and ask a local extension agent to confirm the diagnosis before treatment or removal.
        </Text>
        <Text style={styles.disclaimer}>Prototype guidance only. It is not a confirmed diagnosis.</Text>
      </Card>

      {saved ? (
        <Card>
          <Text style={styles.savedTitle}>Saved offline</Text>
          <Text style={styles.adviceBody}>
            The observation is marked PENDING and will remain on this device if the backend is unavailable.
          </Text>
          <ActionButton label="View sync status" onPress={() => router.push('/sync')} />
        </Card>
      ) : (
        <ActionButton label="Save observation" loading={saving} onPress={save} />
      )}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

const styles = StyleSheet.create({
  image: { aspectRatio: 16 / 10, borderRadius: radius.md, width: '100%' },
  metricRow: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, gap: 4 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  divider: { backgroundColor: colors.border, height: 1 },
  code: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  adviceTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  adviceBody: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  disclaimer: { color: colors.warning, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  savedTitle: { color: colors.success, fontSize: 19, fontWeight: '800' },
});

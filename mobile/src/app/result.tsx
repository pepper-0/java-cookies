import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen } from '@/components/ui';
import { saveObservation } from '@/storage/database';
import { colors, radius, spacing } from '@/theme';

export default function ResultScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{
    imageUri: string;
    diagnosisId: string;
    crop: string;
    confidence: string;
  }>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>(
    params.imageUri ? 'loading' : 'error',
  );
  const confidence = useMemo(() => Number(params.confidence) || 0, [params.confidence]);
  const displayedImageStatus = params.imageUri ? imageStatus : 'error';

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
      eyebrow="Mock Diagnosis"
      title={formatDiagnosis(params.diagnosisId || 'cassava_mosaic_disease')}
      subtitle="This hard-coded result validates the complete app flow before the real model is added."
    >
      <View style={styles.imageFrame}>
        {params.imageUri ? (
          <Image
            accessibilityLabel="Crop photo used for this diagnosis"
            onError={() => setImageStatus('error')}
            onLoad={() => setImageStatus('loaded')}
            onLoadStart={() => setImageStatus('loading')}
            resizeMode="cover"
            source={{ uri: params.imageUri }}
            style={styles.image}
          />
        ) : null}

        {displayedImageStatus === 'loading' ? (
          <View style={styles.imageState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.imageStateTitle}>Loading Crop Photo</Text>
          </View>
        ) : null}

        {displayedImageStatus === 'error' ? (
          <View style={styles.imageState}>
            <Text style={styles.imageErrorIcon}>!</Text>
            <Text style={styles.imageStateTitle}>Crop Photo Unavailable</Text>
            <Text style={styles.imageStateBody}>
              Return to Diagnose and choose the photo again.
            </Text>
          </View>
        ) : null}

        {displayedImageStatus === 'loaded' ? (
          <View style={styles.imageCaption}>
            <Text style={styles.imageCaptionText}>Analyzed Crop Photo</Text>
          </View>
        ) : null}
      </View>

      {displayedImageStatus === 'error' ? (
        <ActionButton
          label="Choose Another Photo"
          onPress={() => router.replace('/diagnose')}
          tone="secondary"
        />
      ) : null}

      <Card>
        <View style={styles.metricRow}>
          <Metric label="Crop" value={capitalize(params.crop || 'cassava')} />
          <Metric label="Confidence" value={`${Math.round(confidence * 100)}%`} />
        </View>
        <View style={styles.divider} />
        <Text style={styles.label}>Diagnosis ID</Text>
        <Text style={styles.code}>{params.diagnosisId || 'cassava_mosaic_disease'}</Text>
      </Card>

      <Card>
        <Text style={styles.adviceTitle}>Basic Field Guidance</Text>
        <Text style={styles.adviceBody}>
          Mark the affected plant, avoid moving cuttings from it, and ask a local extension agent to confirm the diagnosis before treatment or removal.
        </Text>
        <Text style={styles.disclaimer}>Prototype guidance only. It is not a confirmed diagnosis.</Text>
      </Card>

      {saved ? (
        <Card>
          <Text style={styles.savedTitle}>Saved Offline</Text>
          <Text style={styles.adviceBody}>
            The observation is marked PENDING and will remain on this device if the backend is unavailable.
          </Text>
          <ActionButton label="Return Home" onPress={() => router.replace('/')} />
        </Card>
      ) : (
        <ActionButton
          disabled={displayedImageStatus !== 'loaded'}
          label="Save observation"
          loading={saving}
          onPress={save}
        />
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

function formatDiagnosis(value: string) {
  return value.split('_').map(capitalize).join(' ');
}

const styles = StyleSheet.create({
  imageFrame: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  image: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  imageState: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    bottom: 0,
    gap: spacing.sm,
    justifyContent: 'center',
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  imageErrorIcon: {
    borderColor: colors.danger,
    borderRadius: 24,
    borderWidth: 2,
    color: colors.danger,
    fontSize: 24,
    fontWeight: '900',
    height: 48,
    lineHeight: 44,
    textAlign: 'center',
    width: 48,
  },
  imageStateTitle: { color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  imageStateBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  imageCaption: {
    backgroundColor: 'rgba(23, 35, 27, 0.78)',
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
    right: 0,
  },
  imageCaptionText: { color: colors.white, fontSize: 12, fontWeight: '800' },
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

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen } from '@/components/ui';
import { getDiseaseDiagnosis } from '@/ml/guidance';
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
  const diagnosis = useMemo(
    () => getDiseaseDiagnosis(params.diagnosisId),
    [params.diagnosisId],
  );
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
      title={diagnosis.name}
      subtitle="Diagnosis details and field guidance are stored on this device and remain available offline."
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
        <Text style={styles.code}>{diagnosis.id}</Text>
        <Text style={styles.label}>Condition Type</Text>
        <Text style={styles.metricValue}>{formatLabel(diagnosis.type)}</Text>
      </Card>

      <Card>
        <Text style={styles.adviceTitle}>Diagnosis Details</Text>
        <Text style={styles.adviceBody}>{diagnosis.diagnosisMessage}</Text>

        <Text style={styles.guidanceHeading}>Symptoms to Check</Text>
        <View style={styles.actionList}>
          {diagnosis.symptoms.map((symptom) => (
            <View key={symptom} style={styles.actionRow}>
              <Text style={styles.actionBullet}>•</Text>
              <Text style={styles.actionText}>{symptom}</Text>
            </View>
          ))}
        </View>

        {diagnosis.symptoms.length === 0 ? (
          <Text style={styles.adviceBody}>No specific symptoms are available for this result.</Text>
        ) : null}

        {diagnosis.additionalPhotoRecommended ? (
          <Text style={styles.photoRecommendation}>
            Additional photo recommended: {formatLabel(diagnosis.additionalPhotoRecommended)}
          </Text>
        ) : null}

        {diagnosis.curativeTreatment !== undefined ? (
          <Text style={styles.treatmentOutlook}>
            {diagnosis.curativeTreatment === false
              ? 'No curative treatment is listed for this condition.'
              : diagnosis.curativeTreatment === true
                ? 'Curative treatment options are listed for this condition.'
                : 'Curative treatment options are limited.'}
          </Text>
        ) : null}

        <Text style={styles.guidanceHeading}>Recommended Actions</Text>
        {diagnosis.treatments.length > 0 ? (
          <View style={styles.treatmentList}>
            {diagnosis.treatments.map((treatment, index) => (
              <View key={`${treatment.name}-${index}`} style={styles.treatmentCard}>
                <Text style={styles.treatmentName}>{treatment.name}</Text>
                <Text style={styles.treatmentCategory}>{formatLabel(treatment.category)}</Text>
                <Text style={styles.adviceBody}>{treatment.description}</Text>

                {treatment.costLevel ? (
                  <Text style={styles.treatmentMeta}>
                    Cost level: {formatLabel(treatment.costLevel)}
                  </Text>
                ) : null}

                {treatment.estimatedCost !== null ? (
                  <Text style={styles.treatmentMeta}>
                    Estimated cost:{' '}
                    {treatment.estimatedCost === 0
                      ? 'No direct material cost listed.'
                      : String(treatment.estimatedCost)}
                  </Text>
                ) : null}

                {treatment.requiresLocalVerification ? (
                  <Text style={styles.verification}>Local verification required before use.</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.adviceBody}>
            No treatment actions are listed for this result. Continue normal crop monitoring.
          </Text>
        )}

        <Text style={styles.guidanceHeading}>Field Summary</Text>
        <Text style={styles.adviceBody}>{diagnosis.voiceMessage}</Text>

        <Text style={styles.disclaimer}>
          Image recognition provides a likely result, not a confirmed diagnosis. Confirm treatment,
          availability, and costs with a local agricultural expert.
        </Text>
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

function formatLabel(value: string) {
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
  guidanceHeading: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: spacing.xs },
  actionList: { gap: spacing.sm },
  actionRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  actionBullet: { color: colors.primary, fontSize: 18, fontWeight: '900', lineHeight: 22 },
  actionText: { color: colors.textMuted, flex: 1, fontSize: 15, lineHeight: 22 },
  photoRecommendation: { color: colors.primary, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  treatmentOutlook: { color: colors.warning, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  treatmentList: { gap: spacing.sm },
  treatmentCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  treatmentName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  treatmentCategory: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  treatmentMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  verification: { color: colors.warning, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  disclaimer: { color: colors.warning, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  savedTitle: { color: colors.success, fontSize: 19, fontWeight: '800' },
});

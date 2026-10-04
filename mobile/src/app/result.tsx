import * as Speech from 'expo-speech';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen } from '@/components/ui';
import { getCropLabel } from '@/constants/profile-options';
import { type TranslationKey, useTranslation } from '@/localization';
import { getDiseaseDiagnosis } from '@/ml/guidance';
import { getSetting, saveObservation } from '@/storage/database';
import { colors, radius, spacing } from '@/theme';

const codeTranslationKeys: Record<string, TranslationKey> = {
  healthy: 'code.healthy',
  viral: 'code.viral',
  fungal: 'code.fungal',
  bacterial: 'code.bacterial',
  unknown: 'code.unknown',
  unsupported: 'code.unsupported',
  field_management: 'code.field_management',
  prevention: 'code.prevention',
  chemical: 'code.chemical',
  diagnosis_support: 'code.diagnosis_support',
  expert_support: 'code.expert_support',
  low: 'code.low',
  variable: 'code.variable',
  expensive: 'code.expensive',
  free: 'code.free',
  root: 'code.root',
};

export default function ResultScreen() {
  const db = useSQLiteContext();
  const { locale, t } = useTranslation();
  const params = useLocalSearchParams<{
    imageUri: string;
    diagnosisId: string;
    crop: string;
    confidence: string;
  }>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [audioGuidanceEnabled, setAudioGuidanceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>(
    params.imageUri ? 'loading' : 'error',
  );
  const confidence = useMemo(() => Number(params.confidence) || 0, [params.confidence]);
  const diagnosis = useMemo(
    () => getDiseaseDiagnosis(params.diagnosisId, locale),
    [locale, params.diagnosisId],
  );
  const displayedImageStatus = params.imageUri ? imageStatus : 'error';

  const spokenText = useMemo(() => {
    const parts = [
      diagnosis.name,
      diagnosis.voiceMessage,
      diagnosis.symptoms.length ? `${t('result.symptoms')}: ${diagnosis.symptoms.join('. ')}` : '',
      diagnosis.treatments.length
        ? `${t('result.actions')}: ${diagnosis.treatments.map((treatment) => `${treatment.name}. ${treatment.description}`).join('. ')}`
        : '',
    ];

    return parts.filter(Boolean).join('. ');
  }, [diagnosis, t]);

  useEffect(() => {
    let active = true;

    getSetting(db, 'audio_guidance_enabled')
      .then((value) => {
        if (active) setAudioGuidanceEnabled(value === '1');
      })
      .catch(() => {
        if (active) setAudioGuidanceEnabled(false);
      });

    return () => {
      active = false;
    };
  }, [db]);

  const startSpeaking = useCallback(() => {
    if (!spokenText) return;

    Speech.speak(spokenText, {
      language: locale === 'fr' ? 'fr-FR' : 'en-US',
      pitch: 1,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
    setIsSpeaking(true);
  }, [locale, spokenText]);

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      void Speech.stop();
      setIsSpeaking(false);
      return;
    }

    startSpeaking();
  }, [isSpeaking, startSpeaking]);

  useEffect(() => {
    if (!audioGuidanceEnabled || !spokenText) return;

    const timeout = setTimeout(() => {
      startSpeaking();
    }, 500);

    return () => {
      clearTimeout(timeout);
      void Speech.stop();
    };
  }, [audioGuidanceEnabled, spokenText, startSpeaking]);

  useEffect(() => () => {
    void Speech.stop();
  }, []);

  async function save() {
    if (!params.diagnosisId || !params.crop) {
      Alert.alert(t('result.missing'), t('result.missingBody'));
      return;
    }
    try {
      setSaving(true);
      await saveObservation(db, {
        crop: params.crop,
        diagnosisId: params.diagnosisId,
        confidence,
      });
      setSaved(true);
    } catch (error) {
      Alert.alert(t('result.saveError'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      eyebrow={t('result.eyebrow')}
      title={diagnosis.name}
      subtitle={t('result.subtitle')}
    >
      <View style={styles.imageFrame}>
        {params.imageUri ? (
          <Image
            accessibilityLabel={t('result.photoAccessibility')}
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
            <Text style={styles.imageStateTitle}>{t('result.loadingPhoto')}</Text>
          </View>
        ) : null}

        {displayedImageStatus === 'error' ? (
          <View style={styles.imageState}>
            <Text style={styles.imageErrorIcon}>!</Text>
            <Text style={styles.imageStateTitle}>{t('result.photoUnavailable')}</Text>
            <Text style={styles.imageStateBody}>{t('result.photoUnavailableBody')}</Text>
          </View>
        ) : null}

        {displayedImageStatus === 'loaded' ? (
          <View style={styles.imageCaption}>
            <Text style={styles.imageCaptionText}>{t('result.analyzedPhoto')}</Text>
          </View>
        ) : null}
      </View>

      {displayedImageStatus === 'error' ? (
        <ActionButton
          label={t('result.chooseAnother')}
          onPress={() => router.replace('/diagnose')}
          tone="secondary"
        />
      ) : null}

      <Card>
        <View style={styles.metricRow}>
          <Metric label={t('result.crop')} value={getCropLabel(capitalize(params.crop || 'cassava'), t)} />
          <Metric label={t('result.confidence')} value={`${Math.round(confidence * 100)}%`} />
        </View>
        <View style={styles.divider} />
        <Text style={styles.label}>{t('result.diagnosisId')}</Text>
        <Text style={styles.code}>{diagnosis.id}</Text>
        <Text style={styles.label}>{t('result.conditionType')}</Text>
        <Text style={styles.metricValue}>{formatCodeLabel(diagnosis.type, t)}</Text>
      </Card>

      <Card>
        <Text style={styles.adviceTitle}>{t('result.details')}</Text>
        <Text style={styles.adviceBody}>{diagnosis.diagnosisMessage}</Text>

        <Text style={styles.guidanceHeading}>{t('result.symptoms')}</Text>
        <View style={styles.actionList}>
          {diagnosis.symptoms.map((symptom) => (
            <View key={symptom} style={styles.actionRow}>
              <Text style={styles.actionBullet}>•</Text>
              <Text style={styles.actionText}>{symptom}</Text>
            </View>
          ))}
        </View>

        {diagnosis.symptoms.length === 0 ? (
          <Text style={styles.adviceBody}>{t('result.noSymptoms')}</Text>
        ) : null}

        {diagnosis.additionalPhotoRecommended ? (
          <Text style={styles.photoRecommendation}>
            {t('result.additionalPhoto', {
              target: formatCodeLabel(diagnosis.additionalPhotoRecommended, t),
            })}
          </Text>
        ) : null}

        {diagnosis.curativeTreatment !== undefined ? (
          <Text style={styles.treatmentOutlook}>
            {diagnosis.curativeTreatment === false
              ? t('result.noCurative')
              : diagnosis.curativeTreatment === true
                ? t('result.curative')
                : t('result.limitedCurative')}
          </Text>
        ) : null}

        <Text style={styles.guidanceHeading}>{t('result.actions')}</Text>
        {diagnosis.treatments.length > 0 ? (
          <View style={styles.treatmentList}>
            {diagnosis.treatments.map((treatment, index) => (
              <View key={`${treatment.name}-${index}`} style={styles.treatmentCard}>
                <Text style={styles.treatmentName}>{treatment.name}</Text>
                <Text style={styles.treatmentCategory}>
                  {formatCodeLabel(treatment.category, t)}
                </Text>
                <Text style={styles.adviceBody}>{treatment.description}</Text>

                {treatment.costLevel ? (
                  <Text style={styles.treatmentMeta}>
                    {t('result.costLevel', { value: formatCodeLabel(treatment.costLevel, t) })}
                  </Text>
                ) : null}

                {treatment.estimatedCost !== null ? (
                  <Text style={styles.treatmentMeta}>
                    {t('result.estimatedCost', {
                      value: treatment.estimatedCost === 0
                        ? t('result.noDirectCost')
                        : String(treatment.estimatedCost),
                    })}
                  </Text>
                ) : null}

                {treatment.requiresLocalVerification ? (
                  <Text style={styles.verification}>{t('result.localVerification')}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.adviceBody}>{t('result.noTreatments')}</Text>
        )}

        <Text style={styles.guidanceHeading}>{t('result.fieldSummary')}</Text>
        <Text style={styles.adviceBody}>{diagnosis.voiceMessage}</Text>

        <Text style={styles.disclaimer}>{t('result.disclaimer')}</Text>
      </Card>

      <ActionButton
        label={isSpeaking ? t('result.stopListening') : t('result.listen')}
        onPress={handleSpeak}
        tone="secondary"
      />

      {saved ? (
        <Card>
          <Text style={styles.savedTitle}>{t('result.savedTitle')}</Text>
          <Text style={styles.adviceBody}>{t('result.savedBody')}</Text>
          <ActionButton label={t('result.returnHome')} onPress={() => router.replace('/')} />
        </Card>
      ) : (
        <ActionButton
          label={t('result.save')}
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

function formatCodeLabel(value: string, t: (key: TranslationKey) => string) {
  return codeTranslationKeys[value]
    ? t(codeTranslationKeys[value])
    : value.split('_').map(capitalize).join(' ');
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

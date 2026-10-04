import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { MultiSelectField, SelectField } from '@/components/selection-field';
import { ActionButton, Card, FormField, Screen, SectionTitle, StatusBadge } from '@/components/ui';
import {
  getCropLabel,
  getCropSelectOptions,
  getLanguageSelectOptions,
  normalizeLanguage,
  parsePrimaryCrops,
  serializePrimaryCrops,
} from '@/constants/profile-options';
import { APP_LANGUAGE_SETTING_KEY, localeFromLanguage, useTranslation } from '@/localization';
import { getDiseaseDiagnosis } from '@/ml/guidance';
import { getObservations, getProfile, saveProfile, setSetting } from '@/storage/database';
import type { Observation } from '@/storage/types';
import { colors, spacing } from '@/theme';

const blankForm = {
  name: '',
  province: '',
  territory: '',
  village: '',
  preferredLanguage: 'French',
};

export default function FarmScreen() {
  const db = useSQLiteContext();
  const { locale, setLocale, t } = useTranslation();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const [form, setForm] = useState(blankForm);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [otherCrop, setOtherCrop] = useState('');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [profile, savedObservations] = await Promise.all([getProfile(db), getObservations(db)]);
    if (profile) {
      const parsedCrops = parsePrimaryCrops(profile.farm?.primary_crops);
      setForm({
        name: profile.farmer.name,
        province: profile.farmer.province,
        territory: profile.farmer.territory,
        village: profile.farmer.village,
        preferredLanguage: normalizeLanguage(profile.farmer.preferred_language),
      });
      setSelectedCrops(parsedCrops.selectedCrops);
      setOtherCrop(parsedCrops.otherCrop);
    }
    setObservations(savedObservations);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  function update(field: keyof typeof form, value: string) {
    setSavedMessage(null);
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    if (!form.name.trim()) {
      Alert.alert(t('farm.nameRequired'), t('farm.nameRequiredBody'));
      return;
    }
    if (selectedCrops.includes('Other') && !otherCrop.trim()) {
      Alert.alert(t('farm.otherRequired'), t('farm.otherRequiredBody'));
      return;
    }
    try {
      setSaving(true);
      await saveProfile(db, {
        ...form,
        primaryCrops: serializePrimaryCrops(selectedCrops, otherCrop),
      });
      if (isOnboarding) {
        if (form.preferredLanguage === 'English' || form.preferredLanguage === 'French') {
          await setSetting(db, APP_LANGUAGE_SETTING_KEY, form.preferredLanguage);
          setLocale(localeFromLanguage(form.preferredLanguage));
        }
        router.replace('/onboarding');
        return;
      }
      setSavedMessage(t('farm.saved'));
      await reload();
    } catch (error) {
      Alert.alert(t('farm.saveError'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      eyebrow={isOnboarding ? t('farm.firstSetup') : t('farm.localProfile')}
      title={isOnboarding ? t('farm.createTitle') : t('farm.title')}
      subtitle={isOnboarding
        ? t('farm.onboardingSubtitle')
        : t('farm.subtitle')}
    >
      <Card>
        <FormField
          autoCapitalize="words"
          label={t('farm.farmerName')}
          onChangeText={(value) => update('name', value)}
          placeholder={t('farm.nameExample')}
          value={form.name}
        />
        <FormField
          autoCapitalize="words"
          label={t('farm.province')}
          onChangeText={(value) => update('province', value)}
          placeholder={t('farm.provinceExample')}
          value={form.province}
        />
        <FormField
          autoCapitalize="words"
          label={t('farm.territory')}
          onChangeText={(value) => update('territory', value)}
          placeholder={t('farm.territory')}
          value={form.territory}
        />
        <FormField
          autoCapitalize="words"
          label={t('farm.village')}
          onChangeText={(value) => update('village', value)}
          placeholder={t('farm.village')}
          value={form.village}
        />
        <SelectField
          label={t('farm.preferredLanguage')}
          onChange={(value) => update('preferredLanguage', value)}
          options={getLanguageSelectOptions(t)}
          value={form.preferredLanguage}
        />
        <MultiSelectField
          hint={t('farm.primaryCropsHint')}
          label={t('farm.primaryCrops')}
          onChange={(values) => {
            setSavedMessage(null);
            setSelectedCrops(values);
            if (!values.includes('Other')) setOtherCrop('');
          }}
          options={getCropSelectOptions(t)}
          values={selectedCrops}
        />
        {selectedCrops.includes('Other') ? (
          <FormField
            autoCapitalize="words"
            hint={t('farm.otherCropHint')}
            label={t('farm.otherCrop')}
            onChangeText={(value) => {
              setSavedMessage(null);
              setOtherCrop(value);
            }}
            placeholder={t('farm.otherCropExample')}
            value={otherCrop}
          />
        ) : null}
        <ActionButton
          label={isOnboarding ? t('farm.saveContinue') : t('farm.saveLocally')}
          loading={saving}
          onPress={save}
        />
        {!isOnboarding && savedMessage ? (
          <View style={styles.confirmation}>
            <StatusBadge status="PENDING" />
            <Text style={styles.confirmationText}>{savedMessage}</Text>
          </View>
        ) : null}
      </Card>

      {!isOnboarding ? (
        <>
          <SectionTitle>{t('farm.savedObservations')}</SectionTitle>
          {observations.length === 0 ? (
            <Card><Text style={styles.empty}>{t('farm.noObservations')}</Text></Card>
          ) : (
            observations.map((observation) => (
              <Card key={observation.local_id}>
                <View style={styles.observationRow}>
                  <View style={styles.observationCopy}>
                    <Text style={styles.observationTitle}>
                      {getDiseaseDiagnosis(observation.diagnosis_id, locale).name}
                    </Text>
                    <Text style={styles.observationDetail}>
                      {getCropLabel(capitalize(observation.crop), t)} ·{' '}
                      {t('farm.confidence', { value: Math.round(observation.confidence * 100) })}
                    </Text>
                    <Text style={styles.observationDetail}>
                      {new Date(observation.timestamp).toLocaleString(locale === 'fr' ? 'fr-CD' : 'en')}
                    </Text>
                  </View>
                  <StatusBadge status={observation.sync_status} />
                </View>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  confirmation: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  confirmationText: { color: colors.textMuted, flex: 1, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  observationRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  observationCopy: { flex: 1, gap: 4 },
  observationTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  observationDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});

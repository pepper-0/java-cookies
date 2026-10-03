import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, FormField, Screen, SectionTitle, StatusBadge } from '@/components/ui';
import { getObservations, getProfile, saveProfile } from '@/storage/database';
import type { Observation } from '@/storage/types';
import { colors, radius, spacing } from '@/theme';

const blankForm = {
  name: '',
  province: '',
  territory: '',
  village: '',
  preferredLanguage: 'Français',
  primaryCrops: '',
};

export default function FarmScreen() {
  const db = useSQLiteContext();
  const [form, setForm] = useState(blankForm);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [profile, savedObservations] = await Promise.all([getProfile(db), getObservations(db)]);
    if (profile) {
      setForm({
        name: profile.farmer.name,
        province: profile.farmer.province,
        territory: profile.farmer.territory,
        village: profile.farmer.village,
        preferredLanguage: profile.farmer.preferred_language,
        primaryCrops: profile.farm?.primary_crops ?? '',
      });
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
      Alert.alert('Name required', 'Enter the farmer name before saving.');
      return;
    }
    try {
      setSaving(true);
      await saveProfile(db, form);
      setSavedMessage('Farmer and farm saved locally as PENDING.');
      await reload();
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      eyebrow="Local profile"
      title="My farm"
      subtitle="These details are stored on this device first and never require a connection."
    >
      <Card>
        <FormField
          autoCapitalize="words"
          label="Farmer name"
          onChangeText={(value) => update('name', value)}
          placeholder="e.g. Marie Kabeya"
          value={form.name}
        />
        <FormField
          autoCapitalize="words"
          label="Province"
          onChangeText={(value) => update('province', value)}
          placeholder="e.g. Kasaï-Central"
          value={form.province}
        />
        <FormField
          autoCapitalize="words"
          label="Territory"
          onChangeText={(value) => update('territory', value)}
          placeholder="Territory"
          value={form.territory}
        />
        <FormField
          autoCapitalize="words"
          label="Village"
          onChangeText={(value) => update('village', value)}
          placeholder="Village"
          value={form.village}
        />
        <FormField
          label="Preferred language"
          onChangeText={(value) => update('preferredLanguage', value)}
          placeholder="Français, Lingala, Swahili…"
          value={form.preferredLanguage}
        />
        <FormField
          autoCapitalize="words"
          hint="Separate multiple crops with commas."
          label="Primary crops"
          onChangeText={(value) => update('primaryCrops', value)}
          placeholder="Cassava, maize, beans"
          value={form.primaryCrops}
        />
        <ActionButton label="Save locally" loading={saving} onPress={save} />
        {savedMessage ? (
          <View style={styles.confirmation}>
            <StatusBadge status="PENDING" />
            <Text style={styles.confirmationText}>{savedMessage}</Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle>Saved observations</SectionTitle>
      {observations.length === 0 ? (
        <Card><Text style={styles.empty}>No observations yet. Diagnose a crop to add one.</Text></Card>
      ) : (
        observations.map((observation) => (
          <Card key={observation.local_id}>
            <View style={styles.observationRow}>
              <Image source={{ uri: observation.image_uri }} style={styles.thumbnail} />
              <View style={styles.observationCopy}>
                <Text style={styles.observationTitle}>{formatDiagnosis(observation.diagnosis_id)}</Text>
                <Text style={styles.observationDetail}>
                  {capitalize(observation.crop)} · {Math.round(observation.confidence * 100)}% confidence
                </Text>
                <Text style={styles.observationDetail}>{new Date(observation.timestamp).toLocaleString()}</Text>
              </View>
              <StatusBadge status={observation.sync_status} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDiagnosis(value: string) {
  return value.split('_').map(capitalize).join(' ');
}

const styles = StyleSheet.create({
  confirmation: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  confirmationText: { color: colors.textMuted, flex: 1, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  observationRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  thumbnail: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 64, width: 64 },
  observationCopy: { flex: 1, gap: 4 },
  observationTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  observationDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});

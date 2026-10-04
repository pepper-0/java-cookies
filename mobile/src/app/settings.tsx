import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { SelectField } from '@/components/selection-field';
import { ActionButton, Card, Screen, SectionTitle } from '@/components/ui';
import { getAppLanguageSelectOptions, normalizeLanguage } from '@/constants/profile-options';
import {
  APP_LANGUAGE_SETTING_KEY,
  languageFromLocale,
  localeFromLanguage,
  useTranslation,
} from '@/localization';
import { getSetting, setSetting } from '@/storage/database';
import { colors, spacing } from '@/theme';

const settingKeys = {
  language: APP_LANGUAGE_SETTING_KEY,
  audioGuidance: 'audio_guidance_enabled',
  notifications: 'notifications_enabled',
} as const;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { locale, setLocale, t } = useTranslation();
  const [language, setLanguage] = useState(languageFromLocale(locale));
  const [audioGuidance, setAudioGuidance] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadSettings() {
        setLoading(true);
        const [savedLanguage, savedAudioGuidance, savedNotifications] = await Promise.all([
          getSetting(db, settingKeys.language),
          getSetting(db, settingKeys.audioGuidance),
          getSetting(db, settingKeys.notifications),
        ]);
        if (!active) return;

        const normalizedLanguage = normalizeLanguage(savedLanguage, languageFromLocale(locale));
        setLanguage(
          normalizedLanguage === 'English' || normalizedLanguage === 'French'
            ? normalizedLanguage
            : languageFromLocale(locale),
        );
        setAudioGuidance(savedAudioGuidance === '1');
        setNotifications(savedNotifications === '1');
        setLoading(false);
      }

      loadSettings().catch((error) => {
        if (!active) return;
        setLoading(false);
        Alert.alert(
          t('settings.loadError'),
          error instanceof Error ? error.message : t('common.tryAgain'),
        );
      });

      return () => {
        active = false;
      };
    }, [db, locale, t]),
  );

  function markChanged() {
    setSaved(false);
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setSaved(false);
      await Promise.all([
        setSetting(db, settingKeys.language, language),
        setSetting(db, settingKeys.audioGuidance, audioGuidance ? '1' : '0'),
        setSetting(db, settingKeys.notifications, notifications ? '1' : '0'),
      ]);
      setLocale(localeFromLanguage(language));
      setSaved(true);
    } catch (error) {
      Alert.alert(
        t('settings.saveError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      eyebrow={t('settings.eyebrow')}
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
    >
      <SectionTitle>{t('settings.appPreferences')}</SectionTitle>
      <Card>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <>
            <SelectField
              hint={t('settings.languageHint')}
              label={t('settings.appLanguage')}
              onChange={(value) => {
                markChanged();
                setLanguage(value);
              }}
              options={getAppLanguageSelectOptions(t)}
              value={language}
            />
            <View style={styles.divider} />
            <PreferenceToggle
              description={t('settings.audioDescription')}
              label={t('settings.audio')}
              onChange={(value) => {
                markChanged();
                setAudioGuidance(value);
              }}
              value={audioGuidance}
            />
            <View style={styles.divider} />
            <PreferenceToggle
              description={t('settings.notificationsDescription')}
              label={t('settings.notifications')}
              onChange={(value) => {
                markChanged();
                setNotifications(value);
              }}
              value={notifications}
            />
            <ActionButton label={t('settings.save')} loading={saving} onPress={saveSettings} />
            {saved ? <Text style={styles.confirmation}>{t('settings.saved')}</Text> : null}
          </>
        )}
      </Card>

      <SectionTitle>{t('settings.about')}</SectionTitle>
      <Card>
        <SettingRow label={t('settings.application')} value="LimaDRC" />
        <View style={styles.divider} />
        <SettingRow label={t('settings.buildStage')} value={t('settings.iteration')} />
      </Card>

      <Text style={styles.note}>
        {t('settings.note')}
      </Text>
    </Screen>
  );
}

function PreferenceToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor={colors.border}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.success }}
        value={value}
      />
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  preferenceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  preferenceCopy: { flex: 1, gap: 4 },
  label: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '700' },
  description: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  value: { color: colors.textMuted, fontSize: 13, textAlign: 'right' },
  divider: { backgroundColor: colors.border, height: 1 },
  confirmation: { color: colors.success, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});

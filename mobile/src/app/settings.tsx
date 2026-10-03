import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { SelectField } from '@/components/selection-field';
import { ActionButton, Card, Screen, SectionTitle } from '@/components/ui';
import { languageSelectOptions, normalizeLanguage } from '@/constants/profile-options';
import { getSetting, setSetting } from '@/storage/database';
import { colors, spacing } from '@/theme';

const settingKeys = {
  language: 'settings_language',
  audioGuidance: 'audio_guidance_enabled',
  notifications: 'notifications_enabled',
} as const;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [language, setLanguage] = useState('English');
  const [audioGuidance, setAudioGuidance] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

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

        setLanguage(normalizeLanguage(savedLanguage, 'English'));
        setAudioGuidance(savedAudioGuidance === '1');
        setNotifications(savedNotifications === '1');
        setLoading(false);
      }

      loadSettings().catch((error) => {
        if (!active) return;
        setLoading(false);
        Alert.alert(
          'Could Not Load Settings',
          error instanceof Error ? error.message : 'Try again.',
        );
      });

      return () => {
        active = false;
      };
    }, [db]),
  );

  function markChanged() {
    setSavedMessage(null);
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setSavedMessage(null);
      await Promise.all([
        setSetting(db, settingKeys.language, language),
        setSetting(db, settingKeys.audioGuidance, audioGuidance ? '1' : '0'),
        setSetting(db, settingKeys.notifications, notifications ? '1' : '0'),
      ]);
      setSavedMessage('Settings saved on this device.');
    } catch (error) {
      Alert.alert(
        'Could Not Save Settings',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      eyebrow="Local Preferences"
      title="Settings"
      subtitle="Choose preferences for future language, audio, and notification features."
    >
      <SectionTitle>App Preferences</SectionTitle>
      <Card>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <>
            <SelectField
              hint="Interface translation will be added in a later iteration."
              label="App Language"
              onChange={(value) => {
                markChanged();
                setLanguage(value);
              }}
              options={languageSelectOptions}
              value={language}
            />
            <View style={styles.divider} />
            <PreferenceToggle
              description="Save your preference for spoken field guidance. Audio is not active yet."
              label="Audio Guidance"
              onChange={(value) => {
                markChanged();
                setAudioGuidance(value);
              }}
              value={audioGuidance}
            />
            <View style={styles.divider} />
            <PreferenceToggle
              description="Save your preference for future reminders. No notifications are scheduled yet."
              label="Notifications"
              onChange={(value) => {
                markChanged();
                setNotifications(value);
              }}
              value={notifications}
            />
            <ActionButton label="Save Settings" loading={saving} onPress={saveSettings} />
            {savedMessage ? <Text style={styles.confirmation}>{savedMessage}</Text> : null}
          </>
        )}
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card>
        <SettingRow label="Application" value="LimaDRC" />
        <View style={styles.divider} />
        <SettingRow label="Build Stage" value="Iteration 2" />
      </Card>

      <Text style={styles.note}>
        Preferences are stored locally. These controls do not change other parts of the app yet.
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

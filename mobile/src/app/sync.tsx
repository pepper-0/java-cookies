import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, FormField, Screen, SectionTitle, StatusBadge } from '@/components/ui';
import { useTranslation } from '@/localization';
import { checkBackendHealth, DEFAULT_API_URL } from '@/services/api';
import { syncPendingRecords } from '@/services/sync';
import { getPendingCount, getSetting, setSetting } from '@/storage/database';
import { colors, spacing } from '@/theme';

type ConnectionState = 'UNKNOWN' | 'ONLINE' | 'OFFLINE';

export default function SyncScreen() {
  const db = useSQLiteContext();
  const { locale, t } = useTranslation();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('UNKNOWN');
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(() => t('sync.initial'));

  const reload = useCallback(async () => {
    const [storedUrl, count, lastSync] = await Promise.all([
      getSetting(db, 'api_base_url'),
      getPendingCount(db),
      getSetting(db, 'last_sync_at'),
    ]);
    if (storedUrl) setApiUrl(storedUrl);
    setPendingCount(count);
    setLastSyncAt(lastSync);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function saveAddress() {
    const value = apiUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(value)) {
      Alert.alert(t('sync.invalidAddress'), t('sync.invalidAddressBody'));
      return null;
    }
    await setSetting(db, 'api_base_url', value);
    setApiUrl(value);
    return value;
  }

  async function testConnection() {
    try {
      setChecking(true);
      const value = await saveAddress();
      if (!value) return;
      const health = await checkBackendHealth(value);
      setConnection('ONLINE');
      setMessage(t('sync.backendReply', { status: health.status }));
    } catch (error) {
      setConnection('OFFLINE');
      setMessage(error instanceof Error ? error.message : t('sync.unreachable'));
    } finally {
      setChecking(false);
    }
  }

  async function syncNow() {
    try {
      setSyncing(true);
      const value = await saveAddress();
      if (!value) return;
      await checkBackendHealth(value);
      setConnection('ONLINE');
      const result = await syncPendingRecords(db, value);
      await reload();

      if (result.errors.length > 0) {
        setMessage(t('sync.partial', {
          synced: result.synced,
          attempted: result.attempted,
          error: result.errors[0],
        }));
      } else if (result.attempted === 0) {
        setMessage(t('sync.nonePending'));
      } else {
        setMessage(
          result.synced === 1
            ? t('sync.oneConfirmed')
            : t('sync.manyConfirmed', { count: result.synced }),
        );
      }
    } catch (error) {
      setConnection('OFFLINE');
      setMessage(t('sync.recordsRemain', {
        error: error instanceof Error ? error.message : t('sync.failed'),
      }));
      await reload();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Screen
      eyebrow={t('sync.eyebrow')}
      title={t('sync.title')}
      subtitle={t('sync.subtitle')}
      right={connection === 'UNKNOWN' ? undefined : <StatusBadge status={connection} />}
    >
      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Card>
            <Text style={styles.metricValue}>{pendingCount}</Text>
            <Text style={styles.metricLabel}>{t('sync.pendingRecords')}</Text>
          </Card>
        </View>
        <View style={styles.metricCard}>
          <Card>
            <Text style={styles.metricSmall}>
              {lastSyncAt ? formatDate(lastSyncAt, locale) : t('sync.never')}
            </Text>
            <Text style={styles.metricLabel}>{t('sync.lastConfirmed')}</Text>
          </Card>
        </View>
      </View>

      <Card>
        <FormField
          autoCapitalize="none"
          autoCorrect={false}
          hint={t('sync.addressHint')}
          keyboardType="url"
          label={t('sync.address')}
          onChangeText={(value) => {
            setApiUrl(value);
            setConnection('UNKNOWN');
          }}
          value={apiUrl}
        />
        <View style={styles.buttonRow}>
          <View style={styles.buttonCell}>
            <ActionButton label={t('sync.test')} loading={checking} onPress={testConnection} tone="secondary" />
          </View>
          <View style={styles.buttonCell}>
            <ActionButton label={t('sync.now')} loading={syncing} onPress={syncNow} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.messageTitle}>{t('sync.latest')}</Text>
        <Text style={styles.message}>{message}</Text>
      </Card>

      <SectionTitle>{t('sync.rules')}</SectionTitle>
      <View style={styles.rules}>
        <Text style={styles.rule}>{t('sync.rule1')}</Text>
        <Text style={styles.rule}>{t('sync.rule2')}</Text>
        <Text style={styles.rule}>{t('sync.rule3')}</Text>
      </View>
    </Screen>
  );
}

function formatDate(value: string, locale: 'en' | 'fr') {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale === 'fr' ? 'fr-CD' : 'en');
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: spacing.md },
  metricCard: { flex: 1 },
  metricValue: { color: colors.primary, fontSize: 34, fontWeight: '900' },
  metricSmall: { color: colors.primary, fontSize: 15, fontWeight: '800', minHeight: 41 },
  metricLabel: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  buttonCell: { flex: 1 },
  messageTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  rules: { gap: spacing.sm, paddingHorizontal: 2 },
  rule: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});

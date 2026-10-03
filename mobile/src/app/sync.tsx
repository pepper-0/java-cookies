import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, FormField, Screen, SectionTitle, StatusBadge } from '@/components/ui';
import { checkBackendHealth, DEFAULT_API_URL } from '@/services/api';
import { syncPendingRecords } from '@/services/sync';
import { getPendingCount, getSetting, setSetting } from '@/storage/database';
import { colors, spacing } from '@/theme';

type ConnectionState = 'UNKNOWN' | 'ONLINE' | 'OFFLINE';

export default function SyncScreen() {
  const db = useSQLiteContext();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('UNKNOWN');
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('Test the backend connection before syncing.');

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
      Alert.alert('Invalid address', 'Enter a full address beginning with http:// or https://.');
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
      setMessage(`Backend replied: ${health.status}.`);
    } catch (error) {
      setConnection('OFFLINE');
      setMessage(error instanceof Error ? error.message : 'Backend is unreachable.');
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
        setMessage(`${result.synced} of ${result.attempted} records confirmed. ${result.errors[0]}`);
      } else if (result.attempted === 0) {
        setMessage('Backend is online. There are no pending records.');
      } else {
        setMessage(`Backend confirmed ${result.synced} record${result.synced === 1 ? '' : 's'}.`);
      }
    } catch (error) {
      setConnection('OFFLINE');
      setMessage(
        `${error instanceof Error ? error.message : 'Sync failed.'} Local records remain PENDING.`,
      );
      await reload();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Screen
      eyebrow="Offline Queue"
      title="Sync Status"
      subtitle="Records stay on this device until the prototype backend acknowledges them."
      right={connection === 'UNKNOWN' ? undefined : <StatusBadge status={connection} />}
    >
      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Card>
            <Text style={styles.metricValue}>{pendingCount}</Text>
            <Text style={styles.metricLabel}>Pending Records</Text>
          </Card>
        </View>
        <View style={styles.metricCard}>
          <Card>
            <Text style={styles.metricSmall}>{lastSyncAt ? formatDate(lastSyncAt) : 'Never'}</Text>
            <Text style={styles.metricLabel}>Last Confirmed Sync</Text>
          </Card>
        </View>
      </View>

      <Card>
        <FormField
          autoCapitalize="none"
          autoCorrect={false}
          hint="Android emulator default: http://10.0.2.2:8000. For a phone, use this computer's LAN IP."
          keyboardType="url"
          label="Backend address"
          onChangeText={(value) => {
            setApiUrl(value);
            setConnection('UNKNOWN');
          }}
          value={apiUrl}
        />
        <View style={styles.buttonRow}>
          <View style={styles.buttonCell}>
            <ActionButton label="Test connection" loading={checking} onPress={testConnection} tone="secondary" />
          </View>
          <View style={styles.buttonCell}>
            <ActionButton label="Sync now" loading={syncing} onPress={syncNow} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.messageTitle}>Latest Activity</Text>
        <Text style={styles.message}>{message}</Text>
      </Card>

      <SectionTitle>Queue Rules</SectionTitle>
      <View style={styles.rules}>
        <Text style={styles.rule}>• Saving never requires internet.</Text>
        <Text style={styles.rule}>• Failed requests do not delete local data.</Text>
        <Text style={styles.rule}>• Only a backend acknowledgement marks a record SYNCED.</Text>
      </View>
    </Screen>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

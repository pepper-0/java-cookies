import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrateDatabase } from '@/storage/database';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="limadrc.db" onInit={migrateDatabase}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="diagnose" options={{ title: 'Diagnose crop' }} />
        <Stack.Screen name="result" options={{ title: 'Diagnosis result' }} />
        <Stack.Screen name="farm" options={{ title: 'My farm' }} />
        <Stack.Screen name="sync" options={{ title: 'Sync status' }} />
      </Stack>
    </SQLiteProvider>
  );
}

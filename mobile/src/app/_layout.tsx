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
        <Stack.Screen name="diagnose" options={{ title: 'Diagnose Crop' }} />
        <Stack.Screen name="result" options={{ title: 'Diagnosis Result' }} />
        <Stack.Screen name="farm" options={{ title: 'My Farm' }} />
        <Stack.Screen name="sync" options={{ title: 'Sync Status' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </SQLiteProvider>
  );
}

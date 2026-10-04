import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { LocalizationProvider, useTranslation } from '@/localization';
import { migrateDatabase } from '@/storage/database';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="limadrc.db" onInit={migrateDatabase}>
      <LocalizationProvider>
        <AppStack />
      </LocalizationProvider>
    </SQLiteProvider>
  );
}

function AppStack() {
  const { t } = useTranslation();

  return (
    <>
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
        <Stack.Screen name="diagnose" options={{ title: t('nav.diagnose') }} />
        <Stack.Screen name="result" options={{ title: t('nav.result') }} />
        <Stack.Screen name="farm" options={{ title: t('nav.farm') }} />
        <Stack.Screen name="sync" options={{ title: t('nav.sync') }} />
        <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
        <Stack.Screen name="market-prices" options={{ title: t('nav.market') }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

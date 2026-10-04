import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen, SectionTitle } from '@/components/ui';
import { getCropLabel } from '@/constants/profile-options';
import { useTranslation } from '@/localization';
import {
  marketCrops,
  type MarketCrop,
  type MarketPriceFeed,
  pullMarketPrices,
} from '@/services/market-prices';
import { colors, radius, spacing } from '@/theme';

type CropFilter = 'all' | MarketCrop;

const filters: CropFilter[] = ['all', ...marketCrops];

export default function MarketPricesScreen() {
  const { locale, t } = useTranslation();
  const [feed, setFeed] = useState<MarketPriceFeed | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<CropFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPrices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setFeed(await pullMarketPrices());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('market.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;

    pullMarketPrices()
      .then((nextFeed) => {
        if (!active) return;
        setFeed(nextFeed);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : t('market.loadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  const visiblePrices = useMemo(
    () => feed?.prices.filter((price) => selectedCrop === 'all' || price.crop === selectedCrop) ?? [],
    [feed, selectedCrop],
  );

  return (
    <Screen
      eyebrow={t('market.eyebrow')}
      right={<DemoBadge label={t('market.demoBadge')} />}
      subtitle={t('market.subtitle')}
      title={t('market.title')}
    >
      <Card>
        <Text style={styles.noticeTitle}>{t('market.demoNoticeTitle')}</Text>
        <Text style={styles.noticeBody}>{t('market.demoNoticeBody')}</Text>
      </Card>

      <SectionTitle>{t('market.cropFilter')}</SectionTitle>
      <View style={styles.filters}>
        {filters.map((filter) => {
          const selected = filter === selectedCrop;
          const label = filter === 'all'
            ? t('market.allCrops')
            : getCropLabel(capitalize(filter), t);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={filter}
              onPress={() => setSelectedCrop(filter)}
              style={({ pressed }) => [
                styles.filter,
                selected && styles.filterSelected,
                pressed && styles.filterPressed,
              ]}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Card>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.centeredText}>{t('market.loading')}</Text>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card>
          <Text style={styles.errorTitle}>{t('market.loadError')}</Text>
          <Text style={styles.noticeBody}>{error}</Text>
          <ActionButton label={t('market.tryAgain')} onPress={loadPrices} tone="secondary" />
        </Card>
      ) : null}

      {!loading && !error && feed ? (
        <>
          <View style={styles.feedMeta}>
            <Text style={styles.metaText}>
              {t('market.observed', { date: formatDate(feed.observedOn, locale) })}
            </Text>
            <Text style={styles.metaText}>
              {t('market.pulled', { time: formatTime(feed.pulledAt, locale) })}
            </Text>
          </View>

          {visiblePrices.length > 0 ? visiblePrices.map((price) => (
            <Card key={price.id}>
              <View style={styles.priceRow}>
                <View style={styles.priceCopy}>
                  <Text style={styles.cropName}>{getCropLabel(capitalize(price.crop), t)}</Text>
                  <Text style={styles.marketName}>{price.market} · {price.province}</Text>
                </View>
                <View style={styles.amountWrap}>
                  <Text style={styles.amount}>{formatAmount(price.amount, locale)}</Text>
                  <Text style={styles.unit}>{feed.currency} / {t('market.kilogram')}</Text>
                </View>
              </View>
            </Card>
          )) : (
            <Card><Text style={styles.centeredText}>{t('market.empty')}</Text></Card>
          )}

          <ActionButton label={t('market.refresh')} onPress={loadPrices} tone="secondary" />
        </>
      ) : null}
    </Screen>
  );
}

function DemoBadge({ label }: { label: string }) {
  return (
    <View style={styles.demoBadge}>
      <Text style={styles.demoBadgeText}>{label}</Text>
    </View>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAmount(value: number, locale: 'en' | 'fr') {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CD' : 'en-CD', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string, locale: 'en' | 'fr') {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale === 'fr' ? 'fr-CD' : 'en-CD', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

function formatTime(value: string, locale: 'en' | 'fr') {
  return new Date(value).toLocaleTimeString(locale === 'fr' ? 'fr-CD' : 'en-CD', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  demoBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  demoBadgeText: { color: colors.warning, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  noticeTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  noticeBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPressed: { opacity: 0.78 },
  filterText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  filterTextSelected: { color: colors.white },
  centeredText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  errorTitle: { color: colors.danger, fontSize: 16, fontWeight: '800' },
  feedMeta: { gap: 3 },
  metaText: { color: colors.textMuted, fontSize: 12 },
  priceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  priceCopy: { flex: 1, gap: 4 },
  cropName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  marketName: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  amountWrap: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    minWidth: 104,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amount: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  unit: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
});

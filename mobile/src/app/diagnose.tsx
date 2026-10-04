import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen } from '@/components/ui';
import { useTranslation } from '@/localization';
import { classifyImage } from '@/ml/classifier';
import { colors, radius, spacing } from '@/theme';

export default function DiagnoseScreen() {
  const { t } = useTranslation();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const handleSelectedUri = useCallback((uri: string) => {
    setImageUri(uri);
  }, []);

  useEffect(() => {
    ImagePicker.getPendingResultAsync().then((pending) => {
      if (pending && 'assets' in pending && !pending.canceled && pending.assets?.[0]) {
        handleSelectedUri(pending.assets[0].uri);
      }
    });
  }, [handleSelectedUri]);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('diagnose.cameraPermission'), t('diagnose.cameraPermissionBody'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await handleSelectedUri(result.assets[0].uri);
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await handleSelectedUri(result.assets[0].uri);
  }

  async function analyze() {
    if (!imageUri) return;
    try {
      setWorking(true);
      const diagnosis = await classifyImage(imageUri);
      router.push({
        pathname: '/result',
        params: {
          imageUri,
          diagnosisId: diagnosis.diagnosis_id,
          crop: diagnosis.crop,
          confidence: String(diagnosis.confidence),
        },
      });
    } catch (error) {
      Alert.alert(t('diagnose.failed'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen
      eyebrow={t('diagnose.eyebrow')}
      title={t('diagnose.title')}
      subtitle={t('diagnose.subtitle')}
    >
      <Card>
        {imageUri ? (
          <Image accessibilityLabel={t('diagnose.selectedCrop')} source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyIcon}>+</Text>
            <Text style={styles.emptyTitle}>{t('diagnose.noPhoto')}</Text>
            <Text style={styles.emptyBody}>{t('diagnose.noPhotoBody')}</Text>
          </View>
        )}
        <View style={styles.buttonRow}>
          <View style={styles.buttonCell}>
            <ActionButton disabled={working} label={t('diagnose.takePhoto')} onPress={takePhoto} tone="secondary" />
          </View>
          <View style={styles.buttonCell}>
            <ActionButton disabled={working} label={t('diagnose.choosePhoto')} onPress={choosePhoto} tone="quiet" />
          </View>
        </View>
      </Card>

      <ActionButton
        disabled={!imageUri}
        label={t('diagnose.run')}
        loading={working}
        onPress={analyze}
      />
      <Text style={styles.privacy}>{t('diagnose.privacy')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { aspectRatio: 4 / 3, borderRadius: radius.sm, width: '100%' },
  emptyPreview: {
    alignItems: 'center', aspectRatio: 4 / 3, backgroundColor: colors.surfaceMuted,
    borderColor: colors.border, borderRadius: radius.sm, borderStyle: 'dashed', borderWidth: 1.5,
    justifyContent: 'center', padding: spacing.lg,
  },
  emptyIcon: { color: colors.primary, fontSize: 40, fontWeight: '300' },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: spacing.sm },
  emptyBody: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  buttonCell: { flex: 1 },
  privacy: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});

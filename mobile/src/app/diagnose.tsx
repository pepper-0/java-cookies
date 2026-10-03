import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Screen } from '@/components/ui';
import { classifyImage } from '@/ml/classifier';
import { persistObservationImage } from '@/storage/images';
import { colors, radius, spacing } from '@/theme';

export default function DiagnoseScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    ImagePicker.getPendingResultAsync().then((pending) => {
      if (pending && 'assets' in pending && !pending.canceled && pending.assets?.[0]) {
        handleSelectedUri(pending.assets[0].uri);
      }
    });
  }, []);

  async function handleSelectedUri(uri: string) {
    try {
      setWorking(true);
      setImageUri(await persistObservationImage(uri));
    } catch (error) {
      Alert.alert('Could not keep this photo', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access to take a crop photo.');
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
      Alert.alert('Diagnosis failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen
      eyebrow="Step 1 of 2"
      title="Add a Clear Crop Photo"
      subtitle="Photograph the affected leaves in good light. The current checkpoint returns a mock cassava result."
    >
      <Card>
        {imageUri ? (
          <Image accessibilityLabel="Selected crop" source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyIcon}>+</Text>
            <Text style={styles.emptyTitle}>No Photo Selected</Text>
            <Text style={styles.emptyBody}>Use the camera or choose an existing image.</Text>
          </View>
        )}
        <View style={styles.buttonRow}>
          <View style={styles.buttonCell}>
            <ActionButton disabled={working} label="Take photo" onPress={takePhoto} tone="secondary" />
          </View>
          <View style={styles.buttonCell}>
            <ActionButton disabled={working} label="Choose photo" onPress={choosePhoto} tone="quiet" />
          </View>
        </View>
      </Card>

      <ActionButton
        disabled={!imageUri}
        label="Run mock diagnosis"
        loading={working}
        onPress={analyze}
      />
      <Text style={styles.privacy}>The photo stays on this device during Checkpoint 1.</Text>
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

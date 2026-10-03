import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

type ScreenProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  subtitle?: string;
  right?: ReactNode;
  includeTopInset?: boolean;
}>;

export function Screen({
  children,
  title,
  eyebrow,
  subtitle,
  right,
  includeTopInset = false,
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={includeTopInset ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.screenContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'quiet';
};

export function ActionButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'primary',
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.buttonPrimary,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'quiet' && styles.buttonQuiet,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            tone === 'primary' ? styles.buttonTextPrimary : styles.buttonTextSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

export function FormField({ label, hint, ...props }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        {...props}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function StatusBadge({ status }: { status: 'PENDING' | 'SYNCED' | 'ONLINE' | 'OFFLINE' }) {
  const positive = status === 'SYNCED' || status === 'ONLINE';
  return (
    <View style={[styles.badge, positive ? styles.badgeSuccess : styles.badgeWarning]}>
      <View style={[styles.badgeDot, positive ? styles.dotSuccess : styles.dotWarning]} />
      <Text style={[styles.badgeText, positive ? styles.textSuccess : styles.textWarning]}>
        {status}
      </Text>
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', lineHeight: 38 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, maxWidth: 560 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.sm,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1.5 },
  buttonQuiet: { backgroundColor: colors.surfaceMuted },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  buttonTextPrimary: { color: colors.white },
  buttonTextSecondary: { color: colors.primary },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  fieldHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeSuccess: { backgroundColor: colors.successSoft },
  badgeWarning: { backgroundColor: colors.warningSoft },
  badgeDot: { borderRadius: 4, height: 8, width: 8 },
  dotSuccess: { backgroundColor: colors.success },
  dotWarning: { backgroundColor: colors.warning },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  textSuccess: { color: colors.success },
  textWarning: { color: colors.warning },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: spacing.sm },
});

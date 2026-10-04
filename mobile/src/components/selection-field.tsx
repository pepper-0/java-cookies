import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/localization';
import { colors, radius, spacing } from '@/theme';

export type SelectOption = {
  label: string;
  value: string;
};

type SharedProps = {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  disabled?: boolean;
};

type SelectFieldProps = SharedProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SelectField({
  label,
  options,
  value,
  onChange,
  hint,
  disabled = false,
  placeholder,
}: SelectFieldProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const displayedPlaceholder = placeholder ?? t('common.selectOption');

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}: ${selectedLabel ?? t('common.notSelected')}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded }}
        disabled={disabled}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [
          styles.trigger,
          expanded && styles.triggerExpanded,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.triggerText, !selectedLabel && styles.placeholder]}>
          {selectedLabel ?? displayedPlaceholder}
        </Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View accessibilityRole="radiogroup" style={styles.options}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setExpanded(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
                <Text style={[styles.selectionMark, selected && styles.selectionMarkSelected]}>
                  {selected ? '●' : '○'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type MultiSelectFieldProps = SharedProps & {
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
};

export function MultiSelectField({
  label,
  options,
  values,
  onChange,
  hint,
  disabled = false,
  placeholder,
}: MultiSelectFieldProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  function toggleValue(value: string) {
    const nextValues = values.includes(value)
      ? values.filter((selectedValue) => selectedValue !== value)
      : [...values, value];
    onChange(options.filter((option) => nextValues.includes(option.value)).map((option) => option.value));
  }

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}: ${selectedLabels.join(', ') || t('common.noneSelected')}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded }}
        disabled={disabled}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [
          styles.trigger,
          expanded && styles.triggerExpanded,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.triggerText, selectedLabels.length === 0 && styles.placeholder]}>
          {selectedLabels.join(', ') || placeholder || t('common.selectOneOrMore')}
        </Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.options}>
          {options.map((option) => {
            const selected = values.includes(option.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => toggleValue(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
                <Text style={[styles.selectionMark, selected && styles.selectionMarkSelected]}>
                  {selected ? '✓' : ''}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded(false)}
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          >
            <Text style={styles.doneText}>{t('common.done')}</Text>
          </Pressable>
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  trigger: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  triggerExpanded: { borderColor: colors.primary },
  triggerText: { color: colors.text, flex: 1, fontSize: 16, lineHeight: 22 },
  placeholder: { color: colors.textMuted },
  chevron: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  options: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
  },
  optionSelected: { backgroundColor: colors.successSoft },
  optionText: { color: colors.text, flex: 1, fontSize: 15 },
  optionTextSelected: { color: colors.primary, fontWeight: '800' },
  selectionMark: {
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    color: colors.white,
    fontSize: 12,
    height: 22,
    lineHeight: 20,
    textAlign: 'center',
    width: 22,
  },
  selectionMarkSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.white,
  },
  doneButton: { alignItems: 'center', padding: 13 },
  doneText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});

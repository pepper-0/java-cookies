export const cropOptions = ['Maize', 'Cassava', 'Rice', 'Other'] as const;

export const languageOptions = [
  'English',
  'French',
  'Lingala',
  'Swahili',
  'Tshiluba',
  'Kikongo',
] as const;

export const cropSelectOptions = cropOptions.map((value) => ({ label: value, value }));
export const languageSelectOptions = languageOptions.map((value) => ({ label: value, value }));

export function normalizeLanguage(value: string | null | undefined, fallback = 'French') {
  if (!value) return fallback;
  if (value.trim().toLocaleLowerCase() === 'français') return 'French';

  return languageOptions.find(
    (language) => language.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
  ) ?? fallback;
}

export function parsePrimaryCrops(value: string | null | undefined) {
  if (!value?.trim()) return { selectedCrops: [] as string[], otherCrop: '' };

  const selected = new Set<string>();
  const customCrops: string[] = [];

  value.split(',').forEach((rawCrop) => {
    const crop = rawCrop.trim();
    if (!crop) return;

    const otherMatch = crop.match(/^other\s*:\s*(.+)$/i);
    if (otherMatch) {
      selected.add('Other');
      customCrops.push(otherMatch[1].trim());
      return;
    }

    const supportedCrop = cropOptions.find(
      (option) => option.toLocaleLowerCase() === crop.toLocaleLowerCase(),
    );
    if (supportedCrop) {
      selected.add(supportedCrop);
      return;
    }

    selected.add('Other');
    customCrops.push(crop);
  });

  return {
    selectedCrops: cropOptions.filter((crop) => selected.has(crop)),
    otherCrop: customCrops.join(', '),
  };
}

export function serializePrimaryCrops(selectedCrops: readonly string[], otherCrop: string) {
  return cropOptions
    .filter((crop) => selectedCrops.includes(crop))
    .flatMap((crop) => {
      if (crop !== 'Other') return [crop];
      return otherCrop.trim() ? [`Other: ${otherCrop.trim()}`] : [];
    })
    .join(', ');
}

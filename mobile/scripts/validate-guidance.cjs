const assert = require('node:assert/strict');

const catalogs = [
  require('../src/ml/guidance.en.json'),
  require('../src/ml/guidance.fr.json'),
];
const labels = require('../src/ml/labels.json');

const classIds = Object.values(labels);
const expectedOutputIds = [
  'cassava_bacterial_blight',
  'cassava_brown_streak_disease',
  'cassava_healthy',
  'cassava_mosaic_disease',
  'maize_common_rust',
  'maize_healthy',
  'maize_northern_leaf_blight',
  'maize_streak_disease',
  'rice_blast',
  'rice_healthy',
];
const mappedDiagnosisIds = [...new Set(classIds)];
const fallbackDiagnosisIds = ['cassava_unknown', 'maize_unknown', 'rice_unknown'];
const requiredGuidanceIds = [...mappedDiagnosisIds, ...fallbackDiagnosisIds];

assert.deepEqual(catalogs.map((catalog) => catalog.locale), ['en', 'fr']);
assert.deepEqual(
  Object.keys(labels),
  expectedOutputIds.map((_, index) => String(index)),
  'Model labels must define consecutive output indexes 0 through 9.',
);
assert.deepEqual(
  classIds,
  expectedOutputIds,
  'Model labels must preserve the trained 10-output order.',
);

for (const guidance of catalogs) {
  for (const diagnosisId of requiredGuidanceIds) {
    assert.ok(
      guidance.diagnoses[diagnosisId],
      `${guidance.locale} guidance must include model or fallback diagnosis ${diagnosisId}.`,
    );
  }

  validateDiagnosis(guidance.template, `${guidance.locale}.template`);
  validateDiagnosis(guidance.fallback, `${guidance.locale}.fallback`);

  for (const [diagnosisId, diagnosis] of Object.entries(guidance.diagnoses)) {
    validateDiagnosis(diagnosis, `${guidance.locale}.${diagnosisId}`);
    assert.equal(
      diagnosis.id,
      diagnosisId,
      `${guidance.locale}.${diagnosisId}.id must match its lookup key.`,
    );
  }
}

const [englishGuidance, frenchGuidance] = catalogs;
assert.equal(frenchGuidance.version, englishGuidance.version, 'Catalog versions must match.');
assert.deepEqual(
  Object.keys(frenchGuidance.diagnoses),
  Object.keys(englishGuidance.diagnoses),
  'English and French catalogs must contain the same diagnosis IDs and order.',
);

for (const diagnosisId of Object.keys(englishGuidance.diagnoses)) {
  const englishDiagnosis = englishGuidance.diagnoses[diagnosisId];
  const frenchDiagnosis = frenchGuidance.diagnoses[diagnosisId];
  assert.equal(
    frenchDiagnosis.symptoms.length,
    englishDiagnosis.symptoms.length,
    `${diagnosisId} symptom counts must match across locales.`,
  );
  assert.equal(
    frenchDiagnosis.treatments.length,
    englishDiagnosis.treatments.length,
    `${diagnosisId} treatment counts must match across locales.`,
  );
  assert.equal(frenchDiagnosis.type, englishDiagnosis.type, `${diagnosisId} types must match.`);
  frenchDiagnosis.treatments.forEach((treatment, index) => {
    assert.equal(
      treatment.category,
      englishDiagnosis.treatments[index].category,
      `${diagnosisId} treatment categories must match across locales.`,
    );
  });
}

console.log(
  `Validated ${classIds.length} model outputs and ${fallbackDiagnosisIds.length} crop fallbacks ` +
    `against ${Object.keys(englishGuidance.diagnoses).length} guidance records in ${catalogs.length} locales.`,
);

function validateDiagnosis(diagnosis, path) {
  for (const field of ['id', 'name', 'type', 'diagnosisMessage', 'voiceMessage']) {
    assert.equal(typeof diagnosis[field], 'string', `${path}.${field} must be a string.`);
    assert.ok(diagnosis[field].length > 0, `${path}.${field} must not be empty.`);
  }

  assert.ok(Array.isArray(diagnosis.symptoms), `${path}.symptoms must be an array.`);
  diagnosis.symptoms.forEach((symptom, index) => {
    assert.equal(typeof symptom, 'string', `${path}.symptoms[${index}] must be a string.`);
    assert.ok(symptom.length > 0, `${path}.symptoms[${index}] must not be empty.`);
  });

  assert.ok(Array.isArray(diagnosis.treatments), `${path}.treatments must be an array.`);
  diagnosis.treatments.forEach((treatment, index) => {
    const treatmentPath = `${path}.treatments[${index}]`;
    for (const field of ['name', 'category', 'description']) {
      assert.equal(typeof treatment[field], 'string', `${treatmentPath}.${field} must be a string.`);
      assert.ok(treatment[field].length > 0, `${treatmentPath}.${field} must not be empty.`);
    }

    assert.ok(
      treatment.costLevel === null || typeof treatment.costLevel === 'string',
      `${treatmentPath}.costLevel must be a string or null.`,
    );
    assert.ok(
      treatment.estimatedCost === null ||
        typeof treatment.estimatedCost === 'string' ||
        typeof treatment.estimatedCost === 'number',
      `${treatmentPath}.estimatedCost must be a string, number, or null.`,
    );

    if ('requiresLocalVerification' in treatment) {
      assert.equal(
        typeof treatment.requiresLocalVerification,
        'boolean',
        `${treatmentPath}.requiresLocalVerification must be a boolean.`,
      );
    }
  });

  if ('curativeTreatment' in diagnosis) {
    assert.ok(
      typeof diagnosis.curativeTreatment === 'boolean' || diagnosis.curativeTreatment === 'limited',
      `${path}.curativeTreatment must be a boolean or "limited".`,
    );
  }

  if ('additionalPhotoRecommended' in diagnosis) {
    assert.equal(
      typeof diagnosis.additionalPhotoRecommended,
      'string',
      `${path}.additionalPhotoRecommended must be a string.`,
    );
  }
}

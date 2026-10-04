const assert = require('node:assert/strict');

const guidance = require('../src/ml/guidance.json');
const labels = require('../src/ml/labels.json');

const classIds = Object.values(labels);
assert.deepEqual(
  Object.keys(guidance.diagnoses),
  classIds,
  'Guidance diagnoses must match the model class IDs and order.',
);

validateDiagnosis(guidance.template, 'template');
validateDiagnosis(guidance.fallback, 'fallback');

for (const [diagnosisId, diagnosis] of Object.entries(guidance.diagnoses)) {
  validateDiagnosis(diagnosis, diagnosisId);
  assert.equal(diagnosis.id, diagnosisId, `${diagnosisId}.id must match its lookup key.`);
}

console.log(`Validated ${classIds.length} diagnosis guidance records.`);

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

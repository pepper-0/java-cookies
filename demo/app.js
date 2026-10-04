const diagnoses = {
  cassava_mosaic_disease: {
    crop: 'Cassava',
    name: 'Cassava Mosaic Disease',
    type: 'Viral',
    confidence: 0.94,
    message: 'The cassava plant shows visual signs consistent with Cassava Mosaic Disease.',
    symptoms: [
      'Light and dark green mosaic patterns across the leaf',
      'Leaf curling or distortion',
      'Reduced leaf size and uneven growth',
    ],
    actions: [
      'Mark and monitor affected plants.',
      'Do not reuse cuttings from visibly affected plants.',
      'Ask a local extension agent before removing plants or choosing replacement material.',
    ],
    voice:
      'Your cassava may have Cassava Mosaic Disease. Avoid using cuttings from affected plants and ask a local extension agent about clean planting material.',
  },
  cassava_brown_streak_disease: {
    crop: 'Cassava',
    name: 'Cassava Brown Streak Disease',
    type: 'Viral',
    confidence: 0.91,
    message: 'The cassava plant shows visual signs consistent with Cassava Brown Streak Disease.',
    symptoms: [
      'Yellow or pale patches along leaf veins',
      'Brown streaks may appear on stems',
      'Roots may develop dry brown areas that are not visible from the leaf alone',
    ],
    actions: [
      'Inspect the stem and roots for additional symptoms.',
      'Keep cuttings from affected plants separate.',
      'Consult a local extension agent before replanting.',
    ],
    voice:
      'Your cassava may have Cassava Brown Streak Disease. Check the stems and roots, keep affected planting material separate, and request local advice before replanting.',
  },
  maize_northern_leaf_blight: {
    crop: 'Maize',
    name: 'Northern Leaf Blight',
    type: 'Fungal',
    confidence: 0.89,
    message: 'The maize plant shows visual signs consistent with Northern Leaf Blight.',
    symptoms: [
      'Long, cigar-shaped gray-green or tan lesions',
      'Lesions following the length of the leaf',
      'Large affected areas joining together as infection progresses',
    ],
    actions: [
      'Monitor nearby maize plants for similar lesions.',
      'Manage infected crop residue after harvest.',
      'Consider locally adapted resistant seed for the next planting.',
    ],
    voice:
      'Your maize may have Northern Leaf Blight. Monitor nearby plants, manage infected crop residue after harvest, and consider resistant seed for the next planting.',
  },
  cassava_healthy: {
    crop: 'Cassava',
    name: 'Healthy Cassava',
    type: 'Healthy',
    confidence: 0.96,
    message: 'No signs of the cassava diseases currently recognized by LimaDRC were detected in this sample.',
    symptoms: [
      'Leaf color appears broadly uniform',
      'No strong mosaic pattern or pronounced curling',
      'Normal visible leaf structure',
    ],
    actions: [
      'Continue routine field monitoring.',
      'Use clean tools and healthy planting material.',
      'Take another photo if new discoloration or distortion appears.',
    ],
    voice:
      'Your cassava appears healthy according to this demonstration. Continue routine monitoring and use healthy planting material.',
  },
  maize_healthy: {
    crop: 'Maize',
    name: 'Healthy Maize',
    type: 'Healthy',
    confidence: 0.95,
    message: 'No signs of the maize diseases currently recognized by LimaDRC were detected in this sample.',
    symptoms: [
      'Leaves appear mostly uniform green',
      'No major lesions, streaking, or rust-like pustules',
      'Normal visible leaf growth',
    ],
    actions: [
      'Continue routine field monitoring.',
      'Watch for new spots, streaks, or insect damage.',
      'Take another clear photo if symptoms develop.',
    ],
    voice:
      'Your maize appears healthy according to this demonstration. Continue monitoring for unusual spots, streaks, or insect damage.',
  },
};

const sampleButtons = [...document.querySelectorAll('.sample-option')];
const photoInput = document.querySelector('#photo-upload');
const selectedPhoto = document.querySelector('#selected-photo');
const analyzeButton = document.querySelector('#analyze-button');
const photoStage = document.querySelector('.photo-stage');
const photoLabel = document.querySelector('#photo-label-text');
const resultCard = document.querySelector('#result-card');
const listenButton = document.querySelector('#listen-button');

let selectedDiagnosisId = 'cassava_mosaic_disease';
let uploadedPhotoUrl = null;
let analyzing = false;

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  listenButton.classList.remove('speaking');
  listenButton.querySelector('span').textContent = 'Listen to guidance';
}

function resetResult() {
  stopSpeech();
  resultCard.classList.remove('visible');
  resultCard.setAttribute('aria-hidden', 'true');
  photoLabel.textContent = 'Ready to analyze';
}

function chooseSample(button) {
  if (analyzing) return;

  sampleButtons.forEach((option) => {
    const selected = option === button;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-pressed', String(selected));
  });

  if (uploadedPhotoUrl) {
    URL.revokeObjectURL(uploadedPhotoUrl);
    uploadedPhotoUrl = null;
  }

  selectedDiagnosisId = button.dataset.diagnosis;
  selectedPhoto.src = button.dataset.image;
  selectedPhoto.alt = `${diagnoses[selectedDiagnosisId].crop} leaf selected for the demonstration`;
  photoInput.value = '';
  resetResult();
}

sampleButtons.forEach((button) => {
  button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
  button.addEventListener('click', () => chooseSample(button));
});

photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;

  if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
  uploadedPhotoUrl = URL.createObjectURL(file);
  selectedPhoto.src = uploadedPhotoUrl;
  selectedPhoto.alt = `Uploaded crop photo: ${file.name}`;
  selectedDiagnosisId = 'cassava_mosaic_disease';
  sampleButtons.forEach((button) => {
    button.classList.remove('selected');
    button.setAttribute('aria-pressed', 'false');
  });
  resetResult();
  photoLabel.textContent = 'Custom photo · scripted result';
});

function renderList(element, items) {
  element.replaceChildren(
    ...items.map((item) => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      return listItem;
    }),
  );
}

function showResult() {
  const result = diagnoses[selectedDiagnosisId];
  document.querySelector('#confidence-value').textContent = `${Math.round(result.confidence * 100)}% confidence`;
  document.querySelector('#crop-name').textContent = result.crop.toUpperCase();
  document.querySelector('#diagnosis-name').textContent = result.name;
  document.querySelector('#condition-type').textContent = result.type;
  document.querySelector('#diagnosis-message').textContent = result.message;
  renderList(document.querySelector('#symptom-list'), result.symptoms);
  renderList(document.querySelector('#action-list'), result.actions);

  resultCard.classList.add('visible');
  resultCard.setAttribute('aria-hidden', 'false');
  photoLabel.textContent = 'Analysis complete';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  resultCard.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
}

analyzeButton.addEventListener('click', () => {
  if (analyzing) return;

  analyzing = true;
  resetResult();
  analyzeButton.disabled = true;
  analyzeButton.classList.add('loading');
  photoStage.classList.add('analyzing');
  photoLabel.textContent = 'Scanning leaf patterns';

  window.setTimeout(() => {
    analyzing = false;
    analyzeButton.disabled = false;
    analyzeButton.classList.remove('loading');
    photoStage.classList.remove('analyzing');
    showResult();
  }, 1450);
});

listenButton.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) {
    listenButton.querySelector('span').textContent = 'Audio unavailable';
    return;
  }

  if (window.speechSynthesis.speaking) {
    stopSpeech();
    return;
  }

  const result = diagnoses[selectedDiagnosisId];
  const utterance = new SpeechSynthesisUtterance(
    `${result.name}. ${result.voice} Recommended next steps. ${result.actions.join(' ')}`,
  );
  utterance.lang = 'en-US';
  utterance.rate = 0.92;
  utterance.onend = stopSpeech;
  utterance.onerror = stopSpeech;

  listenButton.classList.add('speaking');
  listenButton.querySelector('span').textContent = 'Stop listening';
  window.speechSynthesis.speak(utterance);
});

window.addEventListener('beforeunload', () => {
  stopSpeech();
  if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
});

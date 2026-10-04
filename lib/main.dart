import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

void main() {
  runApp(const PlantApp());
}

// ─────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────

const Color forestGreen = Color(0xFF285943);
const Color leafGreen = Color(0xFF4E8B63);
const Color cream = Color(0xFFF8F5EC);
const Color warmOrange = Color(0xFFE69A45);
const Color darkText = Color(0xFF24332A);
const Color mutedText = Color(0xFF718077);

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────

class PlantApp extends StatelessWidget {
  const PlantApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Plant',
      theme: ThemeData(
        scaffoldBackgroundColor: cream,
        colorScheme: ColorScheme.fromSeed(
          seedColor: forestGreen,
        ),
        fontFamily: 'Arial',
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

// ─────────────────────────────────────────────
// OBSERVATION MODEL
// ─────────────────────────────────────────────

class Observation {
  final String crop, disease, region;
  final int confidence;
  final DateTime time;
  bool synced;
  Observation({required this.crop, required this.disease, required this.confidence,
    this.region = 'Kwilu', this.synced = false, DateTime? time})
      : time = time ?? DateTime.now();
}

const int confidenceThreshold = 65;

class Diagnosis {
  final String crop, disease;
  final int confidence;
  final List<String> steps;
  const Diagnosis(this.crop, this.disease, this.confidence, this.steps);
  bool get isHealthy => disease == 'Healthy';
  bool get isUncertain => confidence < confidenceThreshold;
}

class Report {
  final String summary;
  final List<String> doNow, thisWeek, prevention;
  final String getHelp;
  final bool aiGenerated;

  const Report({
    required this.summary,
    required this.doNow,
    required this.thisWeek,
    required this.prevention,
    required this.getHelp,
    this.aiGenerated = false,
  });
}

const knowledgeBase = <String, Report>{
  'Cassava Mosaic Disease': Report(
    summary:
        'Cassava Mosaic Disease is a virus spread by whiteflies and by planting infected cuttings. It lowers yield but can be managed.',
    doNow: [
      'Pull out and bury or burn clearly infected plants.',
      'Do not take cuttings from infected plants.',
    ],
    thisWeek: [
      'Walk the field and check neighboring plants for yellow-green patterned leaves.',
      'Mark suspicious plants so you can watch them.',
    ],
    prevention: [
      'Plant clean cuttings from healthy plants.',
      'Ask your extension office about resistant varieties.',
      'Remove weeds that host whiteflies.',
    ],
    getHelp:
        'If more than a few plants are affected, tell your extension officer.',
  ),
  'Healthy': Report(
    summary: 'This plant looks healthy.',
    doNow: ['No action needed.'],
    thisWeek: ['Check a few plants again.'],
    prevention: ['Use clean cuttings and keep weeds down.'],
    getHelp: 'If leaves change color or curl, take another photo.',
  ),
  'Maize Leaf Blight': Report(
    summary:
        'Maize Leaf Blight damages leaves and can reduce yield if it spreads through the field.',
    doNow: [
      'Remove badly affected leaves.',
      'Avoid spreading infected leaves with tools or hands.',
    ],
    thisWeek: [
      'Check neighboring maize plants for leaf lesions.',
      'Note where symptoms are worst so you can watch them.',
    ],
    prevention: [
      'Rotate crops next season.',
      'Avoid working in the field when leaves are wet.',
      'Keep fields clean and remove infected residue.',
    ],
    getHelp:
        'If symptoms spread quickly, ask your extension officer for support.',
  ),
  'Rice Blast': Report(
    summary:
        'Rice Blast can weaken the crop by damaging leaves and heads, especially in wet conditions.',
    doNow: [
      'Avoid too much nitrogen fertilizer.',
      'Remove badly affected plants or panicles where possible.',
    ],
    thisWeek: [
      'Walk the field and check for blast lesions on leaves.',
      'Watch for plants that look stressed after rain.',
    ],
    prevention: [
      'Keep water levels steady.',
      'Use resistant varieties when available.',
      'Avoid dense planting that keeps leaves wet.',
    ],
    getHelp: 'Report sudden spread to your extension officer.',
  ),
};

Report offlineReport(Diagnosis d) =>
    knowledgeBase[d.disease] ??
    Report(
      summary: d.disease,
      doNow: d.steps,
      thisWeek: const [],
      prevention: const [],
      getHelp: 'Ask your extension officer if unsure.',
    );

Future<Report?> generateAiReport(
  Diagnosis d,
  String region,
  String language,
) async {
  final base = offlineReport(d);
  try {
    final res = await http
        .post(
          Uri.parse('https://YOUR-BACKEND/report'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'crop': d.crop,
            'disease': d.disease,
            'confidence': d.confidence,
            'region': region,
            'language': language,
            'facts': {
              'summary': base.summary,
              'doNow': base.doNow,
              'thisWeek': base.thisWeek,
              'prevention': base.prevention,
              'getHelp': base.getHelp,
            },
          }),
        )
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) return null;
    final j = jsonDecode(res.body);
    return Report(
      summary: j['summary'],
      doNow: List<String>.from(j['doNow']),
      thisWeek: List<String>.from(j['thisWeek']),
      prevention: List<String>.from(j['prevention']),
      getHelp: j['getHelp'],
      aiGenerated: true,
    );
  } catch (_) {
    return null;
  }
}

// Fake for now. Swap the body for a real model later; the UI won't change.
Future<Diagnosis> classify(Uint8List bytes) async {
  await Future.delayed(const Duration(milliseconds: 900));
  const options = [
    Diagnosis('Cassava', 'Cassava Mosaic Disease', 94, [
      'Remove infected plants.',
      'Keep infected material away from healthy plants.',
      'Monitor nearby cassava plants for symptoms.',
    ]),
    Diagnosis('Maize', 'Maize Leaf Blight', 88, [
      'Remove badly affected leaves.',
      'Avoid working in the field when leaves are wet.',
      'Rotate crops next season.',
    ]),
    Diagnosis('Rice', 'Rice Blast', 81, [
      'Avoid too much nitrogen fertilizer.',
      'Keep water levels steady.',
      'Report to your extension officer.',
    ]),
    Diagnosis('Cassava', 'Healthy', 97, [
      'No action needed.',
      'Keep checking your plants regularly.',
    ]),
    Diagnosis('Unknown', 'Unclear', 48, []),
  ];
  return options[bytes.length % options.length];
}

// ─────────────────────────────────────────────
// HOME SCREEN
// ─────────────────────────────────────────────

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
  
}

class _HomeScreenState extends State<HomeScreen> {
  final List<Observation> observations = [];
  bool isOnline = false;
  final List<Observation> registry = []; // simulated extension-side inbox

  void toggleConnection() {
    final nextOnline = !isOnline;
    setState(() => isOnline = nextOnline);
    if (nextOnline) syncAll();
  }

  void syncAll() {
    final pending = observations.where((o) => !o.synced).toList();
    if (pending.isEmpty) return;
    setState(() {
      for (final o in pending) {
        o.synced = true;
        registry.insert(0, o);
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Observations synced')),
    );
}

  int get pendingCount =>
      observations.where((observation) => !observation.synced).length;

  void openScanner() async {
    final result = await Navigator.push<Observation>(
      context,
      MaterialPageRoute(
        builder: (context) => ScannerScreen(isOnline: isOnline),
      ),
    );

    if (result != null) {
      setState(() => observations.insert(0, result));
      if (isOnline) syncAll();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 10, 24, 30),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildScanCard(),
                    const SizedBox(height: 32),
                    _buildRecentHeader(),
                    const SizedBox(height: 12),
                    if (observations.isEmpty)
                      _buildEmptyState()
                    else
                      ...observations.map(
                        (observation) =>
                            _buildObservationCard(observation),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final bannerBg = isOnline ? const Color(0xFFE5F1E5) : const Color(0xFFFFF0DC);
    final bannerDot = isOnline ? leafGreen : warmOrange;
    final bannerTextColor = isOnline ? forestGreen : const Color(0xFF7A5328);
    final bannerText = isOnline
        ? 'Online — Observations synced'
        : pendingCount == 0
            ? 'Offline — No observations waiting'
            : 'Offline — $pendingCount observation${pendingCount == 1 ? '' : 's'} ready to sync';
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: forestGreen,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.eco_rounded,
                  color: Colors.white,
                  size: 26,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Plant',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: forestGreen,
                ),
              ),
              const Spacer(),
              IconButton(
                tooltip: isOnline ? 'Go offline (demo)' : 'Go online (demo)',
                onPressed: toggleConnection,
                icon: Icon(
                  isOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                  color: isOnline ? leafGreen : warmOrange,
                ),
              ),
              IconButton(
                tooltip: 'Extension view',
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => RegistryScreen(registry: registry),
                  ),
                ),
                icon: const Icon(Icons.hub_outlined, color: darkText),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 13,
            ),
            decoration: BoxDecoration(
              color: bannerBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: warmOrange.withValues(alpha: 0.25),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: bannerDot,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    bannerText,
                    style: TextStyle(
                      color: bannerTextColor,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScanCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: forestGreen,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.local_florist_rounded,
            color: Color(0xFFBBD9A9),
            size: 46,
          ),
          const SizedBox(height: 12),
          const Text(
            'Check a plant',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 7),
          const Text(
            'Take a photo to check cassava, maize, or rice.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFFDCE9DF),
              fontSize: 14,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              onPressed: openScanner,
              icon: const Icon(Icons.camera_alt_rounded),
              label: const Text(
                'TAKE PHOTO',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: forestGreen,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(17),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentHeader() {
    return Row(
      children: [
        const Text(
          'Recent observations',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: darkText,
          ),
        ),
        const Spacer(),
        if (observations.isNotEmpty)
          Text(
            '${observations.length}',
            style: const TextStyle(
              color: mutedText,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        vertical: 35,
        horizontal: 20,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
      ),
      child: const Column(
        children: [
          Icon(
            Icons.spa_outlined,
            size: 42,
            color: Color(0xFF9BAAA0),
          ),
          SizedBox(height: 12),
          Text(
            'No observations yet',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: darkText,
              fontSize: 16,
            ),
          ),
          SizedBox(height: 5),
          Text(
            'Take a photo of a plant to get started.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: mutedText,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildObservationCard(Observation observation) {
    final bool isHealthy = observation.disease == 'Healthy';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isHealthy
                  ? const Color(0xFFE5F1E5)
                  : const Color(0xFFFFEEE0),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(
              isHealthy
                  ? Icons.check_circle_outline_rounded
                  : Icons.warning_amber_rounded,
              color: isHealthy ? leafGreen : warmOrange,
              size: 26,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  observation.crop,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: darkText,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  observation.disease,
                  style: const TextStyle(
                    color: mutedText,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  observation.synced
                      ? '🟢 Synced'
                      : '🟠 Waiting to sync',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: observation.synced
                        ? leafGreen
                        : warmOrange,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () async {
              final tts = FlutterTts();
              await tts.setLanguage('en-US');
              await tts.speak(
                '${observation.crop}. ${observation.disease}.',
              );
            },
            icon: const Icon(Icons.volume_up_outlined),
            color: forestGreen,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
// REGISTRY SCREEN
// ─────────────────────────────────────────────

// class RegistryScreen extends StatelessWidget {
//   final List<Observation> registry;

//   const RegistryScreen({super.key, required this.registry});

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       backgroundColor: cream,
//       appBar: AppBar(
//         backgroundColor: cream,
//         elevation: 0,
//         title: const Text(
//           'Extension registry',
//           style: TextStyle(
//             color: darkText,
//             fontWeight: FontWeight.w700,
//           ),
//         ),
//       ),
//       body: registry.isEmpty
//           ? const Center(
//               child: Padding(
//                 padding: EdgeInsets.all(24),
//                 child: Text(
//                   'No synced observations yet.',
//                   textAlign: TextAlign.center,
//                   style: TextStyle(
//                     color: mutedText,
//                     fontSize: 15,
//                   ),
//                 ),
//               ),
//             )
//           : ListView.separated(
//               padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
//               itemCount: registry.length,
//               separatorBuilder: (_, __) => const SizedBox(height: 12),
//               itemBuilder: (context, index) {
//                 final observation = registry[index];
//                 return Container(
//                   padding: const EdgeInsets.all(16),
//                   decoration: BoxDecoration(
//                     color: Colors.white,
//                     borderRadius: BorderRadius.circular(18),
//                   ),
//                   child: Column(
//                     crossAxisAlignment: CrossAxisAlignment.start,
//                     children: [
//                       Text(
//                         observation.crop,
//                         style: const TextStyle(
//                           fontWeight: FontWeight.w700,
//                           color: darkText,
//                           fontSize: 16,
//                         ),
//                       ),
//                       const SizedBox(height: 4),
//                       Text(
//                         observation.disease,
//                         style: const TextStyle(
//                           color: mutedText,
//                           fontSize: 14,
//                         ),
//                       ),
//                       const SizedBox(height: 8),
//                       Text(
//                         'Confidence: ${observation.confidence}% • ${observation.region}',
//                         style: const TextStyle(
//                           color: forestGreen,
//                           fontSize: 12,
//                           fontWeight: FontWeight.w600,
//                         ),
//                       ),
//                     ],
//                   ),
//                 );
//               },
//             ),
//     );
//   }
// }

// ─────────────────────────────────────────────
// SCANNER SCREEN
// ─────────────────────────────────────────────

class ScannerScreen extends StatelessWidget {
  final bool isOnline;

  const ScannerScreen({super.key, required this.isOnline});

  Future<void> capture(BuildContext context) async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    final diagnosis = await classify(bytes);
    if (!context.mounted) return;
    final result = await Navigator.push<Observation>(
      context,
      MaterialPageRoute(
        builder: (_) => DiagnosisScreen(
          imageBytes: bytes,
          diagnosis: diagnosis,
          isOnline: isOnline,
        ),
      ),
    );
    if (result != null && context.mounted) Navigator.pop(context, result);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan a plant'),
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: Container(
                margin: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.7),
                    width: 2,
                  ),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.eco_rounded,
                        color: Colors.white54,
                        size: 75,
                      ),
                      SizedBox(height: 18),
                      Text(
                        'Camera preview',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 16,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Camera coming next',
                        style: TextStyle(
                          color: Colors.white38,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 10, 28, 35),
            child: Column(
              children: [
                const Text(
                  'Place a leaf clearly inside the frame.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 58,
                  child: ElevatedButton.icon(
                    onPressed: () => capture(context),
                    icon: const Icon(Icons.camera_alt_rounded),
                    label: const Text(
                      'CAPTURE',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: forestGreen,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
// DIAGNOSIS SCREEN
// ─────────────────────────────────────────────

class DiagnosisScreen extends StatefulWidget {
  final Uint8List imageBytes;
  final Diagnosis diagnosis;
  final bool isOnline;

  const DiagnosisScreen({
    super.key,
    required this.imageBytes,
    required this.diagnosis,
    required this.isOnline,
  });

  @override
  State<DiagnosisScreen> createState() => _DiagnosisScreenState();
}

class _DiagnosisScreenState extends State<DiagnosisScreen> {
  final FlutterTts tts = FlutterTts();

  Future<void> speakDiagnosis() async {
    await tts.setLanguage('en-US');
    await tts.setSpeechRate(0.45);
    if (widget.diagnosis.isUncertain) {
      await tts.speak('I am not sure. Please retake the photo in good light.');
      return;
    }
    await tts.speak(
      '${widget.diagnosis.disease} detected. ${widget.diagnosis.steps.join(' ')}',
    );
  }

  void saveObservation() {
    Navigator.pop(
      context,
      Observation(
        crop: widget.diagnosis.crop,
        disease: widget.diagnosis.disease,
        confidence: widget.diagnosis.confidence,
      ),
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Observation saved offline.'),
      ),
    );
  }

  Widget _buildUncertain() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF0DC),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.help_outline_rounded, color: warmOrange, size: 36),
          const SizedBox(height: 12),
          const Text(
            'Not sure about this one',
            style: TextStyle(
              color: darkText,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Retake the photo in good light. Hold the leaf flat and fill the frame.',
            style: TextStyle(color: darkText, fontSize: 15, height: 1.45),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.camera_alt_rounded),
              label: const Text(
                'RETAKE PHOTO',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: forestGreen,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(17),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        backgroundColor: cream,
        elevation: 0,
        title: const Text(
          'Diagnosis',
          style: TextStyle(
            color: darkText,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Image.memory(
                widget.imageBytes,
                height: 220,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(height: 25),
            if (widget.diagnosis.isUncertain)
              _buildUncertain()
            else ...[
              Text(
                widget.diagnosis.crop.toUpperCase(),
                style: const TextStyle(
                  color: mutedText,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                widget.diagnosis.disease,
                style: const TextStyle(
                  color: darkText,
                  fontSize: 27,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE4F0E4),
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: Text(
                      '${widget.diagnosis.confidence}% confidence',
                      style: const TextStyle(
                        color: forestGreen,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: speakDiagnosis,
                    icon: const Icon(Icons.volume_up_rounded),
                    color: forestGreen,
                    tooltip: 'Listen',
                  ),
                  const Text(
                    'Listen',
                    style: TextStyle(
                      color: forestGreen,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              const Text(
                'What to do',
                style: TextStyle(
                  color: darkText,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 13),
              ...widget.diagnosis.steps
                  .asMap()
                  .entries
                  .map((e) => _recommendation('${e.key + 1}', e.value)),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ReportScreen(
                        diagnosis: widget.diagnosis,
                        region: 'Kwilu',
                        isOnline: widget.isOnline,
                      ),
                    ),
                  ),
                  icon: const Icon(Icons.description_outlined),
                  label: const Text('VIEW FULL REPORT'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 58,
                child: ElevatedButton(
                  onPressed: saveObservation,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: forestGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  child: const Text(
                    'SAVE OBSERVATION',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _recommendation(String number, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: const Color(0xFFE5EFE5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  color: forestGreen,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: darkText,
                fontSize: 15,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    tts.stop();
    super.dispose();
  }
}

class ReportScreen extends StatefulWidget {
  final Diagnosis diagnosis;
  final String region;
  final bool isOnline;

  const ReportScreen({
    super.key,
    required this.diagnosis,
    required this.region,
    required this.isOnline,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  late Report report = offlineReport(widget.diagnosis);
  bool loading = false;

  Future<void> enhance() async {
    setState(() => loading = true);
    final r = await generateAiReport(widget.diagnosis, widget.region, 'en');
    if (!mounted) return;
    setState(() {
      loading = false;
      if (r != null) report = r;
    });
    if (r == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not reach AI. Showing saved report.')),
      );
    }
  }

  Widget _section(String title, List<String> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: darkText,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          ...items.map(
            (t) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 3),
                    child: Icon(
                      Icons.check_circle_rounded,
                      size: 18,
                      color: leafGreen,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      t,
                      style: const TextStyle(
                        color: darkText,
                        fontSize: 15,
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: cream,
        title: const Text(
          'Report',
          style: TextStyle(color: darkText, fontWeight: FontWeight.w700),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.diagnosis.disease,
              style: const TextStyle(
                color: darkText,
                fontSize: 26,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${widget.diagnosis.crop} · ${widget.region}',
              style: const TextStyle(color: mutedText),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: report.aiGenerated
                    ? const Color(0xFFE4F0E4)
                    : const Color(0xFFFFF0DC),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                report.aiGenerated ? 'AI-enhanced report' : 'Saved offline report',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              report.summary,
              style: const TextStyle(
                color: darkText,
                fontSize: 15,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            _section('Do now', report.doNow),
            _section('This week', report.thisWeek),
            _section('Prevention', report.prevention),
            _section('When to get help', [report.getHelp]),
            if (widget.isOnline && !report.aiGenerated)
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: loading ? null : enhance,
                  icon: loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.auto_awesome_rounded),
                  label: Text(loading ? 'WRITING...' : 'ENHANCE WITH AI'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: forestGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(17),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
// REGISTRY (EXTENSION SIDE) SCREEN
// ─────────────────────────────────────────────

class RegistryScreen extends StatelessWidget {
  final List<Observation> registry;
  const RegistryScreen({super.key, required this.registry});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: cream,
        title: const Text(
          'Extension registry',
          style: TextStyle(color: darkText, fontWeight: FontWeight.w700),
        ),
      ),
      body: registry.isEmpty
          ? const Center(
              child: Text(
                'No observations received yet.',
                style: TextStyle(color: mutedText),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: registry.length,
              itemBuilder: (context, i) {
                final o = registry[i];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(17),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.notifications_active_outlined,
                          color: forestGreen),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          'New observation — ${o.disease} — ${o.region}',
                          style: const TextStyle(
                            color: darkText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
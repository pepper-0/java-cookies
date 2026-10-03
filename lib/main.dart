import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

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
        builder: (context) => const ScannerScreen(),
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
              color: const Color(0xFFFFF0DC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: warmOrange.withOpacity(0.25),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: warmOrange,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    pendingCount == 0
                        ? 'Offline — No observations waiting'
                        : 'Offline — $pendingCount observation${pendingCount == 1 ? '' : 's'} ready to sync',
                    style: const TextStyle(
                      color: Color(0xFF7A5328),
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
  const ScannerScreen({super.key});

  // in ScannerScreen
  Future<void> showFakeDiagnosis(BuildContext context) async {
    final result = await Navigator.push<Observation>(
      context,
      MaterialPageRoute(builder: (_) => const DiagnosisScreen()),
    );
    if (result != null && context.mounted) {
      Navigator.pop(context, result);
    }
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
                    color: Colors.white.withOpacity(0.7),
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
                    onPressed: () => showFakeDiagnosis(context),
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
  const DiagnosisScreen({super.key});

  @override
  State<DiagnosisScreen> createState() => _DiagnosisScreenState();
}

class _DiagnosisScreenState extends State<DiagnosisScreen> {
  final FlutterTts tts = FlutterTts();

  Future<void> speakDiagnosis() async {
    await tts.setLanguage('en-US');
    await tts.setSpeechRate(0.45);
    await tts.speak(
      'Cassava Mosaic Disease detected. '
      'Remove infected plants and keep infected material '
      'away from healthy plants. Monitor nearby cassava plants.',
    );
  }

  void saveObservation() {
    Navigator.pop(
      context,
      Observation(
        crop: 'Cassava',
        disease: 'Cassava Mosaic Disease',
        confidence: 94,
      ),
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Observation saved offline.'),
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
            Container(
              width: double.infinity,
              height: 220,
              decoration: BoxDecoration(
                color: const Color(0xFFDCE8DC),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Center(
                child: Icon(
                  Icons.local_florist_rounded,
                  color: forestGreen,
                  size: 90,
                ),
              ),
            ),
            const SizedBox(height: 25),
            const Text(
              'CASSAVA',
              style: TextStyle(
                color: mutedText,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.4,
              ),
            ),
            const SizedBox(height: 7),
            const Text(
              'Cassava Mosaic Disease',
              style: TextStyle(
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
                  child: const Text(
                    '94% confidence',
                    style: TextStyle(
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
            _recommendation(
              '1',
              'Remove infected plants.',
            ),
            _recommendation(
              '2',
              'Keep infected material away from healthy plants.',
            ),
            _recommendation(
              '3',
              'Monitor nearby cassava plants for symptoms.',
            ),
            const SizedBox(height: 22),
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
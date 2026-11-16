import type {
  ApplioTabId,
  StudioState,
  VoiceModelProject,
} from '../types/studio.ts';

export const BRAND_NAME = 'NoRegretsRVC';
export const ACCENT_HEX = '#E51923';
export const APP_VERSION = '0.0';

export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'System Auto', label: 'System Auto' },
  { code: 'en_US', label: 'English' },
  { code: 'es_ES', label: 'Spanish (Español)' },
  { code: 'pt_BR', label: 'Portuguese (Português)' },
  { code: 'fr_FR', label: 'French (Français)' },
  { code: 'it_IT', label: 'Italian (Italiano)' },
  { code: 'nl_NL', label: 'Dutch (Nederlands)' },
  { code: 'ja_JP', label: 'Japanese (日本語)' },
  { code: 'zh_CN', label: 'Chinese (中文)' },
  { code: 'ar_SA', label: 'Arabic (العربية)' },
];

export const APPLIO_TAB_CATALOG: {
  id: ApplioTabId;
  label: string;
  description: string;
}[] = [
  {
    id: 'train',
    label: 'Training',
    description: 'Slice voice datasets, extract pitch contours, and train custom RVC checkpoints',
  },
  {
    id: 'models',
    label: 'Models',
    description: 'Fetch pretrained weights, drop local .pth/.index archives, and queue downloads',
  },
  {
    id: 'samples',
    label: 'Samples',
    description: 'Audition trained voices on reference clips and save converted sample exports',
  },
  {
    id: 'voice_blender',
    label: 'Voice Blender',
    description: 'Merge two compatible RVC checkpoints with weighted vocal blending',
  },
  {
    id: 'tts',
    label: 'TTS',
    description: 'Synthesize spoken lines with Edge-TTS and route them through your voice model',
  },
  {
    id: 'tensorboard',
    label: 'TensorBoard',
    description: 'Inspect mel loss curves, epoch timings, and parsed training logs',
  },
  {
    id: 'extra',
    label: 'Extra',
    description: 'Inspect checkpoint headers, run audio diagnostics, and inspect dataset stats',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Manage runtime precision, author tags, audio output, and Kaggle tunnels',
  },
];

export const DEFAULT_PROJECTS: VoiceModelProject[] = [
  {
    id: 'proj-default-32k',
    name: '',
    samplingRate: '32000',
    vocoder: 'HiFi-GAN',
    cpuCores: 4,
    gpuNumber: '0-1',
    gpuCount: 2,
    datasetPath: '',
    datasetCreator: false,
    audioCutting: 'Automatic',
    chunkLengthSec: 3,
    overlapLengthSec: 0.3,
    truncateSilenceEnabled: false,
    silenceDurationMs: 300,
    noiseFilter: false,
    loudnessNorm: false,
    loudnessTargetLufs: -14.0,
    pitchExtractor: 'rmvpe',
    embedder: 'contentvec',
    silentTrainingFiles: 0,
    batchSize: 2,
    saveEveryEpoch: 5,
    totalEpoch: 200,
    fp16: false,
    optimizer: 'AdamW',
    melLoss: 'Single-Scale',
    saveOnlyLatest: true,
    saveEveryWeights: true,
    pretrained: true,
    freshTraining: false,
    cacheDatasetGpu: false,
    checkpointing: false,
    shutdownAfterFinish: false,
    customPretrained: false,
    customPretrainedG: '',
    customPretrainedD: '',
    indexAlgorithm: 'Auto',
    overtrainingDetector: false,
    agreedTerms: true,
    preprocessOutput: 'The output information will be displayed here.',
    extractOutput: 'The output information will be displayed here.',
    trainingOutput: 'The output information will be displayed here.',
    exportPthFile: '',
    exportIndexFile: '',
    updatedAt: '2026-11-16T12:00:00.000Z',
  },
];

export const DEFAULT_STUDIO_STATE: StudioState = {
  activeSection: 'training',
  projects: DEFAULT_PROJECTS,
  activeProjectId: DEFAULT_PROJECTS[0].id,
  convertAudio: {
    voiceModel: '',
    indexFile: '',
    sourceMode: 'single',
    audioFileName: '',
    audioObjectUrl: '',
    batchFolderPath: '/kaggle/working/audio_inputs',
    pitch: 0,
    indexRate: 0.75,
    protect: 0.33,
    filterRadius: 3,
    volumeEnvelope: 0.25,
    splitAudio: false,
    autotune: false,
    formantShift: 0,
    outputFormat: 'wav',
    agreedTerms: true,
    conversionOutput: 'The output information will be displayed here.',
    hasConvertedSample: false,
    savedSamples: [],
  },
  generalSettings: {
    listFilterEnabled: false,
    rmvpeHighRegisterCorrection: false,
    rmvpeCorrectionMode: 'true_pitch',
    rmvpeF0CeilingHz: 1250,
    discordPresence: false,
    language: 'System Auto',
    versionStatus: `${BRAND_NAME} Beta version ${APP_VERSION} (newest version: ${APP_VERSION}).`,
  },
  trainingSettings: {
    modelAuthor: 'None',
    precision: 'fp32',
  },
  forkConfig: {
    customRepoUrl: '',
    activeTabs: {
      samples: true,
      train: true,
      voice_blender: true,
      tts: true,
      models: true,
      tensorboard: true,
      extra: true,
      settings: true,
    },
    tunnelMode: 'Gradio + Cloudflare',
    horizonId: '',
    randomAuthEnabled: true,
    embeddedTensorBoard: true,
    dualGpuT4: true,
    useUvVenv: true,
    verifyOnnxGpu: true,
    backupProvider: 'huggingface',
    hfRepoId: 'your-username/noregrets-rvc-checkpoints',
    hfPrivate: true,
    driveRemoteName: 'gdrive',
    driveFolderPath: 'ApplioExported',
    backupEveryEpochs: 25,
    backupOnBestLoss: true,
    backupScope: 'weights-and-index',
  },
  blender: {
    modelAPath: '',
    modelBPath: '',
    ratio: 0.5,
    samplingRate: '32000',
    outputName: '',
    f0Method: 'rmvpe',
  },
  ttsDefaults: {
    voice: 'en-US-AndrewNeural',
    modelPthPath: '',
    indexFilePath: '',
    rate: 0,
    pitch: 0,
    protect: 0.33,
    indexRate: 0.75,
  },
  downloadManifest: [
    {
      id: 'dl-base-rmvpe',
      name: 'RMVPE Pitch Model (Default)',
      url: 'https://huggingface.co/IAHispano/Applio/resolve/main/Resources/predictors/rmvpe.pt',
      category: 'pretrained',
    },
    {
      id: 'dl-contentvec',
      name: 'ContentVec Embedder',
      url: 'https://huggingface.co/IAHispano/Applio/resolve/main/Resources/embedders/contentvec/pytorch_model.bin',
      category: 'embedder',
    },
  ],
  importedModels: [],
  lastAnalysis: null,
};

export const SAMPLE_TRAINING_LOG = `Starting preprocess with 4 processes...
Preprocess completed in 6.58 seconds on 00:18:01 seconds of audio.
Model StudioDemo preprocessed successfully.
Starting pitch extraction on cuda:0, cuda:1 using rmvpe...
Pitch extraction completed in 28.99 seconds (411/411 files successful).
Starting embedding extraction with 4 cores on cuda:0, cuda:1...
Embedding extraction completed in 19.52 seconds.
Saved index file '/kaggle/working/program_ml/logs/StudioDemo/StudioDemo.index'
Using HiFi-GAN vocoder
Using AdamW optimizer
Using Single-Scale Mel loss function
Using Float32 for training.
StudioDemo | epoch=1 | step=104 | time=19:04:10 | training_speed=0:00:52
StudioDemo | epoch=2 | step=208 | time=19:04:59 | training_speed=0:00:49 | lowest_value=20.992 (epoch 1 and step 75)
StudioDemo | epoch=7 | step=728 | time=19:09:05 | training_speed=0:00:49 | lowest_value=18.901 (epoch 7 and step 653)
StudioDemo | epoch=13 | step=1352 | time=19:14:00 | training_speed=0:00:49 | lowest_value=16.913 (epoch 13 and step 1331)
StudioDemo | epoch=44 | step=4576 | time=19:39:40 | training_speed=0:00:49 | lowest_value=15.394 (epoch 44 and step 4506)
StudioDemo | epoch=51 | step=5304 | time=19:45:28 | training_speed=0:00:50 | lowest_value=14.616 (epoch 51 and step 5287)`;

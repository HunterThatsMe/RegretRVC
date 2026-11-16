export type SamplingRate = '32000' | '40000' | '48000';
export type Vocoder = 'HiFi-GAN' | 'MRF HiFi-GAN' | 'RefineGAN';
export type PitchExtractor = 'rmvpe' | 'fcpe' | 'swift-f0' | 'crepe';
export type EmbedderModel = 'contentvec' | 'spin' | 'chinese-hubert-base';
export type OptimizerType = 'AdamW' | 'RAdam';
export type MelLossType = 'Single-Scale' | 'Multi-Scale';
export type AudioCuttingMethod = 'Automatic' | 'Simple' | 'Skip';
export type IndexAlgorithm = 'Auto' | 'Faiss' | 'KMeans';
export type RmvpeCorrectionMode = 'true_pitch' | 'fold';
export type TrainingPrecision = 'fp32' | 'fp16';

export type ApplioTabId =
  | 'samples'
  | 'train'
  | 'voice_blender'
  | 'tts'
  | 'models'
  | 'tensorboard'
  | 'extra'
  | 'settings';

export type TunnelMode = 'Gradio + Cloudflare' | 'Horizon';
export type BackupProvider = 'huggingface' | 'google-drive' | 'both' | 'none';
export type BackupScope = 'weights-and-index' | 'full-checkpoints';

export interface VoiceModelProject {
  id: string;
  name: string;
  samplingRate: SamplingRate;
  vocoder: Vocoder;
  cpuCores: number;
  gpuNumber: string;
  gpuCount: 1 | 2;
  datasetPath: string;
  datasetCreator: boolean;
  audioCutting: AudioCuttingMethod;
  chunkLengthSec: number;
  overlapLengthSec: number;
  truncateSilenceEnabled: boolean;
  silenceDurationMs: number;
  noiseFilter: boolean;
  loudnessNorm: boolean;
  loudnessTargetLufs: number;
  pitchExtractor: PitchExtractor;
  embedder: EmbedderModel;
  silentTrainingFiles: number;
  batchSize: number;
  saveEveryEpoch: number;
  totalEpoch: number;
  fp16: boolean;
  optimizer: OptimizerType;
  melLoss: MelLossType;
  saveOnlyLatest: boolean;
  saveEveryWeights: boolean;
  pretrained: boolean;
  freshTraining: boolean;
  cacheDatasetGpu: boolean;
  checkpointing: boolean;
  shutdownAfterFinish: boolean;
  customPretrained: boolean;
  customPretrainedG: string;
  customPretrainedD: string;
  indexAlgorithm: IndexAlgorithm;
  overtrainingDetector: boolean;
  agreedTerms: boolean;
  preprocessOutput: string;
  extractOutput: string;
  trainingOutput: string;
  exportPthFile: string;
  exportIndexFile: string;
  updatedAt: string;
}

export interface GeneratedSampleItem {
  id: string;
  name: string;
  pitch: number;
  format: 'wav' | 'mp3' | 'flac';
  url: string;
  createdAt: string;
}

export interface ConvertAudioState {
  voiceModel: string;
  indexFile: string;
  sourceMode: 'single' | 'batch';
  audioFileName: string;
  audioObjectUrl: string;
  batchFolderPath: string;
  pitch: number;
  indexRate: number;
  protect: number;
  filterRadius: number;
  volumeEnvelope: number;
  splitAudio: boolean;
  autotune: boolean;
  formantShift: number;
  outputFormat: 'wav' | 'mp3' | 'flac';
  agreedTerms: boolean;
  conversionOutput: string;
  hasConvertedSample: boolean;
  savedSamples: GeneratedSampleItem[];
}

export interface ApplioGeneralSettings {
  listFilterEnabled: boolean;
  rmvpeHighRegisterCorrection: boolean;
  rmvpeCorrectionMode: RmvpeCorrectionMode;
  rmvpeF0CeilingHz: number;
  discordPresence: boolean;
  language: string;
  versionStatus: string;
}

export interface ApplioTrainingSettings {
  modelAuthor: string;
  precision: TrainingPrecision;
}

export interface ForkConfig {
  customRepoUrl: string;
  activeTabs: Record<ApplioTabId, boolean>;
  tunnelMode: TunnelMode;
  horizonId: string;
  randomAuthEnabled: boolean;
  embeddedTensorBoard: boolean;
  dualGpuT4: boolean;
  useUvVenv: boolean;
  verifyOnnxGpu: boolean;
  backupProvider: BackupProvider;
  hfRepoId: string;
  hfPrivate: boolean;
  driveRemoteName: string;
  driveFolderPath: string;
  backupEveryEpochs: number;
  backupOnBestLoss: boolean;
  backupScope: BackupScope;
}

export interface BlenderRecipe {
  modelAPath: string;
  modelBPath: string;
  ratio: number;
  samplingRate: SamplingRate;
  outputName: string;
  f0Method: PitchExtractor;
}

export interface TtsDefaults {
  voice: string;
  modelPthPath: string;
  indexFilePath: string;
  rate: number;
  pitch: number;
  protect: number;
  indexRate: number;
}

export interface DownloadModelItem {
  id: string;
  name: string;
  url: string;
  category: 'voice' | 'pretrained' | 'embedder';
}

export interface ImportedLocalModel {
  id: string;
  name: string;
  pthPath: string;
  indexPath: string;
}

export interface TrainingEpochPoint {
  epoch: number;
  step: number;
  speedSec: number;
  lowestLoss: number | null;
}

export interface TrainingAnalysis {
  speakerName: string;
  audioDurationLabel: string;
  segmentCount: number;
  epochsCompleted: number;
  latestStep: number;
  avgSpeedSec: number;
  lowestLoss: number | null;
  lowestLossEpoch: number | null;
  lowestLossStep: number | null;
  gpuDevices: string[];
  vocoderDetected: string;
  optimizerDetected: string;
  points: TrainingEpochPoint[];
}

export interface T4VramEstimate {
  estimatedVramGb: number;
  vramCapGb: number;
  fitStatus: 'Optimal' | 'Tight' | 'Risk of OOM';
  recommendedBatchSize: number;
  warnings: string[];
}

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export type StudioSection =
  | 'training'
  | 'samples'
  | 'blender'
  | 'tts'
  | 'models'
  | 'tensorboard'
  | 'settings';

export interface StudioState {
  activeSection: StudioSection;
  projects: VoiceModelProject[];
  activeProjectId: string;
  convertAudio: ConvertAudioState;
  generalSettings: ApplioGeneralSettings;
  trainingSettings: ApplioTrainingSettings;
  forkConfig: ForkConfig;
  blender: BlenderRecipe;
  ttsDefaults: TtsDefaults;
  downloadManifest: DownloadModelItem[];
  importedModels: ImportedLocalModel[];
  lastAnalysis: TrainingAnalysis | null;
}

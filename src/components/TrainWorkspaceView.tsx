import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Plus,
  RefreshCw,
  RotateCcw,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react';
import { ACCENT_HEX } from '../data/defaults';
import {
  AudioCuttingMethod,
  EmbedderModel,
  IndexAlgorithm,
  PitchExtractor,
  SamplingRate,
  Vocoder,
  VoiceModelProject,
} from '../types/studio';
import {
  buildTrainPipelineCommands,
  estimateT4VramUsage,
  sanitizeModelName,
} from '../utils/rvcTuning';
import { buildZipArchive } from '../utils/zipBuilder';
import { triggerBlobDownload } from '../utils/download';
import { NumberStepperInput } from './NumberStepperInput';

interface TrainWorkspaceViewProps {
  projects: VoiceModelProject[];
  activeProject: VoiceModelProject;
  onSelectProject: (id: string) => void;
  onUpdateProject: (updated: VoiceModelProject) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
}

const StepBadge: React.FC<{ num: number }> = ({ num }) => (
  <span
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white tabular-nums"
    style={{ backgroundColor: ACCENT_HEX }}
  >
    {num}
  </span>
);

function getGpuInfoLines(gpuNumber: string): string {
  const parts = gpuNumber
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'No GPU specified (CPU fallback).';
  return parts.map((id) => `${id}: Tesla T4 (14 GB)`).join('\n');
}

export const TrainWorkspaceView: React.FC<TrainWorkspaceViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onUpdateProject,
  onCreateProject,
  onDeleteProject,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewModelInput, setShowNewModelInput] = useState(false);
  const [showInfoBar, setShowInfoBar] = useState(false);

  const [step1AdvOpen, setStep1AdvOpen] = useState(false);
  const [step2AdvOpen, setStep2AdvOpen] = useState(false);
  const [step4AdvOpen, setStep4AdvOpen] = useState(false);
  const [cliPreviewOpen, setCliPreviewOpen] = useState(false);

  const [isTraining, setIsTraining] = useState(false);
  const [trainingElapsedSec, setTrainingElapsedSec] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState('');

  const vram = estimateT4VramUsage(activeProject);
  const safeName = sanitizeModelName(activeProject.name);
  const vramPct = Math.min(100, Math.round((vram.estimatedVramGb / vram.vramCapGb) * 100));

  useEffect(() => {
    if (!isTraining) return;
    const timer = setInterval(() => {
      setTrainingElapsedSec((prev) => Number((prev + 0.4).toFixed(1)));
      setCurrentEpoch((prev) => {
        const next = prev + 1;
        if (next >= activeProject.totalEpoch) {
          setIsTraining(false);
          onUpdateProject({
            ...activeProject,
            trainingOutput: `Model ${safeName} completed ${activeProject.totalEpoch} epochs on GPU ${activeProject.gpuNumber}. Saved logs/${safeName}/${safeName}_${activeProject.totalEpoch}e.pth`,
            exportPthFile: `logs/${safeName}/${safeName}_${activeProject.totalEpoch}e.pth`,
            exportIndexFile: `logs/${safeName}/${safeName}.index`,
          });
          return activeProject.totalEpoch;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [isTraining, activeProject, onUpdateProject, safeName]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateProject(newProjectName.trim());
    setNewProjectName('');
    setShowNewModelInput(false);
  };

  const handleRefreshDatasets = () => {
    setRefreshStatus('Refreshed Kaggle dataset directory & model registry.');
    setTimeout(() => setRefreshStatus(''), 2400);
  };

  const handlePreprocessDataset = () => {
    const dsPath = activeProject.datasetPath.trim();
    if (!dsPath) {
      onUpdateProject({
        ...activeProject,
        preprocessOutput: 'Enter a valid Kaggle dataset path before preprocessing.',
      });
      return;
    }
    const notes: string[] = [
      `cut=${activeProject.audioCutting}`,
      activeProject.truncateSilenceEnabled
        ? `truncate_silence=${activeProject.silenceDurationMs}ms`
        : 'truncate_silence=off',
      activeProject.noiseFilter ? 'noise_filter=on' : 'noise_filter=off',
      activeProject.loudnessNorm
        ? `loudness=${activeProject.loudnessTargetLufs} LUFS`
        : 'loudness=off',
    ];
    onUpdateProject({
      ...activeProject,
      preprocessOutput: `Model ${safeName} preprocessed successfully (${notes.join(', ')}).`,
    });
  };

  const handleExtractFeatures = () => {
    onUpdateProject({
      ...activeProject,
      extractOutput: `Model ${safeName} extracted successfully (${activeProject.pitchExtractor} + ${activeProject.embedder}, silent files: ${activeProject.silentTrainingFiles}).`,
    });
  };

  const handleToggleTraining = () => {
    if (!activeProject.agreedTerms) {
      onUpdateProject({
        ...activeProject,
        trainingOutput: 'Please agree to the terms of use before starting training.',
      });
      return;
    }
    if (isTraining) {
      setIsTraining(false);
      onUpdateProject({
        ...activeProject,
        trainingOutput: `Training stopped at epoch ${currentEpoch}/${activeProject.totalEpoch}. Latest weights kept in logs/${safeName}/.`,
      });
    } else {
      setCurrentEpoch(0);
      setTrainingElapsedSec(0);
      setIsTraining(true);
      onUpdateProject({
        ...activeProject,
        trainingOutput: `Training ${safeName} (${activeProject.vocoder}, ${activeProject.samplingRate} Hz, batch ${activeProject.batchSize}, ${
          activeProject.fp16 ? 'fp16' : 'fp32'
        }) started...`,
      });
    }
  };

  const handleGenerateIndex = () => {
    onUpdateProject({
      ...activeProject,
      trainingOutput: `Index file for model ${safeName} generated successfully (${activeProject.indexAlgorithm}).`,
      exportIndexFile: `logs/${safeName}/${safeName}.index`,
    });
  };

  const handleExportUploadZip = () => {
    const pthName =
      activeProject.exportPthFile || `logs/${safeName}/${safeName}_${activeProject.totalEpoch}e.pth`;
    const idxName = activeProject.exportIndexFile || `logs/${safeName}/${safeName}.index`;
    const manifest = JSON.stringify(
      {
        brand: 'NoRegretsRVC',
        modelName: safeName,
        samplingRate: activeProject.samplingRate,
        vocoder: activeProject.vocoder,
        pitchExtractor: activeProject.pitchExtractor,
        embedder: activeProject.embedder,
        pthFile: pthName,
        indexFile: idxName,
        destinationFolder: 'ApplioExported',
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const bytes = buildZipArchive([
      { path: `${safeName}/model_manifest.json`, content: manifest },
      { path: `${safeName}/train_pipeline.sh`, content: buildTrainPipelineCommands(activeProject) },
    ]);
    const buf = new Uint8Array(bytes).buffer;
    triggerBlobDownload(`${safeName}_ApplioExported.zip`, buf, 'application/zip');
    onUpdateProject({
      ...activeProject,
      trainingOutput: `Packaged ${safeName}_ApplioExported.zip for ApplioExported upload.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Training Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#FDF7F7] tracking-tight">
            Training
          </h2>
          <p className="text-sm text-[#DFBFC3] mt-1">
            Set up your voice dataset, extract acoustic features, run RVC training, and package your checkpoint.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowInfoBar((v) => !v)}
            aria-expanded={showInfoBar}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showInfoBar
                ? 'border-[#E51923] bg-[#200B0E] text-white'
                : 'border-[#47161D] bg-[#160709] text-[#DFBFC3] hover:text-white hover:border-[#E51923]'
            }`}
          >
            <Info className="h-3.5 w-3.5 text-[#E51923]" />
            <span>Model &amp; VRAM Info</span>
          </button>

          <a
            href="https://docs.applio.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#47161D] bg-[#160709] px-3 py-1.5 text-xs font-medium text-[#DFBFC3] hover:text-white hover:border-[#E51923] whitespace-nowrap shrink-0"
          >
            <span>User guide</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Optional Model & T4 VRAM Informational Bar */}
      {showInfoBar && (
        <section
          aria-label="Model and T4 VRAM information bar"
          className="rounded-xl border border-[#47161D] bg-[#160709] p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {projects.map((proj) => {
                const isSelected = proj.id === activeProject.id;
                return (
                  <div key={proj.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#200B0E] text-[#FDF7F7] border-[#E51923]'
                          : 'bg-[#100506] text-[#DFBFC3] border-[#47161D] hover:text-white'
                      }`}
                    >
                      {proj.name.trim() || 'Untitled Model'}
                    </button>
                    {projects.length > 1 && isSelected && (
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        aria-label={`Delete model ${proj.name.trim() || 'Untitled Model'}`}
                        className="ml-1 rounded-md p-1.5 text-[#AD8288] hover:text-[#FF2B35]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {showNewModelInput ? (
                <form onSubmit={handleCreateSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter model name..."
                    aria-label="New voice model name"
                    className="rounded-lg bg-[#100506] border border-[#47161D] px-3 py-1.5 text-xs text-[#FDF7F7] placeholder-[#AD8288]/50 focus:outline-none focus:border-[#E51923]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                    style={{ backgroundColor: ACCENT_HEX }}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewModelInput(false)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-[#DFBFC3] hover:text-white"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewModelInput(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#6D202B] px-3 py-1.5 text-xs font-medium text-[#DFBFC3] hover:text-white hover:border-[#E51923] whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Model</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 min-w-[260px] sm:min-w-[300px]">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5">
                  <span className="text-[#AD8288] whitespace-nowrap">
                    T4 VRAM ({activeProject.gpuCount === 2 ? 'Dual 16GB' : 'Single 16GB'}) · {activeProject.batchSize}×{activeProject.gpuCount} = {activeProject.batchSize * activeProject.gpuCount} eff. batch
                  </span>
                  <span
                    className={`font-mono font-semibold tabular-nums whitespace-nowrap ${
                      vram.fitStatus === 'Risk of OOM'
                        ? 'text-[#FF2B35]'
                        : vram.fitStatus === 'Tight'
                          ? 'text-[#F59E0B]'
                          : 'text-[#FDF7F7]'
                    }`}
                  >
                    {vram.estimatedVramGb} / {vram.vramCapGb} GB ({vram.fitStatus})
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#100506] overflow-hidden border border-[#47161D]">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${vramPct}%`,
                      backgroundColor:
                        vram.fitStatus === 'Risk of OOM'
                          ? '#FF2B35'
                          : vram.fitStatus === 'Tight'
                            ? '#F59E0B'
                            : ACCENT_HEX,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 1: Model Settings */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <StepBadge num={1} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Model Settings
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Give your voice project a name, select target sample fidelity, and assign your synthesis vocoder.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="train-model-name"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Model Name
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">
              Identifier used for saved checkpoints, index files, and log directories.
            </p>
            <input
              id="train-model-name"
              type="text"
              value={activeProject.name}
              placeholder="Enter model name (e.g. VocalModel-32k)"
              onChange={(e) =>
                onUpdateProject({ ...activeProject, name: e.target.value })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
            />
          </div>

          <div>
            <label
              htmlFor="train-sampling-rate"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Sampling Rate
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">
              Target audio resolution in Hz for preprocessed slices and model synthesis.
            </p>
            <select
              id="train-sampling-rate"
              value={activeProject.samplingRate}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  samplingRate: e.target.value as SamplingRate,
                })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="32000">32000</option>
              <option value="40000">40000</option>
              <option value="48000">48000</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="train-vocoder"
            className="block text-xs font-semibold text-[#FDF7F7]"
          >
            Vocoder
          </label>
          <p className="text-[11px] text-[#AD8288] mt-0.5 mb-2 leading-relaxed">
            Waveform synthesizer architecture: HiFi-GAN works across all RVC players; MRF HiFi-GAN boosts harmonic detail for Applio clients; RefineGAN maximizes clarity with extra VRAM demand.
          </p>
          <select
            id="train-vocoder"
            value={activeProject.vocoder}
            onChange={(e) =>
              onUpdateProject({
                ...activeProject,
                vocoder: e.target.value as Vocoder,
              })
            }
            className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
          >
            <option value="HiFi-GAN">HiFi-GAN</option>
            <option value="MRF HiFi-GAN">MRF HiFi-GAN</option>
            <option value="RefineGAN">RefineGAN</option>
          </select>
        </div>

        {/* Step 1 Advanced Settings */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506]">
          <button
            type="button"
            onClick={() => setStep1AdvOpen((v) => !v)}
            aria-expanded={step1AdvOpen}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#DFBFC3] hover:text-white"
          >
            <span>Advanced Settings</span>
            {step1AdvOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {step1AdvOpen && (
            <div className="border-t border-[#47161D] p-4 space-y-4">
              {/* CPU Cores */}
              <div className="rounded-lg border border-[#47161D] bg-[#160709] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <label
                      htmlFor="train-cpu-cores"
                      className="block text-xs font-semibold text-[#FDF7F7]"
                    >
                      CPU Cores
                    </label>
                    <p className="text-[11px] text-[#AD8288] mt-0.5">
                      Parallel CPU worker threads allocated for audio slicing and pitch extraction. Using all 4 Kaggle vCPUs keeps preprocessing fast.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <NumberStepperInput
                      value={activeProject.cpuCores}
                      min={1}
                      max={4}
                      ariaLabel="CPU Cores value"
                      unitName="CPU cores"
                      inputWidthClass="w-10"
                      onChange={(next) =>
                        onUpdateProject({ ...activeProject, cpuCores: next })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateProject({ ...activeProject, cpuCores: 4 })}
                      aria-label="Reset CPU cores to 4"
                      className="rounded-lg border border-[#47161D] bg-[#200B0E] p-1.5 text-[#DFBFC3] hover:text-white hover:border-[#E51923]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <input
                  id="train-cpu-cores"
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={activeProject.cpuCores}
                  onChange={(e) =>
                    onUpdateProject({
                      ...activeProject,
                      cpuCores: Number(e.target.value),
                    })
                  }
                  className="w-full scarlet-slider"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
                  <span>1</span>
                  <span>4</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="train-gpu-number"
                    className="block text-xs font-semibold text-[#FDF7F7]"
                  >
                    GPU Number
                  </label>
                  <p className="text-[11px] text-[#AD8288] mb-1.5">
                    Target CUDA device IDs separated by hyphens (for dual T4 sessions keep 0-1).
                  </p>
                  <input
                    id="train-gpu-number"
                    type="text"
                    value={activeProject.gpuNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      const count = val.split('-').filter((x) => x.trim()).length >= 2 ? 2 : 1;
                      onUpdateProject({
                        ...activeProject,
                        gpuNumber: val,
                        gpuCount: count,
                      });
                    }}
                    className="w-full rounded-lg bg-[#160709] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FDF7F7]">
                    GPU Information
                  </p>
                  <p className="text-[11px] text-[#AD8288] mb-1.5">
                    Detected CUDA accelerator allocation for this session.
                  </p>
                  <pre className="rounded-lg border border-[#47161D] bg-[#160709] px-3 py-2 text-xs font-mono text-[#DFBFC3] leading-relaxed">
                    {getGpuInfoLines(activeProject.gpuNumber)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* STEP 2: Prepare Dataset */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <StepBadge num={2} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Prepare Dataset
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Link your Kaggle dataset folder and split clean vocal segments for training.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="train-dataset-path"
            className="block text-xs font-semibold text-[#FDF7F7]"
          >
            Dataset Path
          </label>
          <p className="text-[11px] text-[#AD8288] mb-1.5">
            Mounted Kaggle input path containing your dry vocal recordings.
          </p>
          <input
            id="train-dataset-path"
            type="text"
            value={activeProject.datasetPath}
            onChange={(e) =>
              onUpdateProject({ ...activeProject, datasetPath: e.target.value })
            }
            placeholder="/kaggle/input/datasets/your-username/voice-dataset"
            className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#DFBFC3] cursor-pointer">
            <input
              type="checkbox"
              checked={activeProject.datasetCreator}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  datasetCreator: e.target.checked,
                })
              }
              className="h-4 w-4 rounded accent-[#E51923]"
            />
            <span>Dataset Creator</span>
          </label>

          <button
            type="button"
            onClick={handleRefreshDatasets}
            className="inline-flex items-center gap-2 rounded-lg border border-[#47161D] bg-[#200B0E] px-3.5 py-2 text-xs font-medium text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh models and datasets</span>
          </button>
        </div>

        {refreshStatus && (
          <p className="text-xs text-[#DFBFC3]" role="status">
            {refreshStatus}
          </p>
        )}

        {/* Step 2 Advanced Settings */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506]">
          <button
            type="button"
            onClick={() => setStep2AdvOpen((v) => !v)}
            aria-expanded={step2AdvOpen}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#DFBFC3] hover:text-white"
          >
            <span>Advanced Settings</span>
            {step2AdvOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {step2AdvOpen && (
            <div className="border-t border-[#47161D] p-4 space-y-4">
              <div>
                <label
                  htmlFor="train-audio-cutting"
                  className="block text-xs font-semibold text-[#FDF7F7]"
                >
                  Audio cutting
                </label>
                <p className="text-[11px] text-[#AD8288] mt-0.5 mb-1.5">
                  Choose how long recordings are divided: Automatic detects quiet gaps dynamically, Simple cuts fixed chunks, and Skip leaves pre-split clips untouched.
                </p>
                <select
                  id="train-audio-cutting"
                  value={activeProject.audioCutting}
                  onChange={(e) =>
                    onUpdateProject({
                      ...activeProject,
                      audioCutting: e.target.value as AudioCuttingMethod,
                    })
                  }
                  className="w-full rounded-lg bg-[#160709] border border-[#47161D] px-3 py-2 text-xs text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                >
                  <option value="Automatic">Automatic</option>
                  <option value="Simple">Simple</option>
                  <option value="Skip">Skip</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#47161D] bg-[#160709] p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div>
                      <label
                        htmlFor="train-chunk-len"
                        className="block text-xs font-semibold text-[#FDF7F7]"
                      >
                        Chunk length (sec)
                      </label>
                      <p className="text-[11px] text-[#AD8288]">
                        Duration of each split audio window when Simple cutting is selected.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-xs text-[#FDF7F7] tabular-nums">
                        {activeProject.chunkLengthSec}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject({ ...activeProject, chunkLengthSec: 3 })
                        }
                        aria-label="Reset chunk length to 3"
                        className="rounded-md border border-[#47161D] bg-[#200B0E] p-1 text-[#DFBFC3] hover:text-white"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    id="train-chunk-len"
                    type="range"
                    min={0.5}
                    max={5}
                    step={0.1}
                    value={activeProject.chunkLengthSec}
                    onChange={(e) =>
                      onUpdateProject({
                        ...activeProject,
                        chunkLengthSec: Number(e.target.value),
                      })
                    }
                    className="w-full scarlet-slider"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
                    <span>0.5</span>
                    <span>5</span>
                  </div>
                </div>

                <div className="rounded-lg border border-[#47161D] bg-[#160709] p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div>
                      <label
                        htmlFor="train-overlap-len"
                        className="block text-xs font-semibold text-[#FDF7F7]"
                      >
                        Overlap length (sec)
                      </label>
                      <p className="text-[11px] text-[#AD8288]">
                        Crossfade overlap between consecutive Simple slices to avoid abrupt cuts.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-xs text-[#FDF7F7] tabular-nums">
                        {activeProject.overlapLengthSec}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject({ ...activeProject, overlapLengthSec: 0.3 })
                        }
                        aria-label="Reset overlap length to 0.3"
                        className="rounded-md border border-[#47161D] bg-[#200B0E] p-1 text-[#DFBFC3] hover:text-white"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    id="train-overlap-len"
                    type="range"
                    min={0}
                    max={0.4}
                    step={0.05}
                    value={activeProject.overlapLengthSec}
                    onChange={(e) =>
                      onUpdateProject({
                        ...activeProject,
                        overlapLengthSec: Number(e.target.value),
                      })
                    }
                    className="w-full scarlet-slider"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
                    <span>0</span>
                    <span>0.4</span>
                  </div>
                </div>
              </div>

              {/* Compact Silence Truncation strip (off by default) */}
              <div className="rounded-lg border border-[#47161D] bg-[#160709] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2.5 text-xs text-[#FDF7F7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeProject.truncateSilenceEnabled}
                    onChange={(e) =>
                      onUpdateProject({
                        ...activeProject,
                        truncateSilenceEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded accent-[#E51923]"
                  />
                  <span>Truncate silence</span>
                </label>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="train-silence-duration"
                    className="text-[11px] text-[#AD8288]"
                  >
                    Silence duration (ms)
                  </label>
                  <NumberStepperInput
                    id="train-silence-duration"
                    value={activeProject.silenceDurationMs}
                    min={50}
                    max={3000}
                    step={50}
                    disabled={!activeProject.truncateSilenceEnabled}
                    ariaLabel="Silence duration in ms"
                    unitName="silence duration"
                    inputWidthClass="w-14"
                    onChange={(next) =>
                      onUpdateProject({
                        ...activeProject,
                        silenceDurationMs: next,
                      })
                    }
                  />
                </div>
              </div>

              {/* Noise Filter & Loudness Normalization (both off by default) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-start gap-2.5 rounded-lg border border-[#47161D] bg-[#160709] p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeProject.noiseFilter}
                    onChange={(e) =>
                      onUpdateProject({
                        ...activeProject,
                        noiseFilter: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded accent-[#E51923]"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-[#FDF7F7]">
                      Noise filter
                    </span>
                    <span className="block text-[11px] text-[#AD8288] mt-0.5">
                      Applies spectral denoising to raw clips. Keep unchecked if your vocals are already clean or denoised.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 rounded-lg border border-[#47161D] bg-[#160709] p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeProject.loudnessNorm}
                    onChange={(e) =>
                      onUpdateProject({
                        ...activeProject,
                        loudnessNorm: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded accent-[#E51923]"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-[#FDF7F7]">
                      Loudness normalization ({activeProject.loudnessTargetLufs} LUFS)
                    </span>
                    <span className="block text-[11px] text-[#AD8288] mt-0.5">
                      Levels every clip to a punchy, consistent -14 LUFS loudness without introducing clipping.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">
            Preprocess output
          </p>
          <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
            {activeProject.preprocessOutput || 'The output information will be displayed here.'}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePreprocessDataset}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#FF2B35]"
          style={{ backgroundColor: ACCENT_HEX }}
        >
          Preprocess Dataset
        </button>
      </section>

      {/* STEP 3: Extract Features */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <StepBadge num={3} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Extract Features
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Compute pitch tracks and speaker embeddings from your sliced vocals.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="train-pitch-extractor"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Pitch extraction algorithm
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">
              F0 tracker used to capture vocal melody. RMVPE offers the sharpest accuracy across speech and singing.
            </p>
            <select
              id="train-pitch-extractor"
              value={activeProject.pitchExtractor}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  pitchExtractor: e.target.value as PitchExtractor,
                })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="rmvpe">rmvpe</option>
              <option value="fcpe">fcpe</option>
              <option value="swift-f0">swift-f0</option>
              <option value="crepe">crepe</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="train-embedder"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Embedder Model
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">
              Speech encoder that extracts phonetic timbre representations from audio.
            </p>
            <select
              id="train-embedder"
              value={activeProject.embedder}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  embedder: e.target.value as EmbedderModel,
                })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="contentvec">contentvec</option>
              <option value="spin">spin</option>
              <option value="chinese-hubert-base">chinese-hubert-base</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <label
                htmlFor="train-silent-files"
                className="block text-xs font-semibold text-[#FDF7F7]"
              >
                Silent training files
              </label>
              <p className="text-[11px] text-[#AD8288] mt-0.5">
                Injects blank silent samples to help prevent breath artifacts during pauses. Leave at 0 if your dataset already includes natural quiet gaps.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-md border border-[#47161D] bg-[#160709] px-2.5 py-1 font-mono text-xs text-[#FDF7F7] tabular-nums">
                {activeProject.silentTrainingFiles}
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateProject({ ...activeProject, silentTrainingFiles: 0 })
                }
                aria-label="Reset silent training files to 0"
                className="rounded-md border border-[#47161D] bg-[#200B0E] p-1.5 text-[#DFBFC3] hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <input
            id="train-silent-files"
            type="range"
            min={0}
            max={10}
            step={1}
            value={activeProject.silentTrainingFiles}
            onChange={(e) =>
              onUpdateProject({
                ...activeProject,
                silentTrainingFiles: Number(e.target.value),
              })
            }
            className="w-full scarlet-slider"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
            <span>0</span>
            <span>10</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">
            Feature extraction output
          </p>
          <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
            {activeProject.extractOutput || 'The output information will be displayed here.'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleExtractFeatures}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#FF2B35]"
          style={{ backgroundColor: ACCENT_HEX }}
        >
          Extract Features
        </button>
      </section>

      {/* STEP 4: Train Model */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <StepBadge num={4} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Train Model
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Dial in batch size, checkpoint frequency, and total training epochs before launching.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Batch Size (default 2) */}
          <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <label
                  htmlFor="train-batch-size"
                  className="block text-xs font-semibold text-[#FDF7F7]"
                >
                  Batch Size
                </label>
                <p className="text-[11px] text-[#AD8288] mt-0.5">
                  Per-GPU slice batch size. Default is 2 because dual Kaggle T4 GPUs double it to an effective batch of 4 (4 runs at 8, etc.).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <NumberStepperInput
                  value={activeProject.batchSize}
                  min={1}
                  max={64}
                  ariaLabel="Batch Size value"
                  unitName="batch size"
                  inputWidthClass="w-12"
                  onChange={(next) =>
                    onUpdateProject({ ...activeProject, batchSize: next })
                  }
                />
                <button
                  type="button"
                  onClick={() => onUpdateProject({ ...activeProject, batchSize: 2 })}
                  aria-label="Reset batch size to 2"
                  className="rounded-lg border border-[#47161D] bg-[#200B0E] p-1.5 text-[#DFBFC3] hover:text-white hover:border-[#E51923]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input
              id="train-batch-size"
              type="range"
              min={1}
              max={64}
              step={1}
              value={activeProject.batchSize}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  batchSize: Number(e.target.value),
                })
              }
              className="w-full scarlet-slider"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
              <span>1</span>
              <span>64</span>
            </div>
          </div>

          {/* Save Every Epoch (default 5) */}
          <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <label
                  htmlFor="train-save-every"
                  className="block text-xs font-semibold text-[#FDF7F7]"
                >
                  Save Every Epoch
                </label>
                <p className="text-[11px] text-[#AD8288] mt-0.5">
                  Interval of completed epochs between saved checkpoint snapshots.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <NumberStepperInput
                  value={activeProject.saveEveryEpoch}
                  min={1}
                  max={100}
                  ariaLabel="Save Every Epoch value"
                  unitName="save every epoch"
                  inputWidthClass="w-12"
                  onChange={(next) =>
                    onUpdateProject({ ...activeProject, saveEveryEpoch: next })
                  }
                />
                <button
                  type="button"
                  onClick={() => onUpdateProject({ ...activeProject, saveEveryEpoch: 5 })}
                  aria-label="Reset save every epoch to 5"
                  className="rounded-lg border border-[#47161D] bg-[#200B0E] p-1.5 text-[#DFBFC3] hover:text-white hover:border-[#E51923]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input
              id="train-save-every"
              type="range"
              min={1}
              max={100}
              step={1}
              value={activeProject.saveEveryEpoch}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  saveEveryEpoch: Number(e.target.value),
                })
              }
              className="w-full scarlet-slider"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
              <span>1</span>
              <span>100</span>
            </div>
          </div>

          {/* Total Epoch (default 200) */}
          <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <label
                  htmlFor="train-total-epoch"
                  className="block text-xs font-semibold text-[#FDF7F7]"
                >
                  Total Epoch
                </label>
                <p className="text-[11px] text-[#AD8288] mt-0.5">
                  Target number of full dataset passes before training stops automatically.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <NumberStepperInput
                  value={activeProject.totalEpoch}
                  min={1}
                  max={10000}
                  ariaLabel="Total Epoch value"
                  unitName="total epoch"
                  inputWidthClass="w-16"
                  onChange={(next) =>
                    onUpdateProject({ ...activeProject, totalEpoch: next })
                  }
                />
                <button
                  type="button"
                  onClick={() => onUpdateProject({ ...activeProject, totalEpoch: 200 })}
                  aria-label="Reset total epoch to 200"
                  className="rounded-lg border border-[#47161D] bg-[#200B0E] p-1.5 text-[#DFBFC3] hover:text-white hover:border-[#E51923]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input
              id="train-total-epoch"
              type="range"
              min={1}
              max={10000}
              step={1}
              value={activeProject.totalEpoch}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  totalEpoch: Number(e.target.value),
                })
              }
              className="w-full scarlet-slider"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
              <span>1</span>
              <span>10000</span>
            </div>
          </div>
        </div>

        {/* Step 4 Advanced Settings */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506]">
          <button
            type="button"
            onClick={() => setStep4AdvOpen((v) => !v)}
            aria-expanded={step4AdvOpen}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#DFBFC3] hover:text-white"
          >
            <span>Advanced Settings</span>
            {step4AdvOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {step4AdvOpen && (
            <div className="border-t border-[#47161D] p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    key: 'saveOnlyLatest' as const,
                    title: 'Save Only Latest',
                    desc: 'Overwrites previous G and D resume states on each save to prevent Kaggle disk overflow.',
                  },
                  {
                    key: 'saveEveryWeights' as const,
                    title: 'Save Every Weights',
                    desc: 'Exports a standalone inference .pth weight file every time the save interval triggers.',
                  },
                  {
                    key: 'pretrained' as const,
                    title: 'Pretrained',
                    desc: 'Initializes training from base RVC weights for faster convergence and cleaner timbre.',
                  },
                  {
                    key: 'freshTraining' as const,
                    title: 'Fresh Training',
                    desc: 'Clears prior checkpoints and TensorBoard history inside the model folder before starting.',
                  },
                  {
                    key: 'cacheDatasetGpu' as const,
                    title: 'Cache Dataset in GPU',
                    desc: 'Pins sliced audio tensors directly in VRAM to reduce disk reads on smaller datasets.',
                  },
                  {
                    key: 'checkpointing' as const,
                    title: 'Checkpointing',
                    desc: 'Trades compute speed for lower peak VRAM consumption via gradient checkpointing.',
                  },
                  {
                    key: 'shutdownAfterFinish' as const,
                    title: 'Shutdown after finishing',
                    desc: 'Powers down the runtime environment automatically once the final epoch wraps up.',
                  },
                  {
                    key: 'customPretrained' as const,
                    title: 'Custom Pretrained',
                    desc: 'Points training to your own custom G and D base weights instead of the built-in defaults.',
                  },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-start gap-2.5 rounded-lg border border-[#47161D] bg-[#160709] p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={activeProject[opt.key]}
                      onChange={(e) =>
                        onUpdateProject({
                          ...activeProject,
                          [opt.key]: e.target.checked,
                        })
                      }
                      className="mt-0.5 h-4 w-4 rounded accent-[#E51923]"
                    />
                    <div>
                      <span className="block text-xs font-semibold text-[#FDF7F7]">
                        {opt.title}
                      </span>
                      <span className="block text-[11px] text-[#AD8288] mt-0.5 leading-snug">
                        {opt.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {activeProject.customPretrained && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label
                      htmlFor="custom-pretrained-g"
                      className="block text-xs font-medium text-[#DFBFC3] mb-1.5"
                    >
                      Custom Pretrained G (.pth)
                    </label>
                    <input
                      id="custom-pretrained-g"
                      type="text"
                      value={activeProject.customPretrainedG}
                      onChange={(e) =>
                        onUpdateProject({
                          ...activeProject,
                          customPretrainedG: e.target.value,
                        })
                      }
                      placeholder="rvc/models/pretraineds/custom/G32k.pth"
                      className="w-full rounded-lg bg-[#160709] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="custom-pretrained-d"
                      className="block text-xs font-medium text-[#DFBFC3] mb-1.5"
                    >
                      Custom Pretrained D (.pth)
                    </label>
                    <input
                      id="custom-pretrained-d"
                      type="text"
                      value={activeProject.customPretrainedD}
                      onChange={(e) =>
                        onUpdateProject({
                          ...activeProject,
                          customPretrainedD: e.target.value,
                        })
                      }
                      placeholder="rvc/models/pretraineds/custom/D32k.pth"
                      className="w-full rounded-lg bg-[#160709] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="train-index-algorithm"
                  className="block text-xs font-semibold text-[#FDF7F7]"
                >
                  Index Algorithm
                </label>
                <p className="text-[11px] text-[#AD8288] mt-0.5 mb-1.5">
                  Vector clustering method used when building your .index retrieval file. Auto selects the fastest option for your dataset size.
                </p>
                <select
                  id="train-index-algorithm"
                  value={activeProject.indexAlgorithm}
                  onChange={(e) =>
                    onUpdateProject({
                      ...activeProject,
                      indexAlgorithm: e.target.value as IndexAlgorithm,
                    })
                  }
                  className="w-full rounded-lg bg-[#160709] border border-[#47161D] px-3 py-2 text-xs text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                >
                  <option value="Auto">Auto</option>
                  <option value="Faiss">Faiss</option>
                  <option value="KMeans">KMeans</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Terms of use (automatically checked) */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={activeProject.agreedTerms}
              onChange={(e) =>
                onUpdateProject({ ...activeProject, agreedTerms: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded accent-[#E51923]"
            />
            <div>
              <span className="block text-xs font-semibold text-[#FDF7F7]">
                I agree to the terms of use
              </span>
              <span className="block text-[11px] text-[#AD8288] mt-0.5">
                Confirm that your training audio follows the usage guidelines for NoRegretsRVC.
              </span>
            </div>
          </label>
        </div>

        {isTraining && (
          <div className="rounded-lg border border-[#E51923]/50 bg-[#200B0E] px-4 py-3 text-xs font-mono text-[#FDF7F7] flex items-center justify-between">
            <span>
              processing | {trainingElapsedSec.toFixed(1)}s · epoch {currentEpoch}/{activeProject.totalEpoch}
            </span>
            <span className="text-[#E51923] font-semibold">Running</span>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">
            Training output
          </p>
          <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
            {activeProject.trainingOutput || 'The output information will be displayed here.'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleToggleTraining}
            className="rounded-lg py-2.5 px-4 text-sm font-semibold text-white transition-colors hover:bg-[#FF2B35] whitespace-nowrap"
            style={{ backgroundColor: isTraining ? '#991B1B' : ACCENT_HEX }}
          >
            {isTraining ? 'Stop Training' : 'Start Training'}
          </button>
          <button
            type="button"
            onClick={handleGenerateIndex}
            className="rounded-lg border border-[#47161D] bg-[#200B0E] py-2.5 px-4 text-sm font-semibold text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap"
          >
            Generate Index
          </button>
        </div>
      </section>

      {/* STEP 5: Export Model */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <StepBadge num={5} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Export Model
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Pick the finished checkpoint and feature index files to package or back up.
            </p>
          </div>
        </div>

        <p className="rounded-lg border border-[#47161D] bg-[#100506] px-4 py-3 text-xs text-[#DFBFC3]">
          Clicking Upload bundles your selected model weights and index into a compressed archive ready for your ApplioExported backup folder.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="export-pth-file"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Exported Pth file
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">Model weights (.pth)</p>
            <input
              id="export-pth-file"
              type="text"
              value={activeProject.exportPthFile}
              placeholder="Select the pth file to be exported"
              onChange={(e) =>
                onUpdateProject({ ...activeProject, exportPthFile: e.target.value })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
            />
          </div>
          <div>
            <label
              htmlFor="export-index-file"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Exported Index File
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">Retrieval index (.index)</p>
            <input
              id="export-index-file"
              type="text"
              value={activeProject.exportIndexFile}
              placeholder="Select the index file to be exported"
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  exportIndexFile: e.target.value,
                })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleRefreshDatasets}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#47161D] bg-[#200B0E] py-2.5 px-4 text-sm font-semibold text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh trained models and indexes</span>
          </button>
          <button
            type="button"
            onClick={handleExportUploadZip}
            className="inline-flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold text-white transition-colors hover:bg-[#FF2B35] whitespace-nowrap"
            style={{ backgroundColor: ACCENT_HEX }}
          >
            <Upload className="h-4 w-4" />
            <span>Upload</span>
          </button>
        </div>

        {/* Optional Collapsible Kaggle CLI Reference */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506]">
          <button
            type="button"
            onClick={() => setCliPreviewOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[#AD8288] hover:text-[#FDF7F7]"
          >
            <span className="inline-flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5" />
              <span>View Generated Kaggle core.py Pipeline Commands</span>
            </span>
            {cliPreviewOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {cliPreviewOpen && (
            <pre className="border-t border-[#47161D] p-4 text-[11px] font-mono text-[#DFBFC3] overflow-x-auto leading-relaxed">
              {buildTrainPipelineCommands(activeProject)}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
};

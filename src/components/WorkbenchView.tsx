import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { ACCENT_HEX } from '../data/defaults';
import {
  BlenderRecipe,
  DownloadModelItem,
  ImportedLocalModel,
  SamplingRate,
  TtsDefaults,
  VoiceModelProject,
} from '../types/studio';
import { buildBlendCliCommand, sanitizeModelName } from '../utils/rvcTuning';
import { buildZipArchive } from '../utils/zipBuilder';
import { buildPreviewToneWav } from './ConvertAudioView';
import { triggerBlobDownload } from '../utils/download';

interface WorkbenchViewProps {
  mode: 'blender' | 'tts' | 'models';
  projects: VoiceModelProject[];
  blender: BlenderRecipe;
  ttsDefaults: TtsDefaults;
  downloadManifest: DownloadModelItem[];
  importedModels: ImportedLocalModel[];
  onUpdateBlender: (updated: BlenderRecipe) => void;
  onUpdateTts: (updated: TtsDefaults) => void;
  onUpdateManifest: (updated: DownloadModelItem[]) => void;
  onUpdateImportedModels: (updated: ImportedLocalModel[]) => void;
}

const StepBadge: React.FC<{ num: number }> = ({ num }) => (
  <span
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white tabular-nums"
    style={{ backgroundColor: ACCENT_HEX }}
  >
    {num}
  </span>
);

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  mode,
  projects,
  blender,
  ttsDefaults,
  downloadManifest,
  importedModels,
  onUpdateBlender,
  onUpdateTts,
  onUpdateManifest,
  onUpdateImportedModels,
}) => {
  const blendFileARef = useRef<HTMLInputElement | null>(null);
  const blendFileBRef = useRef<HTMLInputElement | null>(null);
  const dropModelsRef = useRef<HTMLInputElement | null>(null);

  const [copiedBlend, setCopiedBlend] = useState(false);
  const [blendOutput, setBlendOutput] = useState(
    'The output information will be displayed here.'
  );
  const [blendedReady, setBlendedReady] = useState(false);

  const [ttsSampleText, setTtsSampleText] = useState(
    'Welcome to NoRegretsRVC. Testing synthesized speech with your voice model.'
  );
  const [ttsStatus, setTtsStatus] = useState('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');

  const [modelLinkUrl, setModelLinkUrl] = useState('');
  const [modelDownloadOutput, setModelDownloadOutput] = useState(
    'The output information will be displayed here.'
  );
  const [pretrainedModel, setPretrainedModel] = useState('Titan');
  const [pretrainedSr, setPretrainedSr] = useState<'32k' | '40k' | '48k'>('32k');
  const [customPretrained, setCustomPretrained] = useState(false);
  const [customPretrainedUrl, setCustomPretrainedUrl] = useState('');

  const blendCommand = buildBlendCliCommand(blender);

  const allVoicePthPaths = Array.from(
    new Set(
      [
        ...projects.map((p) => {
          const safe = sanitizeModelName(p.name);
          return p.exportPthFile || `logs/${safe}/${safe}_${p.totalEpoch}e.pth`;
        }),
        ...importedModels.map((m) => m.pthPath),
        ...downloadManifest
          .filter((d) => d.category === 'voice')
          .map((d) => `logs/downloaded/${sanitizeModelName(d.name)}.pth`),
      ].filter(Boolean)
    )
  );

  const allIndexPaths = Array.from(
    new Set(
      [
        ...projects.map((p) => {
          const safe = sanitizeModelName(p.name);
          return p.exportIndexFile || `logs/${safe}/${safe}.index`;
        }),
        ...importedModels.map((m) => m.indexPath),
      ].filter(Boolean)
    )
  );

  const handleCopyBlend = async () => {
    try {
      await navigator.clipboard.writeText(blendCommand);
      setCopiedBlend(true);
      setTimeout(() => setCopiedBlend(false), 1800);
    } catch {
      setCopiedBlend(false);
    }
  };

  const handleFusion = () => {
    const outName = sanitizeModelName(blender.outputName);
    setBlendOutput(
      `Blended "${blender.modelAPath || 'ModelA.pth'}" (${Math.round(
        blender.ratio * 100
      )}%) + "${blender.modelBPath || 'ModelB.pth'}" (${Math.round(
        (1 - blender.ratio) * 100
      )}%) -> logs/${outName}.pth`
    );
    setBlendedReady(true);
  };

  const handleDownloadBlendedModel = () => {
    const outName = sanitizeModelName(blender.outputName);
    const bytes = buildZipArchive([
      {
        path: `${outName}/blend_recipe.json`,
        content: JSON.stringify(blender, null, 2),
      },
      { path: `${outName}/blend.sh`, content: blendCommand },
    ]);
    triggerBlobDownload(
      `${outName}_Blended.zip`,
      new Uint8Array(bytes).buffer,
      'application/zip'
    );
  };

  const handleGenerateTtsPreview = () => {
    if (ttsAudioUrl) URL.revokeObjectURL(ttsAudioUrl);
    const blob = buildPreviewToneWav(ttsDefaults.pitch);
    const url = URL.createObjectURL(blob);
    setTtsAudioUrl(url);
    const target = ttsDefaults.modelPthPath || allVoicePthPaths[0] || 'Default RVC Voice';
    setTtsStatus(
      `Generated Edge-TTS (${ttsDefaults.voice}, rate ${ttsDefaults.rate}%, pitch ${ttsDefaults.pitch}) -> ${target}.`
    );
  };

  const handleDownloadModelUrl = () => {
    const trimmed = modelLinkUrl.trim();
    if (!/^https?:\/\//.test(trimmed)) {
      setModelDownloadOutput('Enter a valid https:// model link (Hugging Face, Pixeldrain, or Drive).');
      return;
    }
    const label = trimmed.split('/').pop()?.replace(/\.(zip|pth|index)$/i, '') || 'DownloadedModel';
    const cleanLabel = sanitizeModelName(label);
    onUpdateManifest([
      ...downloadManifest,
      {
        id: `dl-${Date.now()}`,
        name: cleanLabel,
        url: trimmed,
        category: 'voice',
      },
    ]);
    onUpdateImportedModels([
      ...importedModels,
      {
        id: `imp-${Date.now()}`,
        name: cleanLabel,
        pthPath: `logs/downloaded/${cleanLabel}.pth`,
        indexPath: `logs/downloaded/${cleanLabel}.index`,
      },
    ]);
    setModelLinkUrl('');
    setModelDownloadOutput(`Added "${cleanLabel}" to model library and Kaggle pre-fetch manifest.`);
  };

  const handleDropModelFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const pth = list.find((f) => f.name.endsWith('.pth'));
    const idx = list.find((f) => f.name.endsWith('.index'));
    if (!pth && !idx) {
      setModelDownloadOutput('Drop .pth and/or .index files to import them into your library.');
      return;
    }
    const baseName = sanitizeModelName((pth?.name || idx?.name || 'ImportedModel').replace(/\.(pth|index)$/i, ''));
    onUpdateImportedModels([
      ...importedModels,
      {
        id: `local-${Date.now()}`,
        name: baseName,
        pthPath: pth ? `logs/${baseName}/${pth.name}` : `logs/${baseName}/${baseName}.pth`,
        indexPath: idx ? `logs/${baseName}/${idx.name}` : '',
      },
    ]);
    setModelDownloadOutput(
      `Imported ${[pth?.name, idx?.name].filter(Boolean).join(' + ')} into Samples and TTS dropdowns.`
    );
  };

  const handleDownloadPretrained = () => {
    const url =
      customPretrained && customPretrainedUrl.trim()
        ? customPretrainedUrl.trim()
        : `https://huggingface.co/IAHispano/Applio/resolve/main/Resources/pretraineds/${pretrainedModel}_${pretrainedSr}.pth`;
    const label = `${pretrainedModel} (${pretrainedSr})`;
    onUpdateManifest([
      ...downloadManifest,
      {
        id: `pre-${Date.now()}`,
        name: label,
        url,
        category: 'pretrained',
      },
    ]);
    setModelDownloadOutput(`Queued pretrained ${label} in Kaggle boot manifest.`);
  };

  if (mode === 'blender') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 px-1">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#FDF7F7] tracking-tight">
              Voice Blender
            </h2>
            <p className="text-sm text-[#DFBFC3] mt-1">
              Merge two compatible RVC checkpoints into a single hybrid voice weights file.
            </p>
          </div>
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

        {/* 1. Source Models */}
        <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
          <div className="flex items-start gap-3">
            <StepBadge num={1} />
            <div>
              <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                Source Models
              </h3>
              <p className="text-xs text-[#AD8288] mt-0.5">
                Load two .pth checkpoints via file drop or direct filesystem paths.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <input
                ref={blendFileARef}
                type="file"
                accept=".pth"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpdateBlender({ ...blender, modelAPath: `logs/${f.name}` });
                }}
              />
              <button
                type="button"
                onClick={() => blendFileARef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-[#47161D] bg-[#100506] p-5 text-center hover:border-[#E51923] transition-colors"
              >
                <Upload className="h-5 w-5 mx-auto text-[#E51923] mb-1.5" />
                <p className="text-xs font-semibold text-[#FDF7F7]">
                  Select primary .pth checkpoint
                </p>
                <p className="text-[11px] text-[#AD8288] mt-0.5">
                  Drag and drop or click to choose Model A
                </p>
              </button>
              <div>
                <label
                  htmlFor="blend-model-a"
                  className="block text-xs font-semibold text-[#FDF7F7]"
                >
                  Path to first model
                </label>
                <p className="text-[11px] text-[#AD8288] mb-1.5">
                  Or type a relative logs/ path directly.
                </p>
                <input
                  id="blend-model-a"
                  type="text"
                  value={blender.modelAPath}
                  placeholder="Enter path to model"
                  onChange={(e) =>
                    onUpdateBlender({ ...blender, modelAPath: e.target.value })
                  }
                  className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <input
                ref={blendFileBRef}
                type="file"
                accept=".pth"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpdateBlender({ ...blender, modelBPath: `logs/${f.name}` });
                }}
              />
              <button
                type="button"
                onClick={() => blendFileBRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-[#47161D] bg-[#100506] p-5 text-center hover:border-[#E51923] transition-colors"
              >
                <Upload className="h-5 w-5 mx-auto text-[#E51923] mb-1.5" />
                <p className="text-xs font-semibold text-[#FDF7F7]">
                  Select secondary .pth checkpoint
                </p>
                <p className="text-[11px] text-[#AD8288] mt-0.5">
                  Drag and drop or click to choose Model B
                </p>
              </button>
              <div>
                <label
                  htmlFor="blend-model-b"
                  className="block text-xs font-semibold text-[#FDF7F7]"
                >
                  Path to second model
                </label>
                <p className="text-[11px] text-[#AD8288] mb-1.5">
                  Or type a relative logs/ path directly.
                </p>
                <input
                  id="blend-model-b"
                  type="text"
                  value={blender.modelBPath}
                  placeholder="Enter path to model"
                  onChange={(e) =>
                    onUpdateBlender({ ...blender, modelBPath: e.target.value })
                  }
                  className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Blend Settings */}
        <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <StepBadge num={2} />
            <div>
              <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                Blend Settings
              </h3>
              <p className="text-xs text-[#AD8288] mt-0.5">
                Define the merged checkpoint filename and weight mixing balance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="blend-output-name"
                className="block text-xs font-semibold text-[#FDF7F7]"
              >
                Model Name
              </label>
              <p className="text-[11px] text-[#AD8288] mb-1.5">
                Identifier assigned to the merged .pth export.
              </p>
              <input
                id="blend-output-name"
                type="text"
                value={blender.outputName}
                placeholder="Enter model name"
                onChange={(e) =>
                  onUpdateBlender({ ...blender, outputName: e.target.value })
                }
                className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
              />
            </div>

            <div>
              <label
                htmlFor="blend-sample-rate"
                className="block text-xs font-semibold text-[#FDF7F7]"
              >
                Sampling Rate
              </label>
              <p className="text-[11px] text-[#AD8288] mb-1.5">
                Must match the target rate of both source checkpoints.
              </p>
              <select
                id="blend-sample-rate"
                value={blender.samplingRate}
                onChange={(e) =>
                  onUpdateBlender({
                    ...blender,
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

          <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <label htmlFor="blend-ratio-slider" className="block text-xs font-semibold text-[#FDF7F7]">
                  Blend Ratio
                </label>
                <p className="text-[11px] text-[#AD8288] mt-0.5">
                  Balance influence between checkpoints: 0 leans 100% toward Model B, while 1 leans 100% toward Model A.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-md border border-[#47161D] bg-[#160709] px-2.5 py-1 font-mono text-xs text-[#FDF7F7] tabular-nums">
                  {blender.ratio.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateBlender({ ...blender, ratio: 0.5 })}
                  aria-label="Reset blend ratio to 0.5"
                  className="rounded-md border border-[#47161D] bg-[#200B0E] p-1.5 text-[#DFBFC3] hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input
              id="blend-ratio-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={blender.ratio}
              onChange={(e) =>
                onUpdateBlender({ ...blender, ratio: Number(e.target.value) })
              }
              className="w-full scarlet-slider"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
              <span>0</span>
              <span>1</span>
            </div>
          </div>
        </section>

        {/* 3. Blend & Export */}
        <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <StepBadge num={3} />
            <div>
              <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                Blend &amp; Export
              </h3>
              <p className="text-xs text-[#AD8288] mt-0.5">
                Execute the blend and download the packaged recipe or shell command.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFusion}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white hover:bg-[#FF2B35]"
            style={{ backgroundColor: ACCENT_HEX }}
          >
            Fusion
          </button>

          <div>
            <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">Blend output</p>
            <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
              {blendOutput}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDownloadBlendedModel}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                blendedReady
                  ? 'border-[#E51923] bg-[#200B0E] text-white'
                  : 'border-[#47161D] bg-[#100506] text-[#DFBFC3] hover:text-white'
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Model</span>
            </button>

            <button
              type="button"
              onClick={handleCopyBlend}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#47161D] bg-[#200B0E] px-2.5 py-1.5 text-xs text-[#FDF7F7] hover:border-[#E51923]"
            >
              {copiedBlend ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                  <span>Copied CLI</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Blend CLI</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (mode === 'tts') {
    return (
      <div className="space-y-6">
        <div className="px-1">
          <h2 className="font-display text-2xl font-bold text-[#FDF7F7] tracking-tight">
            TTS
          </h2>
          <p className="text-sm text-[#DFBFC3] mt-1">
            Synthesize spoken dialogue with Edge-TTS and route it through your selected RVC voice checkpoint.
          </p>
        </div>

        <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tts-voice-select"
                className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
              >
                Base Edge-TTS Speaker
              </label>
              <select
                id="tts-voice-select"
                value={ttsDefaults.voice}
                onChange={(e) =>
                  onUpdateTts({ ...ttsDefaults, voice: e.target.value })
                }
                className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
              >
                <option value="en-US-AndrewNeural">en-US-AndrewNeural (Warm Male)</option>
                <option value="en-US-GuyNeural">en-US-GuyNeural (Clear Narrator)</option>
                <option value="en-US-AriaNeural">en-US-AriaNeural (Expressive Female)</option>
                <option value="en-GB-RyanNeural">en-GB-RyanNeural (British Male)</option>
                <option value="en-US-JennyNeural">en-US-JennyNeural (Conversational)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="tts-target-rvc"
                className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
              >
                Target RVC Voice Model (Synced with Models)
              </label>
              <select
                id="tts-target-rvc"
                value={ttsDefaults.modelPthPath}
                onChange={(e) =>
                  onUpdateTts({ ...ttsDefaults, modelPthPath: e.target.value })
                }
                className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
              >
                <option value="">-- Select Target .pth Model --</option>
                {allVoicePthPaths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="tts-target-index"
              className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
            >
              Index File (Optional)
            </label>
            <select
              id="tts-target-index"
              value={ttsDefaults.indexFilePath}
              onChange={(e) =>
                onUpdateTts({ ...ttsDefaults, indexFilePath: e.target.value })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="">-- Optional .index File --</option>
              {allIndexPaths.map((idx) => (
                <option key={idx} value={idx}>
                  {idx}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="tts-text-input"
              className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
            >
              Text to Speak
            </label>
            <textarea
              id="tts-text-input"
              rows={3}
              value={ttsSampleText}
              onChange={(e) => setTtsSampleText(e.target.value)}
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] p-3 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tts-pitch-range" className="text-xs font-medium text-[#DFBFC3]">
                  Pitch Shift (Semitones)
                </label>
                <span className="font-mono text-xs text-[#FDF7F7] tabular-nums">
                  {ttsDefaults.pitch > 0 ? `+${ttsDefaults.pitch}` : ttsDefaults.pitch}
                </span>
              </div>
              <input
                id="tts-pitch-range"
                type="range"
                min={-12}
                max={12}
                step={1}
                value={ttsDefaults.pitch}
                onChange={(e) =>
                  onUpdateTts({ ...ttsDefaults, pitch: Number(e.target.value) })
                }
                className="w-full scarlet-slider"
              />
            </div>

            <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tts-rate-range" className="text-xs font-medium text-[#DFBFC3]">
                  Speech Speed (%)
                </label>
                <span className="font-mono text-xs text-[#FDF7F7] tabular-nums">
                  {ttsDefaults.rate > 0 ? `+${ttsDefaults.rate}%` : `${ttsDefaults.rate}%`}
                </span>
              </div>
              <input
                id="tts-rate-range"
                type="range"
                min={-50}
                max={50}
                step={5}
                value={ttsDefaults.rate}
                onChange={(e) =>
                  onUpdateTts({ ...ttsDefaults, rate: Number(e.target.value) })
                }
                className="w-full scarlet-slider"
              />
            </div>

            <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tts-index-range" className="text-xs font-medium text-[#DFBFC3]">
                  Index Feature Ratio
                </label>
                <span className="font-mono text-xs text-[#FDF7F7] tabular-nums">
                  {ttsDefaults.indexRate.toFixed(2)}
                </span>
              </div>
              <input
                id="tts-index-range"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ttsDefaults.indexRate}
                onChange={(e) =>
                  onUpdateTts({ ...ttsDefaults, indexRate: Number(e.target.value) })
                }
                className="w-full scarlet-slider"
              />
            </div>

            <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="tts-protect-range" className="text-xs font-medium text-[#DFBFC3]">
                  Consonant Protect
                </label>
                <span className="font-mono text-xs text-[#FDF7F7] tabular-nums">
                  {ttsDefaults.protect.toFixed(2)}
                </span>
              </div>
              <input
                id="tts-protect-range"
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={ttsDefaults.protect}
                onChange={(e) =>
                  onUpdateTts({ ...ttsDefaults, protect: Number(e.target.value) })
                }
                className="w-full scarlet-slider"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateTtsPreview}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white hover:bg-[#FF2B35]"
            style={{ backgroundColor: ACCENT_HEX }}
          >
            Convert Text-to-Speech
          </button>

          {ttsStatus && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
                {ttsStatus}
              </div>
              {ttsAudioUrl && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#47161D] bg-[#100506] p-3">
                  <audio controls src={ttsAudioUrl} className="flex-1 h-9 min-w-[200px]" />
                  <button
                    type="button"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = ttsAudioUrl;
                      a.download = `tts_sample.wav`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#47161D] bg-[#200B0E] px-3 py-1.5 text-xs font-semibold text-[#FDF7F7] hover:border-[#E51923]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Save TTS Audio</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#FDF7F7] tracking-tight">
            Models
          </h2>
          <p className="text-sm text-[#DFBFC3] mt-1">
            Fetch remote voice archives, drop local weights, and manage pretrained bases for Kaggle runs.
          </p>
        </div>
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

      {/* 1. Download Model */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <StepBadge num={1} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Download Model
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Add a remote archive or checkpoint URL to sync into your Samples and TTS library.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="models-link-input"
            className="block text-xs font-semibold text-[#FDF7F7]"
          >
            Model Link
          </label>
          <p className="text-[11px] text-[#AD8288] mb-1.5">
            Direct URL from Hugging Face, Pixeldrain, or Google Drive.
          </p>
          <input
            id="models-link-input"
            type="url"
            value={modelLinkUrl}
            onChange={(e) => setModelLinkUrl(e.target.value)}
            placeholder="https://huggingface.co/.../resolve/main/model.zip"
            className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">Download output</p>
          <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
            {modelDownloadOutput}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadModelUrl}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white hover:bg-[#FF2B35]"
          style={{ backgroundColor: ACCENT_HEX }}
        >
          Download Model
        </button>
      </section>

      {/* 2. Drop Files */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <StepBadge num={2} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Drop Files
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Load local .pth weights and .index files directly from your computer.
            </p>
          </div>
        </div>

        <input
          ref={dropModelsRef}
          type="file"
          multiple
          accept=".pth,.index"
          className="hidden"
          onChange={(e) => handleDropModelFiles(e.target.files)}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleDropModelFiles(e.dataTransfer.files);
          }}
          className="rounded-xl border-2 border-dashed border-[#47161D] bg-[#100506] p-6 text-center hover:border-[#E51923] transition-colors"
        >
          <Upload className="h-6 w-6 mx-auto text-[#E51923] mb-2" />
          <p className="text-xs font-semibold text-[#FDF7F7]">
            Drag .pth weights and .index files here or click below to browse from disk.
          </p>
          <button
            type="button"
            onClick={() => dropModelsRef.current?.click()}
            className="mt-3 rounded-lg border border-[#47161D] bg-[#200B0E] px-4 py-2 text-xs font-semibold text-[#FDF7F7] hover:border-[#E51923]"
          >
            Select Model Files (.pth / .index)
          </button>
        </div>
      </section>

      {/* 3. Download Pretrained Models */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <StepBadge num={3} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Download Pretrained Models
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Queue base pretrained architectures or custom Hugging Face weights for Kaggle setup.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="pretrained-select"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Pretrained
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">
              Choose a base pretrained voice architecture.
            </p>
            <select
              id="pretrained-select"
              value={pretrainedModel}
              onChange={(e) => setPretrainedModel(e.target.value)}
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="Titan">Titan</option>
              <option value="Snowie">Snowie</option>
              <option value="KLM">KLM</option>
              <option value="Ov2Super">Ov2Super</option>
              <option value="Rin_E3">Rin_E3</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pretrained-sr-select"
              className="block text-xs font-semibold text-[#FDF7F7]"
            >
              Sampling Rate
            </label>
            <p className="text-[11px] text-[#AD8288] mb-1.5">
              Match the target sample rate used for training.
            </p>
            <select
              id="pretrained-sr-select"
              value={pretrainedSr}
              onChange={(e) =>
                setPretrainedSr(e.target.value as '32k' | '40k' | '48k')
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="32k">32k</option>
              <option value="40k">40k</option>
              <option value="48k">48k</option>
            </select>
          </div>
        </div>

        <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#DFBFC3] cursor-pointer">
          <input
            type="checkbox"
            checked={customPretrained}
            onChange={(e) => setCustomPretrained(e.target.checked)}
            className="h-4 w-4 rounded accent-[#E51923]"
          />
          <span>Custom Pretrained</span>
        </label>

        {customPretrained && (
          <input
            type="url"
            value={customPretrainedUrl}
            onChange={(e) => setCustomPretrainedUrl(e.target.value)}
            placeholder="https://huggingface.co/.../resolve/main/pretrained.pth"
            className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45"
          />
        )}

        <button
          type="button"
          onClick={handleDownloadPretrained}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white hover:bg-[#FF2B35]"
          style={{ backgroundColor: ACCENT_HEX }}
        >
          Download
        </button>

        {/* Active Boot Manifest Table */}
        <div className="pt-3 border-t border-[#47161D] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#47161D] text-[11px] text-[#AD8288]">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Source URL</th>
                <th className="py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#47161D] text-xs">
              {downloadManifest.map((item) => (
                <tr key={item.id} className="hover:bg-[#200B0E]/60">
                  <td className="py-2 pr-4 font-medium text-[#FDF7F7] whitespace-nowrap">
                    {item.name}
                  </td>
                  <td className="py-2 pr-4 text-[#DFBFC3] capitalize whitespace-nowrap">
                    {item.category}
                  </td>
                  <td className="py-2 pr-4 font-mono text-[11px] text-[#AD8288] max-w-md truncate">
                    {item.url}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateManifest(
                          downloadManifest.filter((d) => d.id !== item.id)
                        )
                      }
                      aria-label={`Remove ${item.name}`}
                      className="rounded-md p-1 text-[#AD8288] hover:text-[#FF2B35]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

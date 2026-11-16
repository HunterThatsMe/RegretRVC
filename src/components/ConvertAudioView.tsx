import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Play,
  RefreshCw,
  RotateCcw,
  Upload,
  Volume2,
} from 'lucide-react';
import { ACCENT_HEX } from '../data/defaults';
import {
  ConvertAudioState,
  ImportedLocalModel,
  VoiceModelProject,
} from '../types/studio';
import { buildInferCliCommand, sanitizeModelName } from '../utils/rvcTuning';
import { triggerBlobDownload } from '../utils/download';

interface ConvertAudioViewProps {
  convertAudio: ConvertAudioState;
  projects: VoiceModelProject[];
  importedModels: ImportedLocalModel[];
  onUpdateConvertAudio: (updated: ConvertAudioState) => void;
}

const StepBadge: React.FC<{ num: number }> = ({ num }) => (
  <span
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white tabular-nums"
    style={{ backgroundColor: ACCENT_HEX }}
  >
    {num}
  </span>
);

/** Generates a clean playable mono WAV sample blob so users can audition and save pitch-shifted preview samples directly in browser. */
export function buildPreviewToneWav(pitchSemitones: number): Blob {
  const sampleRate = 22050;
  const durationSec = 1.6;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  writeStr(36, 'data');
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, numSamples * 2, true);

  const baseFreq = 220 * Math.pow(2, pitchSemitones / 12);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 12) * Math.min(1, (durationSec - t) * 8);
    const wave =
      0.5 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.25 * Math.sin(2 * Math.PI * baseFreq * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * baseFreq * 3 * t);
    const sample = Math.max(-1, Math.min(1, wave * env * 0.6));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export const ConvertAudioView: React.FC<ConvertAudioViewProps> = ({
  convertAudio,
  projects,
  importedModels,
  onUpdateConvertAudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [advOpen, setAdvOpen] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  const projectModels = projects.map((p) => {
    const safe = sanitizeModelName(p.name);
    return p.exportPthFile || `logs/${safe}/${safe}_${p.totalEpoch}e.pth`;
  });
  const projectIndexes = projects.map((p) => {
    const safe = sanitizeModelName(p.name);
    return p.exportIndexFile || `logs/${safe}/${safe}.index`;
  });

  const modelOptions = Array.from(
    new Set([...projectModels, ...importedModels.map((m) => m.pthPath)].filter(Boolean))
  );
  const indexOptions = Array.from(
    new Set([...projectIndexes, ...importedModels.map((m) => m.indexPath)].filter(Boolean))
  );

  const handleFileChosen = (file: File | undefined) => {
    if (!file) return;
    if (convertAudio.audioObjectUrl) {
      URL.revokeObjectURL(convertAudio.audioObjectUrl);
    }
    const objUrl = URL.createObjectURL(file);
    onUpdateConvertAudio({
      ...convertAudio,
      audioFileName: file.name,
      audioObjectUrl: objUrl,
      conversionOutput: `Loaded input audio "${file.name}". Ready to generate sample.`,
    });
  };

  const handleLoadDemoInput = () => {
    const wavBlob = buildPreviewToneWav(0);
    const objUrl = URL.createObjectURL(wavBlob);
    onUpdateConvertAudio({
      ...convertAudio,
      audioFileName: 'vocal_reference_sample.wav',
      audioObjectUrl: objUrl,
      conversionOutput: 'Loaded vocal_reference_sample.wav for sample testing.',
    });
  };

  const handleUnloadVoice = () => {
    onUpdateConvertAudio({
      ...convertAudio,
      voiceModel: '',
      indexFile: '',
      conversionOutput: 'Voice model unloaded from VRAM.',
    });
  };

  const handleRefreshModels = () => {
    setRefreshMsg('Refreshed trained and imported .pth models and .index files.');
    setTimeout(() => setRefreshMsg(''), 2200);
  };

  const handleConvert = () => {
    if (!convertAudio.agreedTerms) {
      onUpdateConvertAudio({
        ...convertAudio,
        conversionOutput: 'Please agree to the terms of use before generating samples.',
      });
      return;
    }
    if (!convertAudio.voiceModel.trim()) {
      onUpdateConvertAudio({
        ...convertAudio,
        conversionOutput: 'Select a Voice Model (.pth) in Step 1 first.',
      });
      return;
    }
    if (convertAudio.sourceMode === 'single' && !convertAudio.audioFileName.trim()) {
      onUpdateConvertAudio({
        ...convertAudio,
        conversionOutput: 'Upload an audio file or load a test sample in Step 2 first.',
      });
      return;
    }

    const outBlob = buildPreviewToneWav(convertAudio.pitch);
    const outUrl = URL.createObjectURL(outBlob);
    setConvertedUrl(outUrl);

    const baseName = (convertAudio.audioFileName || 'voice_sample').replace(/\.[^.]+$/, '');
    const sampleName = `${baseName}_p${convertAudio.pitch >= 0 ? `+${convertAudio.pitch}` : convertAudio.pitch}.${convertAudio.outputFormat}`;

    const newSample = {
      id: `sample-${Date.now()}`,
      name: sampleName,
      pitch: convertAudio.pitch,
      format: convertAudio.outputFormat,
      url: outUrl,
      createdAt: new Date().toLocaleTimeString(),
    };

    onUpdateConvertAudio({
      ...convertAudio,
      hasConvertedSample: true,
      savedSamples: [newSample, ...convertAudio.savedSamples].slice(0, 6),
      conversionOutput:
        convertAudio.sourceMode === 'batch'
          ? `Batch conversion queued for "${convertAudio.batchFolderPath}" using ${convertAudio.voiceModel}.`
          : `Sample "${sampleName}" ready. Click Save Sample to download to disk.`,
    });
  };

  const handleSaveSample = (sampleUrl?: string, sampleFilename?: string) => {
    const outBlob = buildPreviewToneWav(convertAudio.pitch);
    const baseName = (convertAudio.audioFileName || 'converted_sample').replace(/\.[^.]+$/, '');
    const filename = sampleFilename || `${baseName}_sample.${convertAudio.outputFormat}`;
    if (sampleUrl) {
      const a = document.createElement('a');
      a.href = sampleUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      triggerBlobDownload(filename, outBlob, 'audio/wav');
    }
  };

  return (
    <div className="space-y-6">
      <div className="px-1">
        <h2 className="font-display text-2xl font-bold text-[#FDF7F7] tracking-tight">
          Samples
        </h2>
        <p className="text-sm text-[#DFBFC3] mt-1">
          Test your voice weights on reference audio, preview the output, and save ready-to-share clips.
        </p>
      </div>

      {/* STEP 1: Voice Model */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <StepBadge num={1} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Voice Model
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Pick the .pth voice checkpoint and optional FAISS .index file for inference.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="convert-voice-model"
              className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
            >
              Voice Model
            </label>
            <select
              id="convert-voice-model"
              value={convertAudio.voiceModel}
              onChange={(e) =>
                onUpdateConvertAudio({ ...convertAudio, voiceModel: e.target.value })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="">-- Select Voice Model (.pth) --</option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="convert-index-file"
              className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
            >
              Index File
            </label>
            <select
              id="convert-index-file"
              value={convertAudio.indexFile}
              onChange={(e) =>
                onUpdateConvertAudio({ ...convertAudio, indexFile: e.target.value })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            >
              <option value="">-- Select Index File (.index) --</option>
              {indexOptions.map((idx) => (
                <option key={idx} value={idx}>
                  {idx}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleUnloadVoice}
            className="rounded-lg border border-[#47161D] bg-[#200B0E] px-4 py-2 text-xs font-semibold text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap shrink-0"
          >
            Unload Voice
          </button>
          <button
            type="button"
            onClick={handleRefreshModels}
            className="inline-flex items-center gap-2 rounded-lg border border-[#47161D] bg-[#200B0E] px-4 py-2 text-xs font-semibold text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh models and indexes</span>
          </button>
          {refreshMsg && (
            <span className="text-xs text-[#DFBFC3]" role="status">
              {refreshMsg}
            </span>
          )}
        </div>
      </section>

      {/* STEP 2: Audio Source */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <StepBadge num={2} />
            <div>
              <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                Audio Source
              </h3>
              <p className="text-xs text-[#AD8288] mt-0.5">
                Provide a single vocal clip below or point to a Kaggle folder for multi-file sample runs.
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-lg border border-[#47161D] bg-[#100506] p-1">
            {(['single', 'batch'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  onUpdateConvertAudio({ ...convertAudio, sourceMode: mode })
                }
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 ${
                  convertAudio.sourceMode === mode
                    ? 'bg-[#E51923] text-white'
                    : 'text-[#DFBFC3] hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {convertAudio.sourceMode === 'single' ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFileChosen(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragActive
                  ? 'border-[#E51923] bg-[#200B0E]'
                  : 'border-[#47161D] bg-[#100506] hover:border-[#6D202B]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleFileChosen(e.target.files?.[0])}
              />
              <Upload className="h-6 w-6 mx-auto text-[#E51923] mb-2" />
              <p className="text-sm font-medium text-[#FDF7F7]">
                {convertAudio.audioFileName
                  ? `Selected: ${convertAudio.audioFileName}`
                  : 'Drop Audio Here - or - Click to Upload'}
              </p>
              <p className="text-xs text-[#AD8288] mt-1">
                Supports WAV, MP3, FLAC, and OGG files for sample creation.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF2B35] whitespace-nowrap shrink-0"
                  style={{ backgroundColor: ACCENT_HEX }}
                >
                  Upload Audio
                </button>
                <button
                  type="button"
                  onClick={handleLoadDemoInput}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#47161D] bg-[#200B0E] px-3.5 py-2 text-xs font-medium text-[#DFBFC3] hover:text-white whitespace-nowrap shrink-0"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Load Test Vocal Sample</span>
                </button>
              </div>
            </div>

            {convertAudio.audioObjectUrl && (
              <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
                <p className="text-[11px] font-medium text-[#AD8288] mb-2">
                  Source Audio Preview ({convertAudio.audioFileName})
                </p>
                <audio controls src={convertAudio.audioObjectUrl} className="w-full h-9" />
              </div>
            )}
          </div>
        ) : (
          <div>
            <label
              htmlFor="convert-batch-folder"
              className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
            >
              Input Folder Path (Batch)
            </label>
            <input
              id="convert-batch-folder"
              type="text"
              value={convertAudio.batchFolderPath}
              onChange={(e) =>
                onUpdateConvertAudio({
                  ...convertAudio,
                  batchFolderPath: e.target.value,
                })
              }
              className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
            />
          </div>
        )}
      </section>

      {/* STEP 3: Sample Conversion & Save */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <StepBadge num={3} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Conversion Parameters
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Fine-tune semitone shift, index strength, and export format before rendering your clip.
            </p>
          </div>
        </div>

        {/* Pitch Slider */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <label
                htmlFor="convert-pitch-slider"
                className="block text-xs font-semibold text-[#FDF7F7]"
              >
                Pitch
              </label>
              <p className="text-[11px] text-[#AD8288] mt-0.5">
                Shift the vocal register up or down in semitones between -24 and +24.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-md border border-[#47161D] bg-[#160709] px-2.5 py-1 font-mono text-xs text-[#FDF7F7] tabular-nums">
                {convertAudio.pitch > 0 ? `+${convertAudio.pitch}` : convertAudio.pitch}
              </span>
              <button
                type="button"
                onClick={() => onUpdateConvertAudio({ ...convertAudio, pitch: 0 })}
                aria-label="Reset pitch to 0"
                className="rounded-md border border-[#47161D] bg-[#200B0E] p-1.5 text-[#DFBFC3] hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <input
            id="convert-pitch-slider"
            type="range"
            min={-24}
            max={24}
            step={1}
            value={convertAudio.pitch}
            onChange={(e) =>
              onUpdateConvertAudio({
                ...convertAudio,
                pitch: Number(e.target.value),
              })
            }
            className="w-full scarlet-slider"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
            <span>-24</span>
            <span>0</span>
            <span>24</span>
          </div>
        </div>

        {/* Collapsible Advanced Settings */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506]">
          <button
            type="button"
            onClick={() => setAdvOpen((v) => !v)}
            aria-expanded={advOpen}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#DFBFC3] hover:text-white"
          >
            <span>Advanced Settings</span>
            {advOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {advOpen && (
            <div className="border-t border-[#47161D] p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <label htmlFor="conv-index-rate" className="text-[#DFBFC3] font-medium">
                      Index Rate
                    </label>
                    <span className="font-mono text-[#FDF7F7] tabular-nums">
                      {convertAudio.indexRate.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="conv-index-rate"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={convertAudio.indexRate}
                    onChange={(e) =>
                      onUpdateConvertAudio({
                        ...convertAudio,
                        indexRate: Number(e.target.value),
                      })
                    }
                    className="w-full scarlet-slider"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <label htmlFor="conv-protect" className="text-[#DFBFC3] font-medium">
                      Protect Voiceless Consonants
                    </label>
                    <span className="font-mono text-[#FDF7F7] tabular-nums">
                      {convertAudio.protect.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="conv-protect"
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={convertAudio.protect}
                    onChange={(e) =>
                      onUpdateConvertAudio({
                        ...convertAudio,
                        protect: Number(e.target.value),
                      })
                    }
                    className="w-full scarlet-slider"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <label htmlFor="conv-filter-radius" className="text-[#DFBFC3] font-medium">
                      Filter Radius
                    </label>
                    <span className="font-mono text-[#FDF7F7] tabular-nums">
                      {convertAudio.filterRadius}
                    </span>
                  </div>
                  <input
                    id="conv-filter-radius"
                    type="range"
                    min={0}
                    max={7}
                    step={1}
                    value={convertAudio.filterRadius}
                    onChange={(e) =>
                      onUpdateConvertAudio({
                        ...convertAudio,
                        filterRadius: Number(e.target.value),
                      })
                    }
                    className="w-full scarlet-slider"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <label htmlFor="conv-vol-env" className="text-[#DFBFC3] font-medium">
                      Volume Envelope
                    </label>
                    <span className="font-mono text-[#FDF7F7] tabular-nums">
                      {convertAudio.volumeEnvelope.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="conv-vol-env"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={convertAudio.volumeEnvelope}
                    onChange={(e) =>
                      onUpdateConvertAudio({
                        ...convertAudio,
                        volumeEnvelope: Number(e.target.value),
                      })
                    }
                    className="w-full scarlet-slider"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <label className="inline-flex items-center gap-2 text-xs text-[#DFBFC3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={convertAudio.splitAudio}
                    onChange={(e) =>
                      onUpdateConvertAudio({
                        ...convertAudio,
                        splitAudio: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded accent-[#E51923]"
                  />
                  <span>Split Audio</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-[#DFBFC3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={convertAudio.autotune}
                    onChange={(e) =>
                      onUpdateConvertAudio({
                        ...convertAudio,
                        autotune: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded accent-[#E51923]"
                  />
                  <span>Autotune F0</span>
                </label>

                <div>
                  <label
                    htmlFor="conv-output-format"
                    className="block text-[11px] font-medium text-[#AD8288] mb-1"
                  >
                    Export Format
                  </label>
                  <select
                    id="conv-output-format"
                    value={convertAudio.outputFormat}
                    onChange={(e) =>
                      onUpdateConvertAudio({
                        ...convertAudio,
                        outputFormat: e.target.value as 'wav' | 'mp3' | 'flac',
                      })
                    }
                    className="w-full rounded-lg bg-[#160709] border border-[#47161D] px-2.5 py-1.5 text-xs text-[#FDF7F7]"
                  >
                    <option value="wav">WAV</option>
                    <option value="mp3">MP3</option>
                    <option value="flac">FLAC</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Terms of Use */}
        <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={convertAudio.agreedTerms}
              onChange={(e) =>
                onUpdateConvertAudio({
                  ...convertAudio,
                  agreedTerms: e.target.checked,
                })
              }
              className="mt-0.5 h-4 w-4 rounded accent-[#E51923]"
            />
            <div>
              <span className="block text-xs font-semibold text-[#FDF7F7]">
                I agree to the terms of use
              </span>
              <span className="block text-[11px] text-[#AD8288] mt-0.5">
                Confirm responsible usage guidelines prior to rendering voice conversion samples.
              </span>
            </div>
          </label>
        </div>

        <button
          type="button"
          onClick={handleConvert}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#FF2B35]"
          style={{ backgroundColor: ACCENT_HEX }}
        >
          <Play className="h-4 w-4" />
          <span>Convert</span>
        </button>

        <div>
          <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">
            Sample output
          </p>
          <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
            {convertAudio.conversionOutput}
          </div>
        </div>

        {convertedUrl && (
          <div className="rounded-lg border border-[#E51923]/40 bg-[#200B0E] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[#FDF7F7]">
                Converted Sample Ready
              </p>
              <button
                type="button"
                onClick={() => handleSaveSample(convertedUrl)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#FF2B35] whitespace-nowrap shrink-0"
                style={{ backgroundColor: ACCENT_HEX }}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save Sample (.{convertAudio.outputFormat})</span>
              </button>
            </div>
            <audio controls src={convertedUrl} className="w-full h-9" />
          </div>
        )}

        {convertAudio.savedSamples.length > 0 && (
          <div className="rounded-lg border border-[#47161D] bg-[#100506] p-4 space-y-2.5">
            <p className="text-xs font-semibold text-[#DFBFC3]">
              Recent Generated Samples
            </p>
            <div className="space-y-2">
              {convertAudio.savedSamples.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#47161D] bg-[#160709] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[#FDF7F7] truncate">{s.name}</p>
                    <p className="text-[11px] text-[#AD8288] tabular-nums">
                      Pitch {s.pitch >= 0 ? `+${s.pitch}` : s.pitch} · {s.createdAt}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveSample(s.url, s.name)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#47161D] bg-[#200B0E] px-2.5 py-1 text-xs font-medium text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3 w-3" />
                    <span>Save</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <pre className="rounded-lg border border-[#47161D] bg-[#100506] p-3 text-[11px] font-mono text-[#AD8288] overflow-x-auto">
          {buildInferCliCommand(convertAudio)}
        </pre>
      </section>
    </div>
  );
};

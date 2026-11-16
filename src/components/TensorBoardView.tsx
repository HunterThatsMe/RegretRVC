import React, { useRef, useState } from 'react';
import { Check, Copy, ExternalLink, FileUp, Play, Sparkles } from 'lucide-react';
import { ACCENT_HEX, SAMPLE_TRAINING_LOG } from '../data/defaults';
import { TrainingAnalysis } from '../types/studio';
import { parseTrainingNotebookOrLog } from '../utils/logParser';
import { LossChart } from './LossChart';

interface TensorBoardViewProps {
  lastAnalysis: TrainingAnalysis | null;
  onAnalysisChange: (analysis: TrainingAnalysis | null) => void;
}

const StepBadge: React.FC<{ num: number }> = ({ num }) => (
  <span
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white tabular-nums"
    style={{ backgroundColor: ACCENT_HEX }}
  >
    {num}
  </span>
);

export const TensorBoardView: React.FC<TensorBoardViewProps> = ({
  lastAnalysis,
  onAnalysisChange,
}) => {
  const [launched, setLaunched] = useState(false);
  const [tbUrl, setTbUrl] = useState('http://localhost:6006');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [logInput, setLogInput] = useState('');
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runParse = (raw: string) => {
    const parsed = parseTrainingNotebookOrLog(raw);
    if (!parsed) {
      setParseError(
        'Could not detect RVC training metrics. Paste Applio console stdout or upload a .ipynb file.'
      );
      return;
    }
    setParseError('');
    setLaunched(true);
    onAnalysisChange(parsed);
  };

  const handleLaunch = () => {
    setLaunched(true);
    setTbUrl('http://localhost:6006');
    if (!lastAnalysis) {
      runParse(SAMPLE_TRAINING_LOG);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(tbUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      setCopiedUrl(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setLogInput(text);
      runParse(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#FDF7F7] tracking-tight">
            TensorBoard
          </h2>
          <p className="text-sm text-[#DFBFC3] mt-1">
            Inspect Kaggle mel-loss curves, epoch speed, and run diagnostics from any training log.
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

      {/* 1. Controls */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <StepBadge num={1} />
          <div>
            <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
              Controls
            </h3>
            <p className="text-xs text-[#AD8288] mt-0.5">
              Start a local session preview or copy the Kaggle WebUI TensorBoard address.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleLaunch}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#FF2B35] whitespace-nowrap shrink-0"
            style={{ backgroundColor: ACCENT_HEX }}
          >
            <Play className="h-3.5 w-3.5" />
            <span>Launch TensorBoard</span>
          </button>

          {launched && (
            <div className="flex items-center gap-2 rounded-lg border border-[#47161D] bg-[#100506] px-3 py-1.5">
              <span className="font-mono text-xs text-[#DFBFC3]">{tbUrl}</span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 rounded-md border border-[#47161D] bg-[#200B0E] px-2 py-1 text-[11px] font-medium text-[#FDF7F7] hover:border-[#E51923]"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3 w-3 text-[#16A34A]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 2. Dashboard */}
      <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <StepBadge num={2} />
            <div>
              <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                Dashboard
              </h3>
              <p className="text-xs text-[#AD8288] mt-0.5">
                Upload a notebook or paste console output to chart training progress.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ipynb,.txt,.log"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#47161D] bg-[#200B0E] px-3 py-1.5 text-xs font-medium text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap shrink-0"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Import .ipynb / Log</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLogInput(SAMPLE_TRAINING_LOG);
                runParse(SAMPLE_TRAINING_LOG);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#47161D] bg-[#100506] px-3 py-1.5 text-xs font-medium text-[#DFBFC3] hover:text-white whitespace-nowrap shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Load Sample Run</span>
            </button>
          </div>
        </div>

        {!launched && !lastAnalysis ? (
          <div className="rounded-lg border border-[#47161D] bg-[#100506] p-8 text-center">
            <p className="text-sm text-[#DFBFC3]">
              Click &apos;Launch TensorBoard&apos; to start monitoring.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {lastAnalysis && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
                  <p className="text-[11px] text-[#AD8288]">Speaker</p>
                  <p className="text-sm font-semibold text-[#FDF7F7] truncate mt-0.5">
                    {lastAnalysis.speakerName}
                  </p>
                </div>
                <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
                  <p className="text-[11px] text-[#AD8288]">Segments</p>
                  <p className="text-sm font-mono font-semibold text-[#FDF7F7] tabular-nums mt-0.5">
                    {lastAnalysis.segmentCount}
                  </p>
                </div>
                <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
                  <p className="text-[11px] text-[#AD8288]">Epochs</p>
                  <p className="text-sm font-mono font-semibold text-[#FDF7F7] tabular-nums mt-0.5">
                    {lastAnalysis.epochsCompleted}
                  </p>
                </div>
                <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
                  <p className="text-[11px] text-[#AD8288]">Lowest Mel Loss</p>
                  <p className="text-sm font-mono font-semibold text-[#E51923] tabular-nums mt-0.5">
                    {lastAnalysis.lowestLoss !== null ? lastAnalysis.lowestLoss.toFixed(3) : '--'}
                  </p>
                </div>
                <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
                  <p className="text-[11px] text-[#AD8288]">Avg Epoch Speed</p>
                  <p className="text-sm font-mono font-semibold text-[#FDF7F7] tabular-nums mt-0.5">
                    {lastAnalysis.avgSpeedSec ? `${lastAnalysis.avgSpeedSec}s` : '--'}
                  </p>
                </div>
                <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
                  <p className="text-[11px] text-[#AD8288]">Vocoder</p>
                  <p className="text-sm font-semibold text-[#FDF7F7] truncate mt-0.5">
                    {lastAnalysis.vocoderDetected}
                  </p>
                </div>
              </div>
            )}

            <LossChart points={lastAnalysis?.points ?? []} />
          </div>
        )}

        <div className="space-y-2.5 pt-2 border-t border-[#47161D]">
          <textarea
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            rows={3}
            placeholder="Paste Kaggle notebook JSON or Applio training stdout (epoch=... | step=... | lowest_value=...)..."
            aria-label="Training log or notebook JSON input"
            className="w-full rounded-lg bg-[#100506] border border-[#47161D] p-3 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
          />
          <div className="flex items-center justify-between gap-3">
            {parseError ? (
              <p className="text-xs text-[#FF2B35]" role="alert">
                {parseError}
              </p>
            ) : (
              <span className="text-xs text-[#AD8288]">
                Live metrics are also embedded directly inside your exported Kaggle WebUI.
              </span>
            )}
            <button
              type="button"
              onClick={() => runParse(logInput)}
              className="rounded-lg border border-[#47161D] bg-[#200B0E] px-4 py-1.5 text-xs font-semibold text-[#FDF7F7] hover:border-[#E51923] whitespace-nowrap shrink-0"
            >
              Parse Training Run
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

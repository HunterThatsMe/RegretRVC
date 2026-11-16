import React, { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Shield,
} from 'lucide-react';
import {
  ACCENT_HEX,
  APPLIO_TAB_CATALOG,
  APP_VERSION,
  BRAND_NAME,
  SUPPORTED_LANGUAGES,
} from '../data/defaults';
import {
  ApplioGeneralSettings,
  ApplioTabId,
  ApplioTrainingSettings,
  BackupProvider,
  BackupScope,
  ForkConfig,
  RmvpeCorrectionMode,
  TrainingPrecision,
  TunnelMode,
} from '../types/studio';
import { validateForkConfig } from '../utils/rvcTuning';
import { NumberStepperInput } from './NumberStepperInput';

interface SettingsViewProps {
  generalSettings: ApplioGeneralSettings;
  trainingSettings: ApplioTrainingSettings;
  forkConfig: ForkConfig;
  onUpdateGeneral: (updated: ApplioGeneralSettings) => void;
  onUpdateTrainingSettings: (updated: ApplioTrainingSettings) => void;
  onUpdatePrecisionAcrossProjects: (precision: TrainingPrecision) => void;
  onUpdateForkConfig: (updated: ForkConfig) => void;
}

const StepBadge: React.FC<{ num: number }> = ({ num }) => (
  <span
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white tabular-nums"
    style={{ backgroundColor: ACCENT_HEX }}
  >
    {num}
  </span>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  generalSettings,
  trainingSettings,
  forkConfig,
  onUpdateGeneral,
  onUpdateTrainingSettings,
  onUpdatePrecisionAcrossProjects,
  onUpdateForkConfig,
}) => {
  const [subTab, setSubTab] = useState<'general' | 'training'>('general');
  const [pitchCorrOpen, setPitchCorrOpen] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [restartMsg, setRestartMsg] = useState('');
  const [authorOutput, setAuthorOutput] = useState(
    'The output information will be displayed here.'
  );
  const [precisionOutput, setPrecisionOutput] = useState(
    'The output information will be displayed here.'
  );

  const issues = validateForkConfig(forkConfig);

  const handleToggleTab = (tabId: ApplioTabId) => {
    onUpdateForkConfig({
      ...forkConfig,
      activeTabs: {
        ...forkConfig.activeTabs,
        [tabId]: !forkConfig.activeTabs[tabId],
      },
    });
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    onUpdateGeneral({
      ...generalSettings,
      versionStatus: `Checking latest ${BRAND_NAME} version...`,
    });
    try {
      const resp = await fetch('/api/check-updates');
      const data = (await resp.json()) as {
        ok: boolean;
        currentVersion?: string;
        newestVersion?: string;
        latestTag?: string;
        latestCommit?: string;
        upToDate?: boolean;
        error?: string;
      };
      const currentVer = data.currentVersion || APP_VERSION;
      const newestVer = data.newestVersion || data.latestTag || APP_VERSION;
      if (data.ok) {
        const commitSuffix = data.latestCommit ? ` (commit ${data.latestCommit})` : '';
        const statusMsg = `${BRAND_NAME} Beta version ${currentVer} is up to date (newest version: ${newestVer})${commitSuffix}.`;
        onUpdateGeneral({ ...generalSettings, versionStatus: statusMsg });
      } else {
        onUpdateGeneral({
          ...generalSettings,
          versionStatus: `${BRAND_NAME} Beta version ${currentVer} (newest version: ${newestVer}). ${data.error || 'Offline check complete.'}`,
        });
      }
    } catch {
      onUpdateGeneral({
        ...generalSettings,
        versionStatus: `${BRAND_NAME} Beta version ${APP_VERSION} (newest version: ${APP_VERSION}). Network check failed.`,
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleRestartApplio = () => {
    setRestartMsg('Restart signal queued for Kaggle WebUI runtime (port 6969).');
    setTimeout(() => setRestartMsg(''), 2500);
  };

  const handleSetAuthor = () => {
    const cleaned = trainingSettings.modelAuthor.trim() || 'None';
    onUpdateTrainingSettings({ ...trainingSettings, modelAuthor: cleaned });
    setAuthorOutput(`Model author set to "${cleaned}".`);
  };

  const handleUpdatePrecision = () => {
    onUpdatePrecisionAcrossProjects(trainingSettings.precision);
    setPrecisionOutput(
      `Training & inference precision updated to ${trainingSettings.precision.toUpperCase()}.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#FDF7F7] tracking-tight">
            Settings
          </h2>
          <p className="text-sm text-[#DFBFC3] mt-1">
            Customize engine preferences, Kaggle tunnel defaults, checkpoint backups, and active fork tabs.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[#47161D] bg-[#160709] p-1">
          <button
            type="button"
            onClick={() => setSubTab('general')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'general'
                ? 'bg-[#E51923] text-white'
                : 'text-[#DFBFC3] hover:text-white'
            }`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setSubTab('training')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'training'
                ? 'bg-[#E51923] text-white'
                : 'text-[#DFBFC3] hover:text-white'
            }`}
          >
            Training
          </button>
        </div>
      </div>

      {subTab === 'general' ? (
        <div className="space-y-5">
          {/* 1. List Filtering */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <StepBadge num={1} />
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  List Filtering
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Display a search bar to quickly filter long checkpoint and index dropdowns.
                </p>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-[#47161D] bg-[#100506] px-4 py-3 cursor-pointer">
              <div>
                <span className="block text-xs font-semibold text-[#FDF7F7]">
                  Enable model/index list filter
                </span>
                <span className="block text-[11px] text-[#AD8288] mt-0.5">
                  Automatically off by default to keep model and index selectors clean without extra search boxes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={false}
                readOnly
                disabled
                aria-label="Enable model/index list filter (always off)"
                className="h-4 w-4 rounded accent-[#E51923] opacity-60 cursor-not-allowed"
              />
            </label>
          </section>

          {/* 2. Pitch Correction */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <StepBadge num={2} />
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  Pitch Correction
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Prevent high-note octave flips during RMVPE F0 pitch extraction.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#47161D] bg-[#100506]">
              <button
                type="button"
                onClick={() => setPitchCorrOpen((v) => !v)}
                aria-expanded={pitchCorrOpen}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#DFBFC3] hover:text-white"
              >
                <span>RMVPE high-register correction</span>
                {pitchCorrOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {pitchCorrOpen && (
                <div className="border-t border-[#47161D] p-4 space-y-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div>
                      <span className="block text-xs font-semibold text-[#FDF7F7]">
                        Enable RMVPE high-register correction
                      </span>
                      <span className="block text-[11px] text-[#AD8288] mt-0.5 leading-relaxed">
                        Runs a secondary octave-down pass above ~1040 Hz to catch upper-register pitch jumps. Disabled by default so standard RMVPE behavior remains untouched unless checked.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={generalSettings.rmvpeHighRegisterCorrection}
                      onChange={(e) =>
                        onUpdateGeneral({
                          ...generalSettings,
                          rmvpeHighRegisterCorrection: e.target.checked,
                        })
                      }
                      className="mt-1 h-4 w-4 shrink-0 rounded accent-[#E51923]"
                    />
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="settings-rmvpe-mode"
                        className="block text-xs font-semibold text-[#FDF7F7]"
                      >
                        Correction mode
                      </label>
                      <p className="text-[11px] text-[#AD8288] mt-0.5 mb-1.5 leading-relaxed">
                        true_pitch tracks the actual note up to the F0 cap; fold corrects only misdetected octave frames.
                      </p>
                      <select
                        id="settings-rmvpe-mode"
                        value={generalSettings.rmvpeCorrectionMode}
                        onChange={(e) =>
                          onUpdateGeneral({
                            ...generalSettings,
                            rmvpeCorrectionMode: e.target.value as RmvpeCorrectionMode,
                          })
                        }
                        className="w-full rounded-lg bg-[#160709] border border-[#47161D] px-3 py-2 text-xs text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                      >
                        <option value="true_pitch">true_pitch</option>
                        <option value="fold">fold</option>
                      </select>
                    </div>

                    <div className="rounded-lg border border-[#47161D] bg-[#160709] p-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div>
                          <label
                            htmlFor="settings-f0-ceiling"
                            className="block text-xs font-semibold text-[#FDF7F7]"
                          >
                            F0 ceiling (Hz)
                          </label>
                          <p className="text-[11px] text-[#AD8288]">
                            Upper frequency cap applied in true_pitch mode.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-xs text-[#FDF7F7] tabular-nums">
                            {generalSettings.rmvpeF0CeilingHz}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateGeneral({
                                ...generalSettings,
                                rmvpeF0CeilingHz: 1250,
                              })
                            }
                            aria-label="Reset F0 ceiling to 1250"
                            className="rounded-md border border-[#47161D] bg-[#200B0E] p-1 text-[#DFBFC3] hover:text-white"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <input
                        id="settings-f0-ceiling"
                        type="range"
                        min={1000}
                        max={2000}
                        step={25}
                        value={generalSettings.rmvpeF0CeilingHz}
                        onChange={(e) =>
                          onUpdateGeneral({
                            ...generalSettings,
                            rmvpeF0CeilingHz: Number(e.target.value),
                          })
                        }
                        className="w-full scarlet-slider"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#AD8288] mt-1 tabular-nums">
                        <span>1000</span>
                        <span>2000</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. Discord Integration */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <StepBadge num={3} />
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  Discord Integration
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Broadcast your active studio session to Discord Rich Presence.
                </p>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-[#47161D] bg-[#100506] px-4 py-3 cursor-pointer">
              <div>
                <span className="block text-xs font-semibold text-[#FDF7F7]">
                  Enable Discord Rich Presence
                </span>
                <span className="block text-[11px] text-[#AD8288] mt-0.5">
                  Displays your active training or sampling status on your Discord profile.
                </span>
              </div>
              <input
                type="checkbox"
                checked={generalSettings.discordPresence}
                onChange={(e) =>
                  onUpdateGeneral({
                    ...generalSettings,
                    discordPresence: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded accent-[#E51923]"
              />
            </label>
          </section>

          {/* 4. Language (No Appearance option!) */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <StepBadge num={4} />
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  Language
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Set the preferred display locale for exported WebUI sessions.
                </p>
              </div>
            </div>
            <div>
              <label
                htmlFor="settings-language"
                className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
              >
                Language
              </label>
              <select
                id="settings-language"
                value={generalSettings.language}
                onChange={(e) =>
                  onUpdateGeneral({
                    ...generalSettings,
                    language: e.target.value,
                  })
                }
                className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* 5. Updates & System */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <StepBadge num={5} />
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  Updates &amp; System
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Check the newest {BRAND_NAME} version or trigger a Kaggle WebUI restart.
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#FDF7F7]">Version Checker</p>
              <p className="text-[11px] text-[#AD8288] mb-2">
                Verifies your installed {BRAND_NAME} build against the newest available release (currently {APP_VERSION}).
              </p>
              <div className="rounded-lg border border-[#47161D] bg-[#100506] px-4 py-3 text-xs font-mono text-[#DFBFC3]">
                {generalSettings.versionStatus}
              </div>
            </div>
            {restartMsg && (
              <p className="text-xs text-[#DFBFC3]" role="status">
                {restartMsg}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={checkingUpdates}
                onClick={handleCheckUpdates}
                className="inline-flex items-center gap-2 rounded-lg border border-[#47161D] bg-[#200B0E] px-4 py-2 text-xs font-semibold text-[#FDF7F7] hover:border-[#E51923] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
                <span>{checkingUpdates ? 'Checking...' : 'Check for updates'}</span>
              </button>
              <button
                type="button"
                onClick={handleRestartApplio}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF2B35] whitespace-nowrap shrink-0"
                style={{ backgroundColor: ACCENT_HEX }}
              >
                Restart Applio
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          {issues.length > 0 && (
            <div className="space-y-2">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                    issue.severity === 'error'
                      ? 'border-[#FF2B35]/50 bg-[#FF2B35]/10 text-[#FECACA]'
                      : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FDE68A]'
                  }`}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* 1. Model Author */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <StepBadge num={1} />
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  Model Author
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Credit written into exported model metadata headers.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="settings-model-author"
                className="block text-xs font-semibold text-[#FDF7F7]"
              >
                Model Author Name
              </label>
              <p className="text-[11px] text-[#AD8288] mb-1.5">
                Creator handle embedded in published checkpoints.
              </p>
              <input
                id="settings-model-author"
                type="text"
                value={trainingSettings.modelAuthor}
                onChange={(e) =>
                  onUpdateTrainingSettings({
                    ...trainingSettings,
                    modelAuthor: e.target.value,
                  })
                }
                className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">
                Model author output
              </p>
              <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
                {authorOutput}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSetAuthor}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF2B35] whitespace-nowrap shrink-0"
              style={{ backgroundColor: ACCENT_HEX }}
            >
              Set name
            </button>
          </section>

          {/* 2. Training Precision (fp32 default) */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <StepBadge num={2} />
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  Training Precision
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Control floating-point accuracy across training and voice conversion.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="settings-precision"
                className="block text-xs font-semibold text-[#FDF7F7]"
              >
                Precision
              </label>
              <p className="text-[11px] text-[#AD8288] mb-1.5">
                FP32 prioritizes maximum stability on T4 GPUs; FP16 lowers VRAM usage.
              </p>
              <select
                id="settings-precision"
                value={trainingSettings.precision}
                onChange={(e) =>
                  onUpdateTrainingSettings({
                    ...trainingSettings,
                    precision: e.target.value as TrainingPrecision,
                  })
                }
                className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
              >
                <option value="fp32">fp32</option>
                <option value="fp16">fp16</option>
              </select>
            </div>

            <div>
              <p className="text-xs font-medium text-[#DFBFC3] mb-1.5">
                Precision output
              </p>
              <div className="rounded-lg border border-[#47161D] bg-[#100506] px-3.5 py-2.5 text-xs font-mono text-[#DFBFC3]">
                {precisionOutput}
              </div>
            </div>

            <button
              type="button"
              onClick={handleUpdatePrecision}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF2B35] whitespace-nowrap shrink-0"
              style={{ backgroundColor: ACCENT_HEX }}
            >
              Update precision
            </button>
          </section>

          {/* 3. Kaggle Tunnel & Security */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
            <div className="flex items-start gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: ACCENT_HEX }}
              >
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                  Kaggle Tunnel &amp; Runtime Hardening
                </h3>
                <p className="text-xs text-[#AD8288] mt-0.5">
                  Hardened Cloudflare tunnels, random 24-byte session credentials, and isolated uv Python 3.12 + CUDA 12.8 setup.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="kaggle-tunnel-mode"
                  className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                >
                  Tunnel Mode
                </label>
                <select
                  id="kaggle-tunnel-mode"
                  value={forkConfig.tunnelMode}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      tunnelMode: e.target.value as TunnelMode,
                    })
                  }
                  className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                >
                  <option value="Gradio + Cloudflare">Gradio + Cloudflare</option>
                  <option value="Horizon">Horizon (hrzn.run)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="kaggle-custom-repo"
                  className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                >
                  Base Fork GitHub URL (Optional)
                </label>
                <input
                  id="kaggle-custom-repo"
                  type="url"
                  value={forkConfig.customRepoUrl}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      customRepoUrl: e.target.value,
                    })
                  }
                  placeholder="https://github.com/IAHispano/Applio.git"
                  className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
                />
              </div>
            </div>

            {forkConfig.tunnelMode === 'Horizon' && (
              <div>
                <label
                  htmlFor="kaggle-horizon-id"
                  className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                >
                  Horizon ID
                </label>
                <input
                  id="kaggle-horizon-id"
                  type="text"
                  value={forkConfig.horizonId}
                  onChange={(e) =>
                    onUpdateForkConfig({ ...forkConfig, horizonId: e.target.value })
                  }
                  placeholder="Paste Horizon ID from hrzn.run/dashboard"
                  className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] placeholder-[#AD8288]/45 focus:outline-none focus:border-[#E51923]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 rounded-lg border border-[#47161D] bg-[#100506] p-3 text-xs text-[#FDF7F7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={forkConfig.randomAuthEnabled}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      randomAuthEnabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded accent-[#E51923]"
                />
                <span>Random 24-byte WebUI &amp; FileBrowser Passwords</span>
              </label>
              <label className="flex items-center gap-2.5 rounded-lg border border-[#47161D] bg-[#100506] p-3 text-xs text-[#FDF7F7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={forkConfig.embeddedTensorBoard}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      embeddedTensorBoard: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded accent-[#E51923]"
                />
                <span>Embed TensorBoard Inside WebUI</span>
              </label>
              <label className="flex items-center gap-2.5 rounded-lg border border-[#47161D] bg-[#100506] p-3 text-xs text-[#FDF7F7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={forkConfig.useUvVenv}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      useUvVenv: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded accent-[#E51923]"
                />
                <span>Use uv Python 3.12 + CUDA 12.8 Venv</span>
              </label>
              <label className="flex items-center gap-2.5 rounded-lg border border-[#47161D] bg-[#100506] p-3 text-xs text-[#FDF7F7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={forkConfig.verifyOnnxGpu}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      verifyOnnxGpu: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded accent-[#E51923]"
                />
                <span>Verify onnxruntime-gpu CUDAExecutionProvider</span>
              </label>
            </div>
          </section>

          {/* 4. Checkpoint Auto-Backup */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-5">
            <div>
              <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                Checkpoint Auto-Backup (Hugging Face / Google Drive)
              </h3>
              <p className="text-xs text-[#AD8288] mt-0.5">
                Writes core_backup.py so checkpoints and index files push off Kaggle automatically before runtime limits hit.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="backup-provider"
                  className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                >
                  Backup Provider
                </label>
                <select
                  id="backup-provider"
                  value={forkConfig.backupProvider}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      backupProvider: e.target.value as BackupProvider,
                    })
                  }
                  className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                >
                  <option value="huggingface">Hugging Face Hub</option>
                  <option value="google-drive">Google Drive (rclone)</option>
                  <option value="both">Both (HF + Drive)</option>
                  <option value="none">Disabled</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="backup-interval"
                  className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                >
                  Sync Every (Epochs)
                </label>
                <NumberStepperInput
                  id="backup-interval"
                  value={forkConfig.backupEveryEpochs}
                  min={5}
                  max={250}
                  step={5}
                  ariaLabel="Sync Every Epochs"
                  unitName="sync interval epochs"
                  inputWidthClass="w-16"
                  onChange={(next) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      backupEveryEpochs: next,
                    })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="backup-scope"
                  className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                >
                  Artifact Scope
                </label>
                <select
                  id="backup-scope"
                  value={forkConfig.backupScope}
                  onChange={(e) =>
                    onUpdateForkConfig({
                      ...forkConfig,
                      backupScope: e.target.value as BackupScope,
                    })
                  }
                  className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-sm text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                >
                  <option value="weights-and-index">Weights (.pth) + Index</option>
                  <option value="full-checkpoints">Full Checkpoints (G_ / D_)</option>
                </select>
              </div>
            </div>

            {(forkConfig.backupProvider === 'huggingface' ||
              forkConfig.backupProvider === 'both') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label
                    htmlFor="backup-hf-repo"
                    className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                  >
                    Hugging Face Repo ID
                  </label>
                  <input
                    id="backup-hf-repo"
                    type="text"
                    value={forkConfig.hfRepoId}
                    onChange={(e) =>
                      onUpdateForkConfig({ ...forkConfig, hfRepoId: e.target.value })
                    }
                    className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                  />
                </div>
                <label className="flex items-center gap-2.5 rounded-lg border border-[#47161D] bg-[#100506] px-3 py-2.5 text-xs text-[#FDF7F7] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forkConfig.hfPrivate}
                    onChange={(e) =>
                      onUpdateForkConfig({ ...forkConfig, hfPrivate: e.target.checked })
                    }
                    className="h-4 w-4 rounded accent-[#E51923]"
                  />
                  <span>Create Private HF Model Repository</span>
                </label>
              </div>
            )}

            {(forkConfig.backupProvider === 'google-drive' ||
              forkConfig.backupProvider === 'both') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="backup-drive-remote"
                    className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                  >
                    rclone Remote Name
                  </label>
                  <input
                    id="backup-drive-remote"
                    type="text"
                    value={forkConfig.driveRemoteName}
                    onChange={(e) =>
                      onUpdateForkConfig({
                        ...forkConfig,
                        driveRemoteName: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="backup-drive-folder"
                    className="block text-xs font-semibold text-[#FDF7F7] mb-1.5"
                  >
                    Drive Folder Path
                  </label>
                  <input
                    id="backup-drive-folder"
                    type="text"
                    value={forkConfig.driveFolderPath}
                    onChange={(e) =>
                      onUpdateForkConfig({
                        ...forkConfig,
                        driveFolderPath: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-mono text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 5. Active WebUI Tabs */}
          <section className="rounded-xl border border-[#47161D] bg-[#160709] p-6 space-y-4">
            <div>
              <h3 className="font-display text-base font-semibold text-[#FDF7F7]">
                Included Tabs in Exported app.py
              </h3>
              <p className="text-xs text-[#AD8288] mt-0.5">
                Choose which workspace tabs are compiled into your exported Kaggle WebUI layout.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {APPLIO_TAB_CATALOG.map((tab) => {
                const enabled = forkConfig.activeTabs[tab.id];
                return (
                  <label
                    key={tab.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                      enabled
                        ? 'border-[#E51923]/60 bg-[#200B0E]'
                        : 'border-[#47161D] bg-[#100506] opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggleTab(tab.id)}
                      className="mt-0.5 h-4 w-4 rounded accent-[#E51923]"
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-[#FDF7F7]">
                        {tab.label}
                      </span>
                      <span className="block text-[11px] text-[#AD8288] mt-0.5 leading-snug">
                        {tab.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import {
  Activity,
  AudioWaveform,
  Combine,
  Download,
  Mic,
  Settings,
  Sliders,
  X,
} from 'lucide-react';
import { ACCENT_HEX, APP_VERSION, BRAND_NAME } from '../data/defaults';
import { StudioSection, VoiceModelProject } from '../types/studio';

interface SidebarProps {
  activeSection: StudioSection;
  onSelectSection: (section: StudioSection) => void;
  projects: VoiceModelProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const SIDEBAR_NAV: {
  id: StudioSection;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  { id: 'training', label: 'Training', icon: AudioWaveform },
  { id: 'models', label: 'Models', icon: Download },
  { id: 'samples', label: 'Samples', icon: Mic },
  { id: 'blender', label: 'Voice Blender', icon: Combine },
  { id: 'tts', label: 'TTS', icon: Sliders },
  { id: 'tensorboard', label: 'TensorBoard', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  projects,
  activeProjectId,
  onSelectProject,
  mobileOpen,
  onCloseMobile,
}) => {
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const content = (
    <div className="flex h-full flex-col justify-between bg-[#160709] border-r border-[#47161D] px-4 py-5">
      <div>
        <div className="flex items-center justify-between px-2 pb-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="scarlet-logo-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white font-display font-bold text-sm"
              style={{ backgroundColor: ACCENT_HEX }}
            >
              NR
            </span>
            <div className="min-w-0">
              <span className="block font-display text-base font-semibold tracking-tight text-[#FDF7F7] truncate leading-tight">
                {BRAND_NAME}
              </span>
              <span className="block text-[10px] font-medium tracking-wide text-[#DFBFC3]/45 leading-tight mt-0.5">
                Beta version {APP_VERSION}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="md:hidden rounded-lg p-2 text-[#DFBFC3] hover:text-white hover:bg-[#200B0E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Workspace sections" className="space-y-1">
          {SIDEBAR_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 overflow-hidden ${
                  isActive
                    ? 'bg-[#200B0E] text-[#FDF7F7] border border-[#E51923]/25'
                    : 'text-[#DFBFC3]/80 border border-transparent hover:text-[#FDF7F7] hover:bg-[#200B0E]/60'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="scarlet-tab-bar-pulse absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                    style={{ backgroundColor: ACCENT_HEX }}
                  />
                )}
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'scarlet-icon-pulse' : ''}`}
                  style={isActive ? { color: ACCENT_HEX } : undefined}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[#47161D] pt-4">
        <label
          htmlFor="sidebar-project-select"
          className="block text-xs font-medium text-[#DFBFC3] mb-2 px-1"
        >
          Active Voice Model
        </label>
        <select
          id="sidebar-project-select"
          value={activeProject?.id ?? ''}
          onChange={(e) => onSelectProject(e.target.value)}
          className="w-full rounded-lg bg-[#100506] border border-[#47161D] px-3 py-2 text-xs font-medium text-[#FDF7F7] focus:outline-none focus:border-[#E51923]"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name.trim() || 'Untitled Model'} ({p.samplingRate})
            </option>
          ))}
        </select>
        {activeProject && (
          <p className="mt-2 px-1 text-xs text-[#AD8288] tabular-nums">
            {activeProject.vocoder} · Batch {activeProject.batchSize} ({activeProject.batchSize * activeProject.gpuCount} eff.) · {activeProject.totalEpoch} ep
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 h-full">{content}</div>
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={onCloseMobile}
            className="flex-1 bg-black/70"
          />
        </div>
      )}
    </>
  );
};

import React from 'react';
import { Download, Menu } from 'lucide-react';
import { ACCENT_HEX, BRAND_NAME } from '../data/defaults';
import { StudioSection } from '../types/studio';

interface TopBarProps {
  activeSection: StudioSection;
  onDownloadNotebook: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<StudioSection, string> = {
  training: 'Training',
  samples: 'Samples',
  blender: 'Voice Blender',
  tts: 'TTS',
  models: 'Models',
  tensorboard: 'TensorBoard',
  settings: 'Settings',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onDownloadNotebook,
  onOpenMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-[#0D0405]/92 backdrop-blur-md border-b border-[#47161D] px-4 md:px-8 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden rounded-lg p-2 text-[#DFBFC3] hover:text-white hover:bg-[#200B0E]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-[#AD8288] whitespace-nowrap shrink-0">
            {BRAND_NAME}
          </span>
          <span className="hidden sm:inline text-[#6D202B]" aria-hidden="true">
            /
          </span>
          <span
            aria-hidden="true"
            className="scarlet-tab-bar-pulse h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: ACCENT_HEX }}
          />
          <h1 className="font-display font-semibold text-[#FDF7F7] truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      <button
        type="button"
        onClick={onDownloadNotebook}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF2B35] active:scale-[0.98] whitespace-nowrap shrink-0"
        style={{ backgroundColor: ACCENT_HEX }}
      >
        <Download className="h-3.5 w-3.5" />
        <span>Download .ipynb</span>
      </button>
    </header>
  );
};

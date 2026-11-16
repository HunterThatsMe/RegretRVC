import { useEffect, useState } from 'react';
import { BRAND_NAME, DEFAULT_PROJECTS, DEFAULT_STUDIO_STATE } from './data/defaults';
import {
  ApplioGeneralSettings,
  ApplioTrainingSettings,
  BlenderRecipe,
  ConvertAudioState,
  DownloadModelItem,
  ForkConfig,
  ImportedLocalModel,
  StudioSection,
  StudioState,
  TrainingAnalysis,
  TrainingPrecision,
  TtsDefaults,
  VoiceModelProject,
} from './types/studio';
import { generateKaggleNotebookJson } from './utils/forkGenerator';
import { triggerBlobDownload } from './utils/download';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TrainWorkspaceView } from './components/TrainWorkspaceView';
import { ConvertAudioView } from './components/ConvertAudioView';
import { WorkbenchView } from './components/WorkbenchView';
import { TensorBoardView } from './components/TensorBoardView';
import { SettingsView } from './components/SettingsView';

const STORAGE_KEY = 'noregrets_rvc_studio_v5';

const VALID_SECTIONS: StudioSection[] = [
  'training',
  'models',
  'samples',
  'blender',
  'tts',
  'tensorboard',
  'settings',
];

function loadInitialState(): StudioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STUDIO_STATE;
    const parsed = JSON.parse(raw) as Partial<StudioState>;
    if (!parsed.projects || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      return DEFAULT_STUDIO_STATE;
    }
    const safeSection: StudioSection = VALID_SECTIONS.includes(
      parsed.activeSection as StudioSection
    )
      ? (parsed.activeSection as StudioSection)
      : 'training';
    return {
      ...DEFAULT_STUDIO_STATE,
      ...parsed,
      activeSection: safeSection,
      convertAudio: {
        ...DEFAULT_STUDIO_STATE.convertAudio,
        ...(parsed.convertAudio ?? {}),
        audioObjectUrl: '',
        savedSamples: [],
      },
      generalSettings: {
        ...DEFAULT_STUDIO_STATE.generalSettings,
        ...(parsed.generalSettings ?? {}),
        listFilterEnabled: false,
      },
      trainingSettings: {
        ...DEFAULT_STUDIO_STATE.trainingSettings,
        ...(parsed.trainingSettings ?? {}),
      },
      forkConfig: {
        ...DEFAULT_STUDIO_STATE.forkConfig,
        ...(parsed.forkConfig ?? {}),
        activeTabs: {
          ...DEFAULT_STUDIO_STATE.forkConfig.activeTabs,
          ...(parsed.forkConfig?.activeTabs ?? {}),
        },
      },
      blender: {
        ...DEFAULT_STUDIO_STATE.blender,
        ...(parsed.blender ?? {}),
      },
      ttsDefaults: {
        ...DEFAULT_STUDIO_STATE.ttsDefaults,
        ...(parsed.ttsDefaults ?? {}),
      },
    };
  } catch {
    return DEFAULT_STUDIO_STATE;
  }
}

export default function App() {
  const [state, setState] = useState<StudioState>(loadInitialState);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const serializable: StudioState = {
        ...state,
        convertAudio: {
          ...state.convertAudio,
          audioObjectUrl: '',
          savedSamples: [],
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const activeProject =
    state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];

  const handleSelectSection = (activeSection: StudioSection) => {
    setState((prev) => ({ ...prev, activeSection }));
  };

  const handleSelectProject = (id: string) => {
    setState((prev) => ({ ...prev, activeProjectId: id }));
  };

  const handleUpdateProject = (updated: VoiceModelProject) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p
      ),
    }));
  };

  const handleCreateProject = (name: string) => {
    const created: VoiceModelProject = {
      ...DEFAULT_PROJECTS[0],
      id: `proj-${Date.now()}`,
      name,
      fp16: state.trainingSettings.precision === 'fp16',
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      projects: [created, ...prev.projects],
      activeProjectId: created.id,
    }));
  };

  const handleDeleteProject = (id: string) => {
    setState((prev) => {
      if (prev.projects.length <= 1) return prev;
      const remaining = prev.projects.filter((p) => p.id !== id);
      return {
        ...prev,
        projects: remaining,
        activeProjectId:
          prev.activeProjectId === id ? remaining[0].id : prev.activeProjectId,
      };
    });
  };

  const handleUpdateConvertAudio = (convertAudio: ConvertAudioState) => {
    setState((prev) => ({ ...prev, convertAudio }));
  };

  const handleUpdateGeneral = (generalSettings: ApplioGeneralSettings) => {
    setState((prev) => ({ ...prev, generalSettings }));
  };

  const handleUpdateTrainingSettings = (trainingSettings: ApplioTrainingSettings) => {
    setState((prev) => ({ ...prev, trainingSettings }));
  };

  const handleUpdatePrecisionAcrossProjects = (precision: TrainingPrecision) => {
    setState((prev) => ({
      ...prev,
      trainingSettings: { ...prev.trainingSettings, precision },
      projects: prev.projects.map((p) => ({
        ...p,
        fp16: precision === 'fp16',
      })),
    }));
  };

  const handleUpdateForkConfig = (forkConfig: ForkConfig) => {
    setState((prev) => ({ ...prev, forkConfig }));
  };

  const handleUpdateBlender = (blender: BlenderRecipe) => {
    setState((prev) => ({ ...prev, blender }));
  };

  const handleUpdateTts = (ttsDefaults: TtsDefaults) => {
    setState((prev) => ({ ...prev, ttsDefaults }));
  };

  const handleUpdateManifest = (downloadManifest: DownloadModelItem[]) => {
    setState((prev) => ({ ...prev, downloadManifest }));
  };

  const handleUpdateImportedModels = (importedModels: ImportedLocalModel[]) => {
    setState((prev) => ({ ...prev, importedModels }));
  };

  const handleAnalysisChange = (lastAnalysis: TrainingAnalysis | null) => {
    setState((prev) => ({ ...prev, lastAnalysis }));
  };

  const handleDownloadNotebook = () => {
    const content = generateKaggleNotebookJson(
      state.forkConfig,
      activeProject,
      state.downloadManifest
    );
    triggerBlobDownload(
      `${BRAND_NAME}_Kaggle.ipynb`,
      content,
      'application/x-ipynb+json'
    );
  };

  return (
    <div className="min-h-screen flex bg-[#0D0405] text-[#FDF7F7]">
      <Sidebar
        activeSection={state.activeSection}
        onSelectSection={handleSelectSection}
        projects={state.projects}
        activeProjectId={activeProject.id}
        onSelectProject={handleSelectProject}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={state.activeSection}
          onDownloadNotebook={handleDownloadNotebook}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 px-4 md:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {state.activeSection === 'training' && (
            <TrainWorkspaceView
              projects={state.projects}
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              onUpdateProject={handleUpdateProject}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {state.activeSection === 'samples' && (
            <ConvertAudioView
              convertAudio={state.convertAudio}
              projects={state.projects}
              importedModels={state.importedModels}
              onUpdateConvertAudio={handleUpdateConvertAudio}
            />
          )}

          {(state.activeSection === 'blender' ||
            state.activeSection === 'tts' ||
            state.activeSection === 'models') && (
            <WorkbenchView
              mode={state.activeSection}
              projects={state.projects}
              blender={state.blender}
              ttsDefaults={state.ttsDefaults}
              downloadManifest={state.downloadManifest}
              importedModels={state.importedModels}
              onUpdateBlender={handleUpdateBlender}
              onUpdateTts={handleUpdateTts}
              onUpdateManifest={handleUpdateManifest}
              onUpdateImportedModels={handleUpdateImportedModels}
            />
          )}

          {state.activeSection === 'tensorboard' && (
            <TensorBoardView
              lastAnalysis={state.lastAnalysis}
              onAnalysisChange={handleAnalysisChange}
            />
          )}

          {state.activeSection === 'settings' && (
            <SettingsView
              generalSettings={state.generalSettings}
              trainingSettings={state.trainingSettings}
              forkConfig={state.forkConfig}
              onUpdateGeneral={handleUpdateGeneral}
              onUpdateTrainingSettings={handleUpdateTrainingSettings}
              onUpdatePrecisionAcrossProjects={handleUpdatePrecisionAcrossProjects}
              onUpdateForkConfig={handleUpdateForkConfig}
            />
          )}
        </main>
      </div>
    </div>
  );
}

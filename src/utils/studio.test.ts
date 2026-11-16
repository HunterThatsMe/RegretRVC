import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION, DEFAULT_PROJECTS, DEFAULT_STUDIO_STATE, SAMPLE_TRAINING_LOG } from '../data/defaults.ts';
import {
  buildBlendCliCommand,
  buildInferCliCommand,
  buildTrainPipelineCommands,
  estimateT4VramUsage,
  validateForkConfig,
} from './rvcTuning.ts';
import { parseTrainingNotebookOrLog } from './logParser.ts';
import { generateForkBundle } from './forkGenerator.ts';
import { buildZipArchive } from './zipBuilder.ts';

test('default project uses empty model name, 32000 SR, batch 2, save every 5, total 200, fp32, and required checkbox defaults', () => {
  const def = DEFAULT_PROJECTS[0];
  assert.equal(APP_VERSION, '0.0');
  assert.equal(def.name, '');
  assert.equal(def.samplingRate, '32000');
  assert.equal(def.batchSize, 2);
  assert.equal(def.saveEveryEpoch, 5);
  assert.equal(def.totalEpoch, 200);
  assert.equal(def.silentTrainingFiles, 0);
  assert.equal(def.fp16, false);
  assert.equal(def.truncateSilenceEnabled, false);
  assert.equal(def.noiseFilter, false);
  assert.equal(def.loudnessNorm, false);
  assert.equal(def.saveOnlyLatest, true);
  assert.equal(def.saveEveryWeights, true);
  assert.equal(def.pretrained, true);
  assert.equal(def.freshTraining, false);
  assert.equal(def.cacheDatasetGpu, false);
  assert.equal(def.checkpointing, false);
  assert.equal(def.shutdownAfterFinish, false);
  assert.equal(def.customPretrained, false);
  assert.equal(def.agreedTerms, true);
  assert.equal(DEFAULT_STUDIO_STATE.convertAudio.agreedTerms, true);
  assert.equal(DEFAULT_STUDIO_STATE.generalSettings.listFilterEnabled, false);
  assert.equal(DEFAULT_STUDIO_STATE.trainingSettings.precision, 'fp32');
});

test('estimateT4VramUsage flags Risk of OOM for oversized RefineGAN FP32 batch and Optimal for default', () => {
  const heavy = {
    ...DEFAULT_PROJECTS[0],
    samplingRate: '48000' as const,
    vocoder: 'RefineGAN' as const,
    batchSize: 16,
    fp16: false,
  };
  const est = estimateT4VramUsage(heavy);
  assert.equal(est.fitStatus, 'Risk of OOM');
  assert.ok(est.estimatedVramGb > 14.5);

  const defEst = estimateT4VramUsage(DEFAULT_PROJECTS[0]);
  assert.equal(defEst.fitStatus, 'Optimal');
});

test('buildTrainPipelineCommands emits truncate silence & loudness flags when toggled on', () => {
  const withToggles = {
    ...DEFAULT_PROJECTS[0],
    name: 'TestVoice',
    datasetPath: '/kaggle/input/datasets/user/ds',
    truncateSilenceEnabled: true,
    silenceDurationMs: 450,
    loudnessNorm: true,
  };
  const trainCmd = buildTrainPipelineCommands(withToggles);
  assert.match(trainCmd, /--truncate_silence True --silence_duration_ms 450/);
  assert.match(trainCmd, /--process_effects True --loudness_target -14/);
  assert.match(trainCmd, /--fp16 False/);

  const inferCmd = buildInferCliCommand(DEFAULT_STUDIO_STATE.convertAudio);
  assert.match(inferCmd, /python core\.py infer/);

  const blendCmd = buildBlendCliCommand(DEFAULT_STUDIO_STATE.blender);
  assert.match(blendCmd, /python core\.py model_blend/);
});

test('validateForkConfig catches invalid Hugging Face repo ID and missing Horizon ID', () => {
  const issues = validateForkConfig({
    ...DEFAULT_STUDIO_STATE.forkConfig,
    tunnelMode: 'Horizon',
    horizonId: '',
    backupProvider: 'huggingface',
    hfRepoId: 'invalid-no-slash',
  });
  assert.ok(issues.some((i) => i.field === 'hfRepoId' && i.severity === 'error'));
  assert.ok(issues.some((i) => i.field === 'horizonId' && i.severity === 'warning'));
});

test('parseTrainingNotebookOrLog parses raw training stdout and ipynb JSON accurately', () => {
  const rawResult = parseTrainingNotebookOrLog(SAMPLE_TRAINING_LOG);
  assert.ok(rawResult);
  assert.equal(rawResult.speakerName, 'StudioDemo');
  assert.equal(rawResult.segmentCount, 411);
  assert.equal(rawResult.epochsCompleted, 51);
  assert.equal(rawResult.lowestLoss, 14.616);
});

test('generateForkBundle produces locked NoRegretsRVC theme, Samples & Models tabs, and ZIP archive', () => {
  const files = generateForkBundle(
    DEFAULT_STUDIO_STATE.forkConfig,
    DEFAULT_PROJECTS[0],
    DEFAULT_STUDIO_STATE.downloadManifest
  );
  assert.equal(files.length, 5);
  const nbFile = files.find((f) => f.id === 'notebook');
  assert.ok(nbFile);
  const parsedNb = JSON.parse(nbFile.content);
  assert.equal(parsedNb.nbformat, 4);

  const appFile = files.find((f) => f.id === 'app-py');
  assert.ok(appFile);
  assert.match(appFile.content, /with gr\.TabItem\("Samples"\):/);
  assert.match(appFile.content, /with gr\.TabItem\("Models"\):/);

  const zipBytes = buildZipArchive(files.map((f) => ({ path: f.zipPath, content: f.content })));
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
});

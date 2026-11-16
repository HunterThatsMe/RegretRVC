import type {
  BlenderRecipe,
  ConvertAudioState,
  ForkConfig,
  T4VramEstimate,
  ValidationIssue,
  VoiceModelProject,
} from '../types/studio.ts';

const T4_VRAM_CAP_GB = 16.0;

export function estimateT4VramUsage(project: VoiceModelProject): T4VramEstimate {
  const srFactor =
    project.samplingRate === '48000'
      ? 1.28
      : project.samplingRate === '40000'
        ? 1.12
        : 1.0;
  const vocoderFactor =
    project.vocoder === 'RefineGAN'
      ? 1.45
      : project.vocoder === 'MRF HiFi-GAN'
        ? 1.22
        : 1.0;
  const melFactor = project.melLoss === 'Multi-Scale' ? 1.14 : 1.0;
  const fp16Factor = project.fp16 ? 1.0 : 1.55;
  const checkpointFactor = project.checkpointing ? 0.78 : 1.0;

  const baseModelGb = 2.6 * srFactor * vocoderFactor;
  const perBatchGb = 0.72 * srFactor * vocoderFactor * melFactor * fp16Factor * checkpointFactor;
  const estimatedVramGb = Number(
    (baseModelGb + project.batchSize * perBatchGb).toFixed(2)
  );

  const safeBudget = 13.2 - baseModelGb;
  const recommendedBatchSize = Math.max(
    1,
    Math.min(64, Math.floor(safeBudget / perBatchGb))
  );

  let fitStatus: T4VramEstimate['fitStatus'] = 'Optimal';
  if (estimatedVramGb > 14.5) {
    fitStatus = 'Risk of OOM';
  } else if (estimatedVramGb > 12.6) {
    fitStatus = 'Tight';
  }

  const warnings: string[] = [];
  if (fitStatus === 'Risk of OOM') {
    warnings.push(
      `Estimated ${estimatedVramGb} GB approaches T4's 16 GB limit. Drop Batch Size to ${recommendedBatchSize} or enable Checkpointing / FP16.`
    );
  } else if (fitStatus === 'Tight') {
    warnings.push(
      `VRAM headroom is tight (${estimatedVramGb} GB / 16 GB). Recommended max batch: ${recommendedBatchSize}.`
    );
  }

  return {
    estimatedVramGb,
    vramCapGb: T4_VRAM_CAP_GB,
    fitStatus,
    recommendedBatchSize,
    warnings,
  };
}

export function sanitizeModelName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'NoRegretsVoice';
}

export function buildTrainPipelineCommands(project: VoiceModelProject): string {
  const safeName = sanitizeModelName(project.name);
  const dsPath = project.datasetPath.trim() || `/kaggle/input/datasets/your-username/${safeName}`;
  const gpus = project.gpuNumber.trim() || (project.gpuCount === 2 ? '0-1' : '0');
  const silenceFlags = project.truncateSilenceEnabled
    ? ` --truncate_silence True --silence_duration_ms ${project.silenceDurationMs}`
    : '';
  const loudnessFlags = project.loudnessNorm
    ? ` --process_effects True --loudness_target ${project.loudnessTargetLufs}`
    : ` --process_effects False`;
  const customPretrainedFlags = project.customPretrained
    ? ` --custom_pretrained True --g_pretrained_path "${project.customPretrainedG.trim()}" --d_pretrained_path "${project.customPretrainedD.trim()}"`
    : '';

  return [
    `# 1. Preprocess dataset`,
    `python core.py preprocess \\`,
    `  --model_name "${safeName}" --dataset_path "${dsPath}" \\`,
    `  --sample_rate ${project.samplingRate} --cpu_cores ${project.cpuCores} \\`,
    `  --cut_preprocess "${project.audioCutting}" --chunk_len ${project.chunkLengthSec} --overlap_len ${project.overlapLengthSec} \\`,
    `  --noise_reduction ${project.noiseFilter ? 'True' : 'False'}${loudnessFlags}${silenceFlags}`,
    ``,
    `# 2. Extract features (${project.pitchExtractor} + ${project.embedder})`,
    `python core.py extract \\`,
    `  --model_name "${safeName}" --f0_method ${project.pitchExtractor} \\`,
    `  --sample_rate ${project.samplingRate} --embedder_model ${project.embedder} \\`,
    `  --gpu ${gpus} --cpu_cores ${project.cpuCores} --include_mutes ${project.silentTrainingFiles}`,
    ``,
    `# 3. Train ${project.vocoder} RVC model (${project.fp16 ? 'fp16' : 'fp32'})`,
    `python core.py train \\`,
    `  --model_name "${safeName}" --optimizer ${project.optimizer} --vocoder "${project.vocoder}" \\`,
    `  --save_every_epoch ${project.saveEveryEpoch} --total_epoch ${project.totalEpoch} --batch_size ${project.batchSize} \\`,
    `  --sample_rate ${project.samplingRate} --gpu ${gpus} --fp16 ${project.fp16 ? 'True' : 'False'} \\`,
    `  --save_only_latest ${project.saveOnlyLatest ? 'True' : 'False'} --save_every_weights ${project.saveEveryWeights ? 'True' : 'False'} \\`,
    `  --pretrained ${project.pretrained ? 'True' : 'False'} --checkpointing ${project.checkpointing ? 'True' : 'False'} \\`,
    `  --cache_data_in_gpu ${project.cacheDatasetGpu ? 'True' : 'False'}${customPretrainedFlags}`,
    ``,
    `# 4. Generate ${project.indexAlgorithm} feature index`,
    `python core.py index --model_name "${safeName}" --index_algorithm ${project.indexAlgorithm}`,
  ].join('\n');
}

export function buildInferCliCommand(convert: ConvertAudioState): string {
  const pth = convert.voiceModel.trim() || 'logs/Model/Model.pth';
  const idx = convert.indexFile.trim() || 'logs/Model/Model.index';
  const inputTarget =
    convert.sourceMode === 'batch'
      ? convert.batchFolderPath.trim() || '/kaggle/working/audio_inputs'
      : convert.audioFileName.trim() || 'sample_input.wav';
  const cmdName = convert.sourceMode === 'batch' ? 'batch_infer' : 'infer';

  return [
    `python core.py ${cmdName} \\`,
    `  --pth_path "${pth}" \\`,
    `  --index_path "${idx}" \\`,
    `  --input_path "${inputTarget}" \\`,
    `  --pitch ${convert.pitch} --index_rate ${convert.indexRate} --protect ${convert.protect} \\`,
    `  --filter_radius ${convert.filterRadius} --volume_envelope ${convert.volumeEnvelope} \\`,
    `  --f0_autotune ${convert.autotune ? 'True' : 'False'} --split_audio ${convert.splitAudio ? 'True' : 'False'} \\`,
    `  --export_format ${convert.outputFormat.toUpperCase()}`,
  ].join('\n');
}

export function buildBlendCliCommand(recipe: BlenderRecipe): string {
  const outName = sanitizeModelName(recipe.outputName);
  const ratio = Number(recipe.ratio.toFixed(2));
  return [
    `python core.py model_blend \\`,
    `  --model_name "${outName}" \\`,
    `  --pth_path_1 "${recipe.modelAPath.trim() || 'logs/ModelA.pth'}" \\`,
    `  --pth_path_2 "${recipe.modelBPath.trim() || 'logs/ModelB.pth'}" \\`,
    `  --ratio ${ratio}`,
  ].join('\n');
}

export function validateForkConfig(config: ForkConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const enabledCount = Object.values(config.activeTabs).filter(Boolean).length;
  if (enabledCount === 0) {
    issues.push({
      field: 'activeTabs',
      severity: 'error',
      message: 'Enable at least one WebUI tab so app.py can render.',
    });
  }

  if (config.tunnelMode === 'Horizon' && !config.horizonId.trim()) {
    issues.push({
      field: 'horizonId',
      severity: 'warning',
      message: 'Horizon tunnel requires your Horizon ID from hrzn.run/dashboard.',
    });
  }

  if (
    (config.backupProvider === 'huggingface' || config.backupProvider === 'both') &&
    !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(config.hfRepoId.trim())
  ) {
    issues.push({
      field: 'hfRepoId',
      severity: 'error',
      message: 'Hugging Face Repo ID must be formatted as username/repo-name.',
    });
  }

  if (
    (config.backupProvider === 'google-drive' || config.backupProvider === 'both') &&
    !config.driveRemoteName.trim()
  ) {
    issues.push({
      field: 'driveRemoteName',
      severity: 'error',
      message: 'Google Drive rclone remote name is required (e.g. gdrive).',
    });
  }

  if (config.customRepoUrl.trim() && !/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(config.customRepoUrl.trim())) {
    issues.push({
      field: 'customRepoUrl',
      severity: 'warning',
      message: 'Custom fork URL should be a valid https://github.com/user/repo link.',
    });
  }

  return issues;
}

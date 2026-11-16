import { TrainingAnalysis, TrainingEpochPoint } from '../types/studio';

function extractTextFromIpynb(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cells)) {
      return null;
    }
    const chunks: string[] = [];
    for (const cell of parsed.cells) {
      if (Array.isArray(cell.outputs)) {
        for (const out of cell.outputs) {
          if (typeof out.text === 'string') {
            chunks.push(out.text);
          } else if (Array.isArray(out.text)) {
            chunks.push(out.text.join(''));
          }
        }
      }
      if (Array.isArray(cell.source)) {
        chunks.push(cell.source.join(''));
      } else if (typeof cell.source === 'string') {
        chunks.push(cell.source);
      }
    }
    return chunks.join('\n');
  } catch {
    return null;
  }
}

function parseDurationToSeconds(hms: string): number {
  const parts = hms.split(':').map((n) => Number(n));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export function parseTrainingNotebookOrLog(rawInput: string): TrainingAnalysis | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const ipynbText = trimmed.startsWith('{') ? extractTextFromIpynb(trimmed) : null;
  const text = ipynbText ?? trimmed;

  const durationMatch = text.match(/on\s+(\d{2}:\d{2}:\d{2})\s+seconds of audio/i);
  const segmentsMatch = text.match(/\((\d+)\/(\d+)\s+files successful\)/i);
  const vocoderMatch = text.match(/Using\s+([A-Za-z0-9-]+)\s+vocoder/i);
  const optimizerMatch = text.match(/Using\s+([A-Za-z0-9-]+)\s+optimizer/i);
  const gpuMatch = text.match(/on\s+(cuda:\d+(?:,\s*cuda:\d+)*)/i);
  const modelPreprocessMatch = text.match(/Model\s+([A-Za-z0-9_.-]+)\s+preprocessed successfully/i);

  const epochLineRegex =
    /([A-Za-z0-9_.-]+)\s*\|\s*epoch=(\d+)\s*\|\s*step=(\d+)\s*\|\s*time=\d{1,2}:\d{2}:\d{2}\s*\|\s*training_speed=(\d{1,2}:\d{2}:\d{2})(?:\s*\|\s*lowest_value=([0-9.]+)\s*\(epoch\s+(\d+)\s+and\s+step\s+(\d+)\))?/g;

  const points: TrainingEpochPoint[] = [];
  let speakerFromEpochs = '';
  let lowestLoss: number | null = null;
  let lowestLossEpoch: number | null = null;
  let lowestLossStep: number | null = null;

  let match: RegExpExecArray | null;
  while ((match = epochLineRegex.exec(text)) !== null) {
    speakerFromEpochs = match[1];
    const epoch = Number(match[2]);
    const step = Number(match[3]);
    const speedSec = parseDurationToSeconds(match[4]);
    const lowVal = match[5] ? Number(match[5]) : null;
    if (lowVal !== null && (lowestLoss === null || lowVal < lowestLoss)) {
      lowestLoss = lowVal;
      lowestLossEpoch = match[6] ? Number(match[6]) : epoch;
      lowestLossStep = match[7] ? Number(match[7]) : step;
    }
    points.push({
      epoch,
      step,
      speedSec,
      lowestLoss: lowVal,
    });
  }

  if (points.length === 0 && !durationMatch && !segmentsMatch) {
    return null;
  }

  const avgSpeedSec =
    points.length > 0
      ? Math.round(points.reduce((acc, p) => acc + p.speedSec, 0) / points.length)
      : 0;

  const gpuDevices = gpuMatch
    ? gpuMatch[1].split(',').map((g) => g.trim())
    : ['cuda:0'];

  return {
    speakerName:
      speakerFromEpochs || (modelPreprocessMatch ? modelPreprocessMatch[1] : 'ImportedRun'),
    audioDurationLabel: durationMatch ? durationMatch[1] : 'Unknown',
    segmentCount: segmentsMatch ? Number(segmentsMatch[1]) : 0,
    epochsCompleted: points.length > 0 ? points[points.length - 1].epoch : 0,
    latestStep: points.length > 0 ? points[points.length - 1].step : 0,
    avgSpeedSec,
    lowestLoss,
    lowestLossEpoch,
    lowestLossStep,
    gpuDevices,
    vocoderDetected: vocoderMatch ? vocoderMatch[1] : 'HiFi-GAN',
    optimizerDetected: optimizerMatch ? optimizerMatch[1] : 'AdamW',
    points,
  };
}

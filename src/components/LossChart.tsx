import React from 'react';
import { ACCENT_HEX } from '../data/defaults';
import { TrainingEpochPoint } from '../types/studio';

interface LossChartProps {
  points: TrainingEpochPoint[];
}

export const LossChart: React.FC<LossChartProps> = ({ points }) => {
  const lossPoints = points.filter((p) => p.lowestLoss !== null);

  if (lossPoints.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-[#47161D] bg-[#100506] px-4 text-center">
        <p className="text-xs text-[#AD8288]">
          Import a Kaggle notebook or training log with at least 2 loss milestones to plot the mel loss trajectory.
        </p>
      </div>
    );
  }

  const width = 640;
  const height = 200;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minEpoch = lossPoints[0].epoch;
  const maxEpoch = Math.max(minEpoch + 1, lossPoints[lossPoints.length - 1].epoch);
  const losses = lossPoints.map((p) => p.lowestLoss as number);
  const minLoss = Math.floor(Math.min(...losses) * 0.92);
  const maxLoss = Math.ceil(Math.max(...losses) * 1.05);
  const lossSpan = Math.max(0.5, maxLoss - minLoss);

  const coords = lossPoints.map((p) => {
    const x = padLeft + ((p.epoch - minEpoch) / (maxEpoch - minEpoch)) * plotW;
    const y = padTop + (1 - ((p.lowestLoss as number) - minLoss) / lossSpan) * plotH;
    return { x, y, epoch: p.epoch, loss: p.lowestLoss as number };
  });

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const yTicks = [minLoss, minLoss + lossSpan / 2, maxLoss];

  return (
    <div className="rounded-lg border border-[#47161D] bg-[#100506] p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-48 overflow-visible"
        role="img"
        aria-label="Mel loss progression chart across epochs"
      >
        {yTicks.map((tick, idx) => {
          const y = padTop + (1 - (tick - minLoss) / lossSpan) * plotH;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#47161D"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="#AD8288"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke={ACCENT_HEX}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />

        {coords.map((c) => (
          <g key={c.epoch}>
            <circle cx={c.x} cy={c.y} r="3.5" fill="#FDF7F7" stroke={ACCENT_HEX} strokeWidth="2" />
            <text
              x={c.x}
              y={height - 6}
              textAnchor="middle"
              fill="#AD8288"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              e{c.epoch}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

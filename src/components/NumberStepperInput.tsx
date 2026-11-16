import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberStepperInputProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
  unitName: string;
  disabled?: boolean;
  inputWidthClass?: string;
  onChange: (next: number) => void;
}

export const NumberStepperInput: React.FC<NumberStepperInputProps> = ({
  id,
  value,
  min,
  max,
  step = 1,
  ariaLabel,
  unitName,
  disabled = false,
  inputWidthClass = 'w-14',
  onChange,
}) => {
  const clamp = (raw: number) => Math.max(min, Math.min(max, raw));

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-[#47161D] bg-[#160709] p-0.5 transition-colors focus-within:border-[#E51923] ${
        disabled ? 'opacity-45 pointer-events-none' : ''
      }`}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - step))}
        aria-label={`Decrease ${unitName}`}
        className="flex h-6 w-6 items-center justify-center rounded-md text-[#DFBFC3] hover:bg-[#E51923] hover:text-white active:bg-[#B9121B] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#DFBFC3] transition-colors"
      >
        <Minus className="h-3 w-3" />
      </button>

      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed)) {
            onChange(clamp(parsed));
          }
        }}
        className={`${inputWidthClass} no-native-spin bg-transparent px-1 py-0.5 text-center font-mono text-xs font-medium text-[#FDF7F7] tabular-nums focus:outline-none`}
      />

      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + step))}
        aria-label={`Increase ${unitName}`}
        className="flex h-6 w-6 items-center justify-center rounded-md text-[#DFBFC3] hover:bg-[#E51923] hover:text-white active:bg-[#B9121B] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#DFBFC3] transition-colors"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
};

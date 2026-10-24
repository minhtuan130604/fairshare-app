import { useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useLocale, t } from '../../hooks/useLocale';

const TAX_PRESETS = [0, 5, 8, 10] as const;
const TIP_PRESETS = [0, 5, 10, 15] as const;

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return MIN_PERCENT;

  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-flow-col auto-cols-fr gap-1 p-1 bg-surface-2 rounded-xl"
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active
                ? 'bg-surface text-accent shadow-sm'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PercentageControl({
  id,
  label,
  value,
  presets,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  presets: readonly number[];
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const displayedValue = draft ?? String(value);

  function handleChange(rawValue: string) {
    setDraft(rawValue);

    // Allow an empty field while the user is editing.
    if (rawValue.trim() === '') return;

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;

    onChange(normalizePercent(parsed));
  }

  function handleBlur() {
    if (draft === null || draft.trim() === '') {
      onChange(MIN_PERCENT);
      setDraft(null);
      return;
    }

    const parsed = Number(draft);
    onChange(normalizePercent(parsed));
    setDraft(null);
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-ink-2"
      >
        {label}
      </label>

      <Segmented
        label={label}
        value={value}
        onChange={(nextValue) => {
          setDraft(null);
          onChange(nextValue);
        }}
        options={presets.map((preset) => ({
          value: preset,
          label: `${preset}%`,
        }))}
      />

      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={displayedValue}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
          min={MIN_PERCENT}
          max={MAX_PERCENT}
          step="0.1"
          className="field num w-full pr-10"
          aria-label={label}
        />

        <span
          aria-hidden="true"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3"
        >
          %
        </span>
      </div>
    </div>
  );
}

export function BillControls() {
  const {
    currentBill,
    updateTax,
    updateTip,
    loadDemoData,
    resetCurrentBill,
  } = useBillStore();

  const { locale } = useLocale();

  if (!currentBill) return null;

  return (
    <section
      className="card p-5 space-y-5"
      aria-labelledby="bill-controls-title"
    >
      <div>
        <h2
          id="bill-controls-title"
          className="text-base font-semibold"
        >
          {t('billControlsTitle', locale)}
        </h2>

        <p className="text-sm text-ink-3">
          {t('billControlsSubtitle', locale)}
        </p>
      </div>

      <PercentageControl
        id="tax"
        label={t('taxLabel', locale)}
        value={currentBill.taxPercent}
        presets={TAX_PRESETS}
        onChange={updateTax}
      />

      <PercentageControl
        id="tip"
        label={t('serviceLabel', locale)}
        value={currentBill.tipPercent}
        presets={TIP_PRESETS}
        onChange={updateTip}
      />

      <div className="pt-4 border-t border-line flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={loadDemoData}
          className="btn btn-secondary flex-1 justify-center"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          {t('demoData', locale)}
        </button>

        <button
          type="button"
          onClick={resetCurrentBill}
          className="btn btn-secondary flex-1 justify-center"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {t('resetBill', locale)}
        </button>
      </div>
    </section>
  );
}
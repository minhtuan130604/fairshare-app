import { RotateCcw, Sparkles } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useLocale, t } from '../../hooks/useLocale';

const TAX_PRESETS = [0, 5, 8, 10];
const TIP_PRESETS = [0, 5, 10, 15];

function Segmented<T extends string | number>({
  options, value, onChange, label,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 p-1 bg-surface-2 rounded-xl">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`py-1.5 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-surface text-accent shadow-sm' : 'text-ink-2 hover:text-ink'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function BillControls() {
  const { currentBill, updateTax, updateTip, loadDemoData, resetCurrentBill } = useBillStore();
  const { locale } = useLocale();
  if (!currentBill) return null;

  return (
    <section className="card p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold">{t('billControlsTitle', locale)}</h2>
        <p className="text-sm text-ink-3">{t('billControlsSubtitle', locale)}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="tax" className="text-sm font-medium text-ink-2">{t('taxLabel', locale)}</label>
        <Segmented label={t('taxLabel', locale)} value={currentBill.taxPercent} onChange={updateTax}
          options={TAX_PRESETS.map((preset) => ({ value: preset, label: `${preset}%` }))} />
        <input id="tax" type="number" value={currentBill.taxPercent} onChange={(event) => updateTax(Number(event.target.value))}
          min="0" max="100" step="0.1" className="field num" aria-label={t('taxLabel', locale)} />
      </div>
      <div className="space-y-2">
        <label htmlFor="tip" className="text-sm font-medium text-ink-2">{t('serviceLabel', locale)}</label>
        <Segmented label={t('serviceLabel', locale)} value={currentBill.tipPercent} onChange={updateTip}
          options={TIP_PRESETS.map((preset) => ({ value: preset, label: `${preset}%` }))} />
        <input id="tip" type="number" value={currentBill.tipPercent} onChange={(event) => updateTip(Number(event.target.value))}
          min="0" max="100" step="0.1" className="field num" aria-label={t('serviceLabel', locale)} />
      </div>
      <div className="pt-4 border-t border-line flex gap-2">
        <button type="button" onClick={loadDemoData} className="btn btn-secondary flex-1"><Sparkles className="w-4 h-4" />{t('demoData', locale)}</button>
        <button type="button" onClick={resetCurrentBill} className="btn btn-secondary flex-1"><RotateCcw className="w-4 h-4" />{t('resetBill', locale)}</button>
      </div>
    </section>
  );
}
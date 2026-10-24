import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useBillStore } from '../../store/useBillStore';
import { formatCurrency } from '../../utils/formatters';
import { prepareReceiptOcr, recognizeReceipt } from '../../utils/ocr';
import { parseReceipt, type ParsedReceipt, type ScannedItem } from '../../utils/receiptParser';
import {
  RECEIPT_LANGUAGES,
  resolveScanLangs,
  type ReceiptLangId,
} from '../../utils/ocrLanguages';
import { useLocale, t } from '../../hooks/useLocale';
import type { CurrencyCode } from '../../types/bill';

interface ScanReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Stage = 'pick' | 'scanning' | 'review' | 'error';
interface DraftItem extends ScannedItem {
  key: number;
  include: boolean;
}

const LANG_OPTIONS: { id: ReceiptLangId; label: string; hintKey?: string }[] = [
  { id: 'auto', label: 'Auto', hintKey: 'autoHint' },
  { id: 'vi', label: RECEIPT_LANGUAGES.vi.label },
  { id: 'en', label: RECEIPT_LANGUAGES.en.label },
  { id: 'zh', label: RECEIPT_LANGUAGES.zh.label },
  { id: 'ru', label: RECEIPT_LANGUAGES.ru.label },
];

/**
 * Tự động phát hiện loại tiền tệ dựa trên văn bản hóa đơn hoặc ngôn ngữ nhận diện
 */
function inferCurrencyFromScan(
  text: string,
  langCode?: string,
  currentDefault: CurrencyCode = 'USD',
): CurrencyCode {
  const lower = text.toLowerCase();

  if (lower.includes('$') || lower.includes('usd') || lower.includes('dollar')) {
    return 'USD';
  }
  if (lower.includes('₫') || lower.includes('vnd') || lower.includes('đồng') || lower.includes('dong')) {
    return 'VND';
  }
  if (lower.includes('€') || lower.includes('eur') || lower.includes('euro')) {
    return 'EUR';
  }
  if (lower.includes('₽') || lower.includes('rub') || lower.includes('руб')) {
    return 'RUB';
  }
  if (lower.includes('¥') || lower.includes('cny') || lower.includes('rmb') || lower.includes('yuan')) {
    return 'USD';
  }

  if (langCode === 'vi') return 'VND';
  if (langCode === 'en') return 'USD';
  if (langCode === 'ru') return 'RUB';
  if (langCode === 'zh') return 'USD';

  return currentDefault;
}

export function ScanReceiptModal({ isOpen, onClose }: ScanReceiptModalProps) {
  const { currentBill, addItem, updateCurrency } = useBillStore();
  const { locale } = useLocale();
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState({ label: '', value: 0 });
  const [preview, setPreview] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [detectedTotal, setDetectedTotal] = useState<number | null>(null);
  const [detectedCurrency, setDetectedCurrency] = useState<CurrencyCode>('USD');
  const [langId, setLangId] = useState<ReceiptLangId>('auto');
  const [usedLang, setUsedLang] = useState<string | null>(null);
  const [error, setError] = useState('');
  const lastFileRef = useRef<File | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  /**
   * Tự động chuẩn hóa chuỗi tiến trình sang ngôn ngữ hiện tại,
   * bao gồm cả chuỗi đếm giây được trả về từ tầng OCR utils.
   */
  const formatProgressLabel = (label: string): string => {
    if (!label) return t('scanningReceipt', locale);

    // 1. Chuỗi gửi ảnh phân tích
    if (label.includes('gửi ảnh') || label.includes('Sending image')) {
      return t('sendingImageForAnalysis', locale);
    }

    // 2. Chuỗi đếm ngược giây
    const secondsMatch = label.match(/(\d+)\s*giây/i) || label.match(/(\d+)\s*s/i);
    if (secondsMatch && (label.includes('chờ') || label.includes('wait') || label.includes('xử lý'))) {
      return t('scanningWaitingSeconds', locale, { seconds: secondsMatch[1] });
    }

    // 3. Chuỗi trích xuất món ăn (chạy rất nhanh trước khi mở danh sách món)
    if (label.includes('trích xuất') || label.includes('Extracting')) {
      return t('extractItems', locale);
    }

    // 4. Chuỗi hoàn tất nhận dạng
    if (label.includes('Hoàn tất') || label.includes('Complete') || label.includes('Done')) {
      return t('scanComplete', locale);
    }

    // 5. Chuỗi fallback khi AI đổi model dự phòng
    if (label.includes('thử model') || label.includes('trying another') || label.includes('đang bận')) {
      return t('geminiFallbackModel', locale);
    }

    // 6. Chuỗi tải nhận dạng / ngôn ngữ OCR
    if (label.includes('bộ nhận dạng') || label.includes('Loading text recognition')) {
      return t('loadingOcr', locale);
    }

    // 7. Chuỗi chuẩn bị ảnh ban đầu
    if (label.includes('chuẩn bị') || label.includes('Preparing')) {
      return t('preparingImage', locale);
    }

    // 8. Chuỗi phân tích AI
    if (label.includes('Gemini') || label.includes('AI') || label.includes('phân tích') || label.includes('Analyzing')) {
      return t('analyzeReceipt', locale);
    }

    // 9. Chuỗi đọc/quét chung
    if (label.includes('đọc') || label.includes('quét') || label.includes('Reading') || label.includes('Scanning')) {
      return t('scanningReceipt', locale);
    }

    return label;
  };

  useEffect(() => {
    if (!isOpen) return;
    const preferredLanguage = 'auto';
    setStage('pick');
    setDrafts([]);
    setDetectedTotal(null);
    setUsedLang(null);
    lastFileRef.current = null;
    setError('');
    setLangId(preferredLanguage);
    setDetectedCurrency(currentBill?.currency || 'USD');

    void prepareReceiptOcr(
      resolveScanLangs(preferredLanguage),
      (label, value) => setProgress({ label, value }),
      locale,
    );
  }, [isOpen, currentBill?.currency, locale]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (!currentBill) return null;

  const handleFile = async (file: File | undefined, forceLocal = false) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      lastFileRef.current = null;
      setError(t('invalidImage', locale));
      setStage('error');
      return;
    }

    lastFileRef.current = file;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setStage('scanning');
    setProgress({ label: t('preparingImage', locale), value: 0.02 });
    setUsedLang(null);
    setError('');

    try {
      const langs = resolveScanLangs(langId);
      const { result, lang } = await recognizeReceipt(
        file,
        langs,
        (label, value) => setProgress({ label, value }),
        (recognition, language) =>
          (recognition.items?.length ??
            parseReceipt(
              {
                text: recognition.text,
                words: recognition.words,
                confidence: recognition.confidence,
              },
              language,
            ).items.length) * 10 + recognition.confidence / 10,
        locale,
        forceLocal,
      );

      setUsedLang(lang.label);
      const parsed: ParsedReceipt = result.items
        ? {
            items: result.items,
            detectedTotal: result.detectedTotal ?? null,
            score: result.confidence,
          }
        : parseReceipt(
            { text: result.text, words: result.words, confidence: result.confidence },
            lang,
          );

      if (parsed.items.length === 0) {
        setError(t('noItemsFound', locale));
        setStage('error');
        return;
      }

      const rawText = result.text || parsed.items.map((i) => i.name).join(' ');
      const inferredCurr = inferCurrencyFromScan(rawText, lang.id, currentBill.currency);
      setDetectedCurrency(inferredCurr);

      setDrafts(
        parsed.items.map((item, index) => ({
          ...item,
          key: index,
          include: true,
        })),
      );
      setDetectedTotal(parsed.detectedTotal);
      setStage('review');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      if (message === 'CANVAS_NOT_SUPPORTED') {
        setError(t('canvasNotSupported', locale));
      } else if (/GROQ_HTTP_429|HTTP 429/i.test(message)) {
        setError(t('geminiUnavailable', locale));
      } else if (/TIMEOUT/i.test(message)) {
        setError(t('geminiTimeout', locale));
      } else {
        setError(t('readFailed', locale));
      }
      setStage('error');
    }
  };

  const patch = (key: number, changes: Partial<DraftItem>) =>
    setDrafts((previous) =>
      previous.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)),
    );

  const selected = drafts.filter(
    (draft) => draft.include && draft.name.trim() && draft.price > 0,
  );
  const selectedTotal = selected.reduce(
    (sum, draft) => sum + draft.price * draft.quantity,
    0,
  );

  const confirm = () => {
    if (detectedCurrency && detectedCurrency !== currentBill.currency) {
      updateCurrency(detectedCurrency);
    }

    selected.forEach((draft) =>
      addItem({
        name: draft.name.trim(),
        price: draft.price,
        quantity: Math.max(0.01, Number(draft.quantity) || 1),
        assignedMemberIds: [],
      }),
    );
    onClose();
  };

  const languagePicker = (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-ink-2">
        {t('receiptLanguage', locale)}
      </label>
      <select
        value={langId}
        onChange={(event) => setLangId(event.target.value as ReceiptLangId)}
        className="field py-2 text-sm"
        aria-label={t('receiptLanguage', locale)}
      >
        {LANG_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.id === 'auto' ? t('auto', locale) : option.label}
            {option.hintKey ? ` — ${t(option.hintKey, locale)}` : ''}
          </option>
        ))}
      </select>
    </div>
  );

  const pickButtons = (
    <div className="grid sm:grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="btn btn-primary"
      >
        <Camera className="w-4 h-4" />
        {t('takePhoto', locale)}
      </button>
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="btn btn-secondary"
      >
        <ImagePlus className="w-4 h-4" />
        {t('chooseImage', locale)}
      </button>
    </div>
  );

  const footer =
    stage === 'review' ? (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-ink-2">
            {t('scanSelectedCount', locale, { count: selected.length })}
          </span>
          <span className="font-semibold num">
            {formatCurrency(selectedTotal, detectedCurrency)}
          </span>
        </div>
        {detectedTotal !== null && (
          <p
            className={`text-xs ${
              Math.abs(detectedTotal - selectedTotal) < 1 ? 'text-accent' : 'text-warn'
            }`}
          >
            {t('receiptPrintedTotal', locale, {
              amount: formatCurrency(detectedTotal, detectedCurrency),
            })}
            {Math.abs(detectedTotal - selectedTotal) < 1
              ? t('totalMatches', locale)
              : ` ${t('totalMayIncludeExtras', locale)} ${t('reviewItemsWarning', locale)}`}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStage('pick')}
            className="btn btn-secondary flex-1"
          >
            {t('scanAnother', locale)}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={selected.length === 0}
            className="btn btn-primary flex-1"
          >
            {t('addCount', locale, { count: selected.length })}
          </button>
        </div>
      </div>
    ) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('scanTitle', locale)}
      footer={footer}
      maxWidth="max-w-xl"
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {stage === 'pick' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">{t('scanIntro', locale)}</p>
          {languagePicker}
          {pickButtons}
          <ul className="text-xs text-ink-3 space-y-1 list-disc pl-4">
            <li>{t('scanTipPhoto', locale)}</li>
            <li>{t('scanTipPrivacy', locale)}</li>
            <li>{t('scanTipFirstLoad', locale)}</li>
            <li>{t('scanTipAuto', locale)}</li>
          </ul>
        </div>
      )}

      {stage === 'scanning' && (
        <div className="space-y-4">
          {preview && (
            <img
              src={preview}
              alt={t('scanTitle', locale)}
              className="max-h-56 mx-auto rounded-lg border border-line"
            />
          )}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ink-2">{formatProgressLabel(progress.label)}</span>
              <span className="num text-ink-3">{Math.round(progress.value * 100)}%</span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-300"
                style={{ width: `${Math.round(progress.value * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-4">
          <div className="flex gap-3 bg-danger-soft text-danger rounded-xl p-4 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
          {languagePicker}
          {pickButtons}
          {lastFileRef.current && (
            <button
              type="button"
              onClick={() => {
                const file = lastFileRef.current;
                if (file) void handleFile(file, true);
              }}
              className="btn btn-secondary w-full"
            >
              {t('retryScan', locale)}
            </button>
          )}
        </div>
      )}

      {stage === 'review' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-2">
              {t('readRows', locale, { count: drafts.length })}
              {usedLang ? ` (${t('usedLanguage', locale, { language: usedLang })})` : ''}.{' '}
              {t('reviewPrompt', locale)}
            </p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
              {t('currencyLabel', locale)}: {detectedCurrency}
            </span>
          </div>

          {drafts.length > 0 ? (
            <ul className="space-y-2">
              {drafts.map((draft) => (
                <li
                  key={draft.key}
                  className={`rounded-xl border border-line p-3 space-y-2 ${
                    draft.include ? 'bg-surface-2/60' : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.include}
                      onChange={(event) => patch(draft.key, { include: event.target.checked })}
                      className="w-4 h-4 accent-[var(--accent)]"
                      aria-label={t('selectedItem', locale, { name: draft.name })}
                    />
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) => patch(draft.key, { name: event.target.value })}
                      className="field py-1.5 flex-1 min-w-0"
                      aria-label={t('itemName', locale)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((previous) => previous.filter((item) => item.key !== draft.key))
                      }
                      className="icon-btn hover:text-danger shrink-0"
                      aria-label={t('removeLine', locale)}
                      title={t('removeLine', locale)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_5rem_auto] gap-2 items-center pl-6">
                    <input
                      type="number"
                      value={draft.price}
                      min="0"
                      step="any"
                      onChange={(event) => patch(draft.key, { price: Number(event.target.value) })}
                      className="field num py-1.5"
                      aria-label={t('unitPrice', locale)}
                    />
                    <input
                      type="number"
                      value={draft.quantity}
                      min="0.01"
                      step="any"
                      onChange={(event) =>
                        patch(draft.key, { quantity: Number(event.target.value) })
                      }
                      className="field num py-1.5"
                      aria-label={t('quantity', locale)}
                    />
                    <span className="text-xs text-ink-3 num w-24 text-right">
                      {formatCurrency(draft.price * draft.quantity, detectedCurrency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3 rounded-lg border border-line p-3">
              {t('emptyBillsHistory', locale)}
            </p>
          )}

          {drafts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDrafts([]);
                setDetectedTotal(null);
              }}
              className="btn btn-secondary w-full justify-center gap-2"
              aria-label={t('deleteBill', locale)}
              title={t('deleteBill', locale)}
            >
              <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('deleteBill', locale)} ({drafts.length})</span>
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
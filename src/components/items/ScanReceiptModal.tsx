import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ImagePlus,
  Trash2,
  AlertCircle,
  Crop as CropIcon,
  RotateCcw,
  Utensils,
  ShoppingBag,
  Car,
  Film,
  Compass,
  HelpCircle,
  Tag,
} from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
import type { CurrencyCode, BillCategory } from '../../types/bill';

interface ScanReceiptModalProps {
  isOpen: boolean;
  expenseId?: string;
  onClose: () => void;
}

type Stage = 'pick' | 'crop' | 'scanning' | 'review' | 'error';

interface DraftItem extends ScannedItem {
  key: number;
  include: boolean;
}

const CATEGORIES: { key: BillCategory; icon: any; label: { vi: string; en: string; ru: string; zh: string } }[] = [
  { key: 'dining', icon: Utensils, label: { vi: 'Ăn uống', en: 'Dining', ru: 'Еда', zh: '餐饮' } },
  { key: 'shopping', icon: ShoppingBag, label: { vi: 'Mua sắm', en: 'Shopping', ru: 'Покупки', zh: '购物' } },
  { key: 'transport', icon: Car, label: { vi: 'Di chuyển', en: 'Transport', ru: 'Транспорт', zh: '交通' } },
  { key: 'entertainment', icon: Film, label: { vi: 'Giải trí', en: 'Entertainment', ru: 'Отдых', zh: '娱乐' } },
  { key: 'travel', icon: Compass, label: { vi: 'Du lịch', en: 'Travel', ru: 'Поездки', zh: '旅行' } },
  { key: 'other', icon: HelpCircle, label: { vi: 'Khác', en: 'Other', ru: 'Другое', zh: '其他' } },
];

const LANG_OPTIONS: { id: ReceiptLangId; label: string; hintKey?: string }[] = [
  { id: 'auto', label: 'Auto', hintKey: 'autoHint' },
  { id: 'vi', label: RECEIPT_LANGUAGES.vi.label },
  { id: 'en', label: RECEIPT_LANGUAGES.en.label },
  { id: 'zh', label: RECEIPT_LANGUAGES.zh.label },
  { id: 'ru', label: RECEIPT_LANGUAGES.ru.label },
];

function inferCurrencyFromScan(
  text: string,
  langCode?: string,
  currentDefault: CurrencyCode = 'VND' as CurrencyCode,
): CurrencyCode {
  const lower = text.toLowerCase();
  if (lower.includes('₫') || lower.includes('vnd') || lower.includes('đồng') || lower.includes('dong')) {
    return 'VND' as CurrencyCode;
  }
  if (lower.includes('₽') || lower.includes('rub') || lower.includes('руб') || lower.includes('ruble')) {
    return 'RUB' as CurrencyCode;
  }
  if (langCode === 'vi') return 'VND' as CurrencyCode;
  if (langCode === 'ru') return 'RUB' as CurrencyCode;
  return currentDefault;
}

async function getCroppedFile(image: HTMLImageElement, crop: PixelCrop): Promise<File> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(new File([blob], 'cropped_receipt.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.95);
  });
}

export function ScanReceiptModal({ isOpen, onClose, expenseId }: ScanReceiptModalProps) {
  const { currentBill, addItem, addItemToExpense, updateCurrency, updateBillTitle, updateBillCategory } = useBillStore() as any;
  const { locale } = useLocale();

  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState({ label: '', value: 0 });
  const [preview, setPreview] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [detectedTotal, setDetectedTotal] = useState<number | null>(null);
  const [detectedCurrency, setDetectedCurrency] = useState<CurrencyCode>('VND' as CurrencyCode);
  const [detectedCategory, setDetectedCategory] = useState<BillCategory>('dining');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');
  const [detectedTitle, setDetectedTitle] = useState<string>('');
  const [langId, setLangId] = useState<ReceiptLangId>('auto');
  const [usedLang, setUsedLang] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement | null>(null);

  const lastFileRef = useRef<File | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const formatProgressLabel = (label: string): string => {
    if (!label) return t('scanningReceipt', locale);
    if (label.includes('gửi ảnh') || label.includes('Sending image')) return t('sendingImageForAnalysis', locale);
    const secondsMatch = label.match(/(\d+)\s*giây/i) || label.match(/(\d+)\s*s/i);
    if (secondsMatch && (label.includes('chờ') || label.includes('wait') || label.includes('xử lý'))) {
      return t('scanningWaitingSeconds', locale, { seconds: secondsMatch[1] });
    }
    if (label.includes('trích xuất') || label.includes('Extracting')) return t('extractItems', locale);
    if (label.includes('Hoàn tất') || label.includes('Complete') || label.includes('Done')) return t('scanComplete', locale);
    if (label.includes('thử model') || label.includes('trying another') || label.includes('đang bận')) return t('geminiFallbackModel', locale);
    if (label.includes('bộ nhận dạng') || label.includes('Loading text recognition')) return t('loadingOcr', locale);
    if (label.includes('chuẩn bị') || label.includes('Preparing')) return t('preparingImage', locale);
    if (label.includes('AI') || label.includes('phân tích') || label.includes('Analyzing') || label.includes('Groq')) return t('analyzeReceipt', locale);
    if (label.includes('đọc') || label.includes('quét') || label.includes('Reading') || label.includes('Scanning')) return t('scanningReceipt', locale);
    return label;
  };

  useEffect(() => {
    if (!isOpen) return;
    const preferredLanguage = 'auto';
    setStage('pick');
    setDrafts([]);
    setDetectedTotal(null);
    setDetectedTitle('');
    setDetectedCategory('dining');
    setCustomCategoryName('');
    setUsedLang(null);
    lastFileRef.current = null;
    setError('');
    setLangId(preferredLanguage);
    setDetectedCurrency((currentBill?.currency as CurrencyCode) || ('VND' as CurrencyCode));
    setCropImageSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);

    void prepareReceiptOcr(
      resolveScanLangs(preferredLanguage),
      (label, value) => setProgress({ label, value }),
      locale,
    );
  }, [isOpen, currentBill?.currency, locale]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
  }, [preview, cropImageSrc]);

  if (!currentBill) return null;

  const handleSelectFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('invalidImage', locale));
      setStage('error');
      return;
    }

    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setStage('crop');
  };

  const onImageLoad = () => {
    const initialCrop: Crop = {
      unit: '%',
      x: 7.5,
      y: 7.5,
      width: 85,
      height: 85,
    };
    setCrop(initialCrop);
  };

  const handleConfirmCropAndScan = async (forceLocal = false) => {
    if (!cropImageSrc || !imgRef.current) return;

    let fileToScan: File;
    try {
      if (completedCrop && completedCrop.width > 20 && completedCrop.height > 20) {
        fileToScan = await getCroppedFile(imgRef.current, completedCrop);
      } else {
        const response = await fetch(cropImageSrc);
        const blob = await response.blob();
        fileToScan = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
      }
    } catch {
      const response = await fetch(cropImageSrc);
      const blob = await response.blob();
      fileToScan = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
    }

    lastFileRef.current = fileToScan;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(fileToScan));
    setStage('scanning');
    setProgress({ label: t('preparingImage', locale), value: 0.02 });
    setUsedLang(null);
    setError('');

    try {
      const langs = resolveScanLangs(langId);
      const { result, lang } = await recognizeReceipt(
        fileToScan,
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

      // Nhận diện danh mục gợi ý ban đầu
      if (result.category && ['dining', 'shopping', 'transport', 'entertainment', 'travel', 'other'].includes(result.category)) {
        setDetectedCategory(result.category as BillCategory);
      } else {
        setDetectedCategory('dining');
      }

      if (result.title) {
        setDetectedTitle(result.title);
      }

      const rawText = result.text || parsed.items.map((i) => i.name).join(' ');
      const inferredCurr = inferCurrencyFromScan(rawText, lang.id, currentBill.currency as CurrencyCode);
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
    // 1. Cập nhật loại tiền tệ
    if (detectedCurrency && detectedCurrency !== currentBill.currency && updateCurrency) {
      updateCurrency(detectedCurrency);
    }

    // 2. Gán danh mục đã chọn (nếu chọn 'other' và có tên tùy chỉnh thì lưu tên tùy chỉnh)
    if (updateBillCategory) {
      const finalCategory = (detectedCategory === 'other' && customCategoryName.trim()) 
        ? (customCategoryName.trim() as BillCategory)
        : detectedCategory;
      updateBillCategory(finalCategory);
    }

    // 3. Tự cập nhật tiêu đề nếu bill hiện tại chưa có
    if (detectedTitle && !currentBill.title && updateBillTitle) {
      updateBillTitle(detectedTitle);
    }

    // 4. Thêm các món vào hóa đơn
    selected.forEach((draft) => {
      const item = {
        name: draft.name.trim(),
        price: draft.price,
        quantity: Math.max(0.01, Number(draft.quantity) || 1),
        assignedMemberIds: [],
      };
      if (expenseId) addItemToExpense(expenseId, item);
      else addItem(item);
    });
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
        className="btn btn-primary cursor-pointer"
      >
        <Camera className="w-4 h-4" />
        {t('takePhoto', locale)}
      </button>
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="btn btn-secondary cursor-pointer"
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
            className="btn btn-secondary flex-1 cursor-pointer"
          >
            {t('scanAnother', locale)}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={selected.length === 0}
            className="btn btn-primary flex-1 cursor-pointer"
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
      title={stage === 'crop' ? t('cropModalTitle', locale) : t('scanTitle', locale)}
      footer={footer}
      maxWidth={stage === 'crop' ? 'max-w-2xl' : 'max-w-xl'}
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          handleSelectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleSelectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {/* STAGE 1: Chọn ảnh */}
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

      {/* STAGE 2: Cắt ảnh */}
      {stage === 'crop' && cropImageSrc && (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between text-xs text-ink-3 px-1">
            <span>Kéo các góc hoặc cạnh viền để căn chỉnh sát tờ hóa đơn</span>
          </div>

          <div className="flex justify-center max-h-[60vh] overflow-auto rounded-2xl bg-neutral-950/80 p-2 border border-line">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              className="max-h-[55vh]"
            >
              <img
                ref={imgRef}
                src={cropImageSrc}
                alt="Receipt for cropping"
                onLoad={onImageLoad}
                className="max-h-[55vh] object-contain select-none"
              />
            </ReactCrop>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStage('pick')}
              className="btn btn-secondary flex-1 text-xs py-2.5 cursor-pointer"
            >
              {t('cancelBtn', locale)}
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmCropAndScan()}
              className="btn btn-primary flex-1 text-xs py-2.5 cursor-pointer font-bold inline-flex items-center justify-center gap-1.5"
            >
              <CropIcon className="w-4 h-4" />
              <span>{t('cropConfirmBtn', locale)}</span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: Đang quét */}
      {stage === 'scanning' && (
        <div className="space-y-4">
          {preview && (
            <img
              src={preview}
              alt={t('scanTitle', locale)}
              className="max-h-56 mx-auto rounded-lg border border-line object-contain"
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

      {/* STAGE 4: Báo lỗi */}
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
              onClick={() => void handleConfirmCropAndScan(true)}
              className="btn btn-secondary w-full cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('retryScan', locale)}</span>
            </button>
          )}
        </div>
      )}

      {/* STAGE 5: Đánh giá món & Chọn danh mục */}
      {stage === 'review' && (
        <div className="space-y-4">
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

          {/* Chọn danh mục: Chủ động chọn + Nhập text tự do khi chọn 'Khác' */}
          <div className="p-3 rounded-xl bg-surface-2/60 border border-line space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-2">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span>
                  {locale === 'vi' ? 'Danh mục chi tiêu:' : 
                   locale === 'ru' ? 'Категория расхода:' : 
                   locale === 'zh' ? '支出分类:' : 
                   'Expense Category:'}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = detectedCategory === cat.key;
                const label = cat.label[locale as 'vi' | 'en' | 'ru' | 'zh'] || cat.label.en;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setDetectedCategory(cat.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                      isSelected
                        ? 'bg-accent text-white shadow-sm ring-1 ring-accent'
                        : 'bg-surface text-ink-3 hover:text-ink hover:bg-surface-3 border border-line/60'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Ô nhập tùy chỉnh khi bấm 'Khác' */}
            {detectedCategory === 'other' && (
              <div className="pt-1.5 border-t border-line/40 animate-fadeIn">
                <input
                  type="text"
                  placeholder={
                    locale === 'vi' ? 'Nhập tên danh mục tùy chỉnh (vd: Tiền nhà, Mua đồ decor, Sửa xe...)' :
                    locale === 'ru' ? 'Введите название категории (напр.: Аренда, Ремонт, Декор...)' :
                    'Enter custom category name (e.g., Rent, Repair, Decor...)'
                  }
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  className="field py-1.5 text-xs w-full"
                  autoFocus
                />
              </div>
            )}
          </div>

          {drafts.length > 0 ? (
            <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
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
                      className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
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
                      className="icon-btn hover:text-danger shrink-0 cursor-pointer"
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
              className="btn btn-secondary w-full justify-center gap-2 cursor-pointer"
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
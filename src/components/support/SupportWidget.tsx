import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { MessageSquareText, X, Star, Send, RefreshCw, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useLocale, t } from '../../hooks/useLocale';

type MessageType = 'support' | 'feedback' | 'bug';

interface SupportHistoryItem {
  id: string;
  type: MessageType;
  message: string;
  admin_reply?: string;
  created_at: string;
}

interface SupportWidgetProps {
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
}

export function SupportWidget({ isOpenExternal, onCloseExternal }: SupportWidgetProps) {
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const { locale } = useLocale();

  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<MessageType>('support');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [history, setHistory] = useState<SupportHistoryItem[]>([]);

  // Đồng bộ trạng thái mở từ props bên ngoài (nếu có)
  useEffect(() => {
    if (isOpenExternal !== undefined) {
      setIsOpen(isOpenExternal);
    }
  }, [isOpenExternal]);

  // Lắng nghe sự kiện click từ chuông thông báo Header để tự mở widget
  useEffect(() => {
    const handleOpenFromEvent = () => setIsOpen(true);
    window.addEventListener('open-support-widget', handleOpenFromEvent);
    return () => window.removeEventListener('open-support-widget', handleOpenFromEvent);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (onCloseExternal) onCloseExternal();
  };

  // Tải lịch sử tin nhắn & phản hồi gần nhất của user
  const loadHistory = useCallback(async () => {
    if (!user || !supabase) return;

    try {
      const { data } = await supabase
        .from('support_messages')
        .select('id, type, message, admin_reply, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) setHistory(data as SupportHistoryItem[]);
    } catch (err) {
      console.error('Lỗi tải lịch sử hỗ trợ:', err);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      void loadHistory();
    }
  }, [isOpen, loadHistory]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !supabase) return;

    setIsSubmitting(true);
    setSubmittedMessage('');

    try {
      const { error } = await supabase.from('support_messages').insert({
        user_id: user?.id || null,
        user_email: user?.email || 'guest',
        user_name: profile?.display_name || user?.user_metadata?.display_name || 'Guest User',
        type,
        message: message.trim(),
        rating: type === 'feedback' ? rating : null,
        status: 'pending',
      });

      if (error) throw error;

      setMessage('');
      setSubmittedMessage(t('feedbackSuccess', locale) || 'Message sent successfully!');
      void loadHistory();
      setTimeout(() => setSubmittedMessage(''), 4500);
    } catch {
      setSubmittedMessage(t('saveError', locale) || 'Failed to send message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-20 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-neutral-950 shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        title={t('sendFeedback', locale)}
      >
        <MessageSquareText className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="fixed bottom-34 right-6 z-50 w-84 sm:w-96 rounded-3xl border border-line bg-surface p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-sm text-ink-1">
                {t('supportTitle', locale)}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="icon-btn text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {submittedMessage && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
              {submittedMessage}
            </div>
          )}

          {/* 3 Tab chọn loại tin nhắn */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setType('support')}
              className={`rounded-lg py-1.5 transition-colors cursor-pointer ${
                type === 'support' ? 'bg-accent text-white font-semibold' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {t('tabSupport', locale) || 'Support'}
            </button>
            <button
              type="button"
              onClick={() => setType('bug')}
              className={`rounded-lg py-1.5 transition-colors cursor-pointer ${
                type === 'bug' ? 'bg-accent text-white font-semibold' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {t('tabBug', locale) || 'Bug'}
            </button>
            <button
              type="button"
              onClick={() => setType('feedback')}
              className={`rounded-lg py-1.5 transition-colors cursor-pointer ${
                type === 'feedback' ? 'bg-accent text-white font-semibold' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {t('tabFeedback', locale) || 'Feedback'}
            </button>
          </div>

          {type === 'feedback' && (
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-5 w-5 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              className="field w-full text-xs min-h-[85px] resize-none"
              placeholder={
                type === 'bug'
                  ? t('bugPlaceholder', locale)
                  : type === 'feedback'
                  ? t('feedbackPlaceholder', locale)
                  : t('supportPlaceholder', locale)
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>{t('sendSupportBtn', locale) || 'Send Message'}</span>
                </>
              )}
            </button>
          </form>

          {history.length > 0 && history.some((item) => item.admin_reply) && (
            <div className="border-t border-line pt-2 space-y-2">
              <span className="text-[11px] font-semibold text-ink-3 block">
                {t('adminReplyLabel', locale) || 'Admin Response:'}
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {history
                  .filter((item) => item.admin_reply)
                  .map((item) => (
                    <div key={item.id} className="rounded-xl bg-surface-2 p-2 text-[11px] space-y-1">
                      <p className="text-ink-3 line-clamp-1 italic">"{item.message}"</p>
                      <p className="text-emerald-400 font-medium">↳ {item.admin_reply}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  PieChart as PieIcon,
  Users,
  Clock,
  Sparkles,
  ShoppingBag,
  Utensils,
  Car,
  Film,
  Compass,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useLocale } from '../../hooks/useLocale';
import { calculateBillTotals, calculateMemberBreakdowns } from '../../utils/calculations';
import { formatCurrency } from '../../utils/formatters';
import type { BillSession } from '../../types/bill';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';

type FilterMode = 'month' | 'week' | 'year' | 'all';

interface CategoryMetric {
  key: string;
  name: string;
  icon: any;
  color: string;
  amount: number;
  percentage: number;
}

// Bảng màu tách biệt rõ ràng cho các danh mục cố định
const CATEGORY_META: Record<string, { label: { vi: string; en: string; ru: string; zh: string }; icon: any; color: string }> = {
  dining: { label: { vi: 'Ăn uống & Cafe', en: 'Dining & Cafe', ru: 'Рестораны и кафе', zh: '餐饮与咖啡' }, icon: Utensils, color: '#10b981' },
  shopping: { label: { vi: 'Mua sắm & Tiêu dùng', en: 'Shopping', ru: 'Покупки', zh: '购物与超市' }, icon: ShoppingBag, color: '#3b82f6' },
  transport: { label: { vi: 'Di chuyển & Đi lại', en: 'Transport', ru: 'Транспорт', zh: '交通与出行' }, icon: Car, color: '#f59e0b' },
  entertainment: { label: { vi: 'Vui chơi & Giải trí', en: 'Entertainment', ru: 'Развлечения', zh: '娱乐与休闲' }, icon: Film, color: '#ec4899' },
  travel: { label: { vi: 'Du lịch & Khách sạn', en: 'Travel', ru: 'Путешествия', zh: '旅游与住宿' }, icon: Compass, color: '#8b5cf6' },
  other: { label: { vi: 'Khác', en: 'Other', ru: 'Другое', zh: '其他' }, icon: HelpCircle, color: '#64748b' },
};

// Bảng màu riêng biệt cho các danh mục tự nhập (như "Ăn hải sản", "Tiền nhà"...) để không trùng màu
const CUSTOM_CATEGORY_PALETTE = [
  '#f97316', // Cam đậm
  '#06b6d4', // Cyan
  '#ef4444', // Đỏ san hô
  '#eab308', // Vàng tươi
  '#a855f7', // Tím sáng
  '#14b8a6', // Xanh ngọc biển
  '#f43f5e', // Hồng đỏ
  '#6366f1', // Chàm
];

function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export function SpendingAnalyticsDashboard() {
  const { history, savedGroups } = useBillStore() as any;
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const { locale } = useLocale();

  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 9, 1)); // Tháng 10/2026
  const [profilesMap, setProfilesMap] = useState<Record<string, { display_name?: string; avatar_url?: string }>>({});

  useEffect(() => {
    async function loadFriendProfiles() {
      if (!supabase) return;
      try {
        const { data } = await supabase.from('profiles').select('id, display_name, avatar_url');
        if (data) {
          const map: Record<string, { display_name?: string; avatar_url?: string }> = {};
          data.forEach((p) => {
            if (p.id) map[p.id] = p;
            if (p.display_name) map[normalizeString(p.display_name)] = p;
          });
          setProfilesMap(map);
        }
      } catch (err) {
        console.error('Profiles load error:', err);
      }
    }
    void loadFriendProfiles();
  }, []);

  const i18n = useMemo(() => {
    const dict = {
      vi: {
        title: 'Báo cáo Chi tiêu & Mối quan hệ',
        subtitle: 'Theo dõi chi tiết báo cáo tài chính hàng tháng và quan hệ bạn bè',
        month: 'Tháng',
        week: 'Tuần',
        year: 'Năm',
        all: 'Tất cả',
        netSpending: 'Phần tiền của bạn đã chi',
        fromBills: (count: number, label: string) => `Dựa trên ${count} hóa đơn trong ${label}`,
        groupSpending: 'Tổng quy mô các cuộc vui',
        totalBeforeSplit: 'Tổng chi phí cả nhóm trước khi chia tiền',
        byCategory: 'Cơ cấu chi tiêu cá nhân',
        noExpensePeriod: (label: string) => `Không có chi tiêu nào trong ${label}.`,
        frequentBuddies: 'Cạ cứng đi ăn / mua sắm nhiều nhất',
        noBuddies: (label: string) => `Chưa có dữ liệu tụ tập cùng bạn bè trong ${label}.`,
        hangouts: 'kèo chung',
        haventMet: 'Đã lâu chưa tụ tập lại',
        allUpToDate: 'Tuyệt vời! Bạn vẫn gặp gỡ đều đặn với mọi người.',
        daysAgo: (days: number) => `${days} ngày trước`,
        totalCenter: 'TỔNG CHI',
        allTimeLabel: 'Toàn bộ thời gian',
      },
      en: {
        title: 'Spending & Social Insights',
        subtitle: 'Monthly financial insights and hangout buddies',
        month: 'Month',
        week: 'Week',
        year: 'Year',
        all: 'All',
        netSpending: 'Your Net Spending',
        fromBills: (count: number, label: string) => `From ${count} bills in ${label}`,
        groupSpending: 'Total Group Spending',
        totalBeforeSplit: 'Total group bills before split',
        byCategory: 'Spending by Category',
        noExpensePeriod: (label: string) => `No expenses recorded in ${label}.`,
        frequentBuddies: 'Frequent Hangout Buddies',
        noBuddies: (label: string) => `No hangout data with buddies in ${label}.`,
        hangouts: 'hangouts',
        haventMet: 'Haven’t Met in a While',
        allUpToDate: 'Great! All contacts are active.',
        daysAgo: (days: number) => `${days} days ago`,
        totalCenter: 'TOTAL',
        allTimeLabel: 'All Time',
      },
      ru: {
        title: 'Аналитика расходов',
        subtitle: 'Ежемесячная статистика ваших расходов и встреч с друзьями',
        month: 'Месяц',
        week: 'Неделя',
        year: 'Год',
        all: 'Все время',
        netSpending: 'Ваши личные расходы',
        fromBills: (count: number, label: string) => `На основе ${count} счетов (${label})`,
        groupSpending: 'Общая сумма встреч',
        totalBeforeSplit: 'Общая сумма счетов компании до разделения',
        byCategory: 'Категории расходов',
        noExpensePeriod: (label: string) => `Нет расходов за ${label}.`,
        frequentBuddies: 'Чаще всего проводите время с',
        noBuddies: (label: string) => `Нет совместных встреч с друзьями за ${label}.`,
        hangouts: 'встреч',
        haventMet: 'Давно не виделись',
        allUpToDate: 'Отлично! Вы регулярно общаетесь со всеми друзьями.',
        daysAgo: (days: number) => `${days} дн. назад`,
        totalCenter: 'ИТОГО',
        allTimeLabel: 'Все время',
      },
      zh: {
        title: '支出与社交分析',
        subtitle: '每月个人支出明细及好友聚会频率统计',
        month: '按月',
        week: '按周',
        year: '按年',
        all: '全部',
        netSpending: '您的个人实付',
        fromBills: (count: number, label: string) => `基于 ${label} 的 ${count} 笔账单`,
        groupSpending: '聚会总支出规模',
        totalBeforeSplit: '分摊前的聚会账单总金额',
        byCategory: '支出类别构成',
        noExpensePeriod: (label: string) => `${label} 内暂无支出记录。`,
        frequentBuddies: '聚会最频繁的好友',
        noBuddies: (label: string) => `${label} 内暂无好友聚会记录。`,
        hangouts: '次同行',
        haventMet: '好久不见的好友',
        allUpToDate: '太棒了！您与所有朋友都有定期联系。',
        daysAgo: (days: number) => `${days} 天前`,
        totalCenter: '总计',
        allTimeLabel: '全部时间',
      },
    };
    return dict[locale as 'vi' | 'en' | 'ru' | 'zh'] || dict.en;
  }, [locale]);

  const myId = user?.id || profile?.id || 'member_me_default';

  // Chỉ lấy tên của CHÍNH BẢN THÂN tài khoản đang đăng nhập hiện tại
  const currentDisplayName = (
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    ''
  ).trim();

  const myNamesList = useMemo(() => {
    return [currentDisplayName, 'tôi', 'me']
      .filter(Boolean)
      .map((n) => normalizeString(n as string));
  }, [currentDisplayName]);

  const isMe = (member: { id?: string; name?: string }) => {
    if (member.id && (member.id === myId || member.id === 'member_me_default')) return true;
    const norm = normalizeString(member.name || '');
    if (!norm) return false;
    return myNamesList.some((myName) => norm === myName);
  };

  const groupAvatarsMap = useMemo(() => {
    const map: Record<string, string> = {};
    (savedGroups || []).forEach((g: any) => {
      (g.members || []).forEach((gm: any) => {
        if (gm.name && gm.avatar_url) {
          map[normalizeString(gm.name)] = gm.avatar_url;
        }
      });
    });
    return map;
  }, [savedGroups]);

  const handlePrev = () => {
    const d = new Date(selectedDate);
    if (filterMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (filterMode === 'week') d.setDate(d.getDate() - 7);
    else if (filterMode === 'year') d.setFullYear(d.getFullYear() - 1);
    setSelectedDate(d);
  };

  const handleNext = () => {
    const d = new Date(selectedDate);
    if (filterMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (filterMode === 'week') d.setDate(d.getDate() + 7);
    else if (filterMode === 'year') d.setFullYear(d.getFullYear() + 1);
    setSelectedDate(d);
  };

  const weekRange = useMemo(() => {
    const current = new Date(selectedDate);
    const day = current.getDay();
    const diffToMonday = current.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(current.setDate(diffToMonday));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  }, [selectedDate]);

  const timeLabel = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    const paddedMonth = m < 10 ? `0${m}` : `${m}`;
    if (filterMode === 'month') {
      return locale === 'vi' ? `Tháng ${m}/${y}` : locale === 'ru' ? `Месяц: ${paddedMonth}.${y}` : `Month: ${paddedMonth}/${y}`;
    }
    if (filterMode === 'week') {
      const monStr = `${weekRange.monday.getDate()}/${weekRange.monday.getMonth() + 1}`;
      const sunStr = `${weekRange.sunday.getDate()}/${weekRange.sunday.getMonth() + 1}/${y}`;
      return `${monStr} - ${sunStr}`;
    }
    if (filterMode === 'year') {
      return locale === 'vi' ? `Năm ${y}` : locale === 'ru' ? `Год: ${y}` : `Year: ${y}`;
    }
    return i18n.allTimeLabel;
  }, [filterMode, selectedDate, weekRange, locale, i18n.allTimeLabel]);

  // Lọc hóa đơn theo kỳ đang chọn
  const filteredBills: BillSession[] = useMemo(() => {
    return (history || []).filter((bill: BillSession) => {
      const billDate = new Date(bill.date);
      if (isNaN(billDate.getTime())) return false;

      if (filterMode === 'month') {
        return billDate.getMonth() === selectedDate.getMonth() && billDate.getFullYear() === selectedDate.getFullYear();
      }
      if (filterMode === 'week') {
        return billDate >= weekRange.monday && billDate <= weekRange.sunday;
      }
      if (filterMode === 'year') {
        return billDate.getFullYear() === selectedDate.getFullYear();
      }
      return true;
    });
  }, [history, filterMode, selectedDate, weekRange]);

  // Tính chi tiêu & màu sắc phân loại
  const stats = useMemo(() => {
    let totalMySpent = 0;
    let totalGroupSpent = 0;
    const catMap: Record<string, { name: string; amount: number; color: string; icon: any }> = {};
    let customColorIndex = 0;

    filteredBills.forEach((bill) => {
      const billTotal = calculateBillTotals(bill).total;
      totalGroupSpent += billTotal;

      const breakdowns = calculateMemberBreakdowns(bill);
      const myBreakdown = breakdowns.find((b) => {
        const member = bill.members.find((m) => m.id === b.memberId);
        return member ? isMe(member) : false;
      });

      const myShare = myBreakdown ? myBreakdown.totalOwed : (billTotal / (bill.members.length || 1));
      totalMySpent += myShare;

      const rawCat = (bill.category || 'dining').trim();
      if (!catMap[rawCat]) {
        const meta = CATEGORY_META[rawCat];
        if (meta) {
          const localizedName = meta.label[locale as 'vi' | 'en' | 'ru' | 'zh'] || meta.label.en;
          catMap[rawCat] = {
            name: localizedName,
            amount: 0,
            color: meta.color,
            icon: meta.icon,
          };
        } else {
          const assignedColor = CUSTOM_CATEGORY_PALETTE[customColorIndex % CUSTOM_CATEGORY_PALETTE.length];
          customColorIndex += 1;
          catMap[rawCat] = {
            name: rawCat,
            amount: 0,
            color: assignedColor,
            icon: Tag,
          };
        }
      }
      catMap[rawCat].amount += myShare;
    });

    const categories: CategoryMetric[] = Object.entries(catMap).map(([key, val]) => ({
      key,
      name: val.name,
      icon: val.icon,
      color: val.color,
      amount: Math.round(val.amount),
      percentage: totalMySpent > 0 ? (val.amount / totalMySpent) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);

    return { totalMySpent, totalGroupSpent, categories };
  }, [filteredBills, locale, myNamesList, myId]);

  // Phân tích CẠ CỨNG: Loại trừ đúng tài khoản hiện tại, giữ lại Ouranos và các bạn bè
  const socialMetrics = useMemo(() => {
    const friendFrequency: Record<string, { name: string; count: number; lastDate: Date; avatar_url?: string }> = {};

    filteredBills.forEach((bill: BillSession) => {
      const billDate = new Date(bill.date);
      (bill.members || []).forEach((m) => {
        if (isMe(m)) return; // Bỏ qua tài khoản của chính bạn

        const displayName = (m.name || '').trim();
        if (!displayName) return;

        const normKey = normalizeString(displayName);
        const matchedProfile = profilesMap[m.id] || profilesMap[normKey];
        const latestAvatar = matchedProfile?.avatar_url || groupAvatarsMap[normKey] || m.avatar_url;

        if (!friendFrequency[normKey]) {
          friendFrequency[normKey] = {
            name: displayName,
            count: 0,
            lastDate: billDate,
            avatar_url: latestAvatar,
          };
        }
        friendFrequency[normKey].count += 1;
        if (latestAvatar) {
          friendFrequency[normKey].avatar_url = latestAvatar;
        }
        if (billDate > friendFrequency[normKey].lastDate) {
          friendFrequency[normKey].lastDate = billDate;
        }
      });
    });

    const friendList = Object.values(friendFrequency);
    const topFriends = [...friendList].sort((a, b) => b.count - a.count).slice(0, 6);

    const now = new Date();
    const distantFriends = friendList
      .filter((f) => (now.getTime() - f.lastDate.getTime()) > 25 * 24 * 60 * 60 * 1000)
      .sort((a, b) => a.lastDate.getTime() - b.lastDate.getTime())
      .slice(0, 3);

    return { topFriends, distantFriends };
  }, [filteredBills, myNamesList, profilesMap, groupAvatarsMap, myId]);

  const preferredCurrency = history?.[0]?.currency || 'VND';

  const pieSlices = useMemo(() => {
    let accumulatedAngle = 0;
    return stats.categories.map((cat) => {
      const sliceAngle = (cat.percentage / 100) * 360;
      const startAngle = accumulatedAngle;
      accumulatedAngle += sliceAngle;
      return { ...cat, startAngle, sliceAngle };
    });
  }, [stats.categories]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & Bộ chọn thời gian */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
            <Sparkles className="w-5 h-5 text-accent" />
            <span>{i18n.title}</span>
          </h2>
          <p className="text-xs text-ink-3">
            {i18n.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-line">
            {(['month', 'week', 'year', 'all'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  filterMode === mode ? 'bg-accent text-white shadow-sm' : 'text-ink-3 hover:text-ink'
                }`}
              >
                {mode === 'month' ? i18n.month :
                 mode === 'week' ? i18n.week :
                 mode === 'year' ? i18n.year :
                 i18n.all}
              </button>
            ))}
          </div>

          {filterMode !== 'all' && (
            <div className="flex items-center gap-1 bg-surface-2 px-2 py-1 rounded-xl border border-line">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3 transition cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-ink px-2 min-w-28 text-center select-none">
                {timeLabel}
              </span>
              <button
                type="button"
                onClick={handleNext}
                className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3 transition cursor-pointer"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Thẻ Tổng quan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 border-accent/20 bg-gradient-to-br from-surface to-accent/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-3">
              {i18n.netSpending}
            </span>
            <span className="p-2 rounded-xl bg-accent/10 text-accent">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black mt-2 text-accent num">
            {formatCurrency(stats.totalMySpent, preferredCurrency)}
          </div>
          <p className="text-[11px] text-ink-3 mt-1">
            {i18n.fromBills(filteredBills.length, timeLabel)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-3">
              {i18n.groupSpending}
            </span>
            <span className="p-2 rounded-xl bg-surface-2 text-ink-2">
              <PieIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black mt-2 text-ink num">
            {formatCurrency(stats.totalGroupSpent, preferredCurrency)}
          </div>
          <p className="text-[11px] text-ink-3 mt-1">
            {i18n.totalBeforeSplit}
          </p>
        </div>
      </div>

      {/* Grid: Biểu đồ & Cơ cấu chi tiêu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Phân loại & Biểu đồ hình tròn */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-sm text-ink flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-accent" />
              <span>{i18n.byCategory}</span>
            </span>
            <span className="text-xs text-ink-3 font-medium">{timeLabel}</span>
          </h3>

          {stats.categories.length === 0 ? (
            <p className="text-xs text-ink-3 italic py-10 text-center">
              {i18n.noExpensePeriod(timeLabel)}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Biểu đồ Donut Chart SVG */}
              <div className="flex items-center justify-center py-2">
                <div className="relative w-36 h-36">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    {pieSlices.map((slice, i) => {
                      const strokeDash = `${slice.percentage} ${100 - slice.percentage}`;
                      const strokeOffset = 100 - pieSlices.slice(0, i).reduce((acc, s) => acc + s.percentage, 0);
                      return (
                        <circle
                          key={slice.key}
                          cx="18"
                          cy="18"
                          r="15.915"
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth="3.5"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={strokeOffset}
                          className="transition-all duration-500"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[10px] text-ink-3 uppercase tracking-wider font-semibold">{i18n.totalCenter}</span>
                    <span className="text-xs font-black text-ink num mt-0.5 max-w-[5.5rem] truncate">
                      {formatCurrency(stats.totalMySpent, preferredCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Danh sách từng danh mục */}
              <div className="space-y-2.5">
                {stats.categories.map((cat) => {
                  const IconComponent = cat.icon;
                  return (
                    <div key={cat.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <span
                            className="p-1.5 rounded-lg"
                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                          </span>
                          {cat.name}
                        </span>
                        <div className="text-right">
                          <span className="font-bold num text-ink">{formatCurrency(cat.amount, preferredCurrency)}</span>
                          <span className="text-ink-3 ml-1.5 font-medium">({cat.percentage.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(cat.percentage, 100)}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cạ cứng & Bạn bè */}
        <div className="card p-5 space-y-5">
          <div>
            <h3 className="font-bold text-sm text-ink flex items-center justify-between mb-3">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                <span>{i18n.frequentBuddies}</span>
              </span>
              <span className="text-xs text-ink-3 font-medium">{timeLabel}</span>
            </h3>

            {socialMetrics.topFriends.length === 0 ? (
              <p className="text-xs text-ink-3 italic py-6 text-center">
                {i18n.noBuddies(timeLabel)}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {socialMetrics.topFriends.map((friend) => (
                  <div key={friend.name} className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-2 border border-line">
                    <Avatar member={{ name: friend.name, avatar_url: friend.avatar_url } as any} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">{friend.name}</p>
                      <p className="text-[10px] text-accent font-medium">{friend.count} {i18n.hangouts}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line/60">
            <h3 className="font-bold text-sm text-ink flex items-center gap-2 mb-2 text-amber-500">
              <Clock className="w-4 h-4" />
              <span>{i18n.haventMet}</span>
            </h3>

            {socialMetrics.distantFriends.length === 0 ? (
              <p className="text-xs text-ink-3 italic py-2">
                {i18n.allUpToDate}
              </p>
            ) : (
              <div className="space-y-2">
                {socialMetrics.distantFriends.map((friend) => {
                  const daysAgo = Math.floor((new Date().getTime() - friend.lastDate.getTime()) / (24 * 60 * 60 * 1000));
                  return (
                    <div key={friend.name} className="flex items-center justify-between p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
                      <span className="font-medium text-ink flex items-center gap-2">
                        <Avatar member={{ name: friend.name, avatar_url: friend.avatar_url } as any} size="sm" />
                        {friend.name}
                      </span>
                      <span className="text-[11px] text-amber-500 font-semibold">
                        {i18n.daysAgo(daysAgo)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
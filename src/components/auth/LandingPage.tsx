import { useState, useEffect, type FormEvent } from 'react';
import {
  Sparkles,
  Users,
  Globe,
  Mail,
  Lock,
  User,
  ArrowRight,
  Sun,
  Moon,
  AlertCircle,
  Loader2,
  CheckCircle2,
  QrCode,
  Compass,
  Briefcase,
  Home,
  ShieldCheck,
  X,
  ScanLine,
  Eye,
  EyeOff,
  ChevronDown,
  Zap,
  Languages,
  BadgeCheck,
  Clock,
  Layers,
  PieChart,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useBillStore } from '../../store/useBillStore';
import { useLocale } from '../../hooks/useLocale';
import { LanguageSelector } from '../layout/LanguageSelector';

const LANDING_COPY = {
  vi: {
    badge: 'Ăn uống hết mình, tiền nong văn minh',
    heroTitle: 'Hóa đơn chia đều, tình bạn vẹn nguyên.',
    heroSub:
      'Chụp hóa đơn và AI tự động đọc từng món. Chạm để chọn người trả — thuế và tip được chia theo tỷ lệ. Không bảng tính phức tạp.',
    scanCta: 'Quét hóa đơn đầu tiên',
    howCta: 'Xem cách hoạt động',
    freeTag: 'Nhanh gọn · Tiện lợi · Không cần tải app',
    itemsDetected: 'AI đã nhận diện 5 món',
    whoPaysWhat: 'Ai trả bao nhiêu',
    taxTipIncluded: 'Đã gồm thuế 7% & tip',
    members: [
      { name: 'Linh', amount: '415.000 ₫', color: 'bg-emerald-600', initial: 'LT' },
      { name: 'Minh', amount: '195.000 ₫', color: 'bg-blue-600', initial: 'MN' },
      { name: 'Sasha', amount: '460.000 ₫', color: 'bg-sky-600', initial: 'SV' },
      { name: 'Wei', amount: '425.000 ₫', color: 'bg-amber-600', initial: 'WC' },
    ],
    stat1Val: 'Chuẩn xác',
    stat1Label: 'Tối ưu khi chụp đủ sáng',
    stat2Val: '~5 - 15s',
    stat2Label: 'Tốc độ bóc tách siêu tốc',
    stat3Val: '4 Ngôn ngữ',
    stat3Label: 'Việt · Anh · Nga · Trung',
    stat4Val: 'Đồng bộ Realtime',
    stat4Label: 'Tự động cập nhật tức thì',
    navHow: 'Cách hoạt động',
    navFeatures: 'Tính năng',
    navAudience: 'Dành cho ai',
    navFaq: 'Hỏi đáp',
    navLogin: 'Đăng nhập',
    navStart: 'Bắt đầu',
    howBadge: 'Quy trình 3 bước',
    howHeading: 'Từ ảnh chụp hóa đơn đến mã QR thanh toán',
    howSub: 'Loại bỏ hoàn toàn việc nhập tay hay tranh cãi về tiền tip và phụ phí.',
    howStep1Title: 'Chụp hoặc tải ảnh hóa đơn',
    howStep1Desc: 'AI Vision tự động nhận diện tên món, số lượng, đơn giá và chiết khấu.',
    howStep2Title: 'Chạm chọn món cho từng người',
    howStep2Desc: 'Món ăn chung chia đều, thuế VAT và phí phục vụ tự động phân bổ theo tỷ lệ.',
    howStep3Title: 'Quét mã QR thanh toán tức thì',
    howStep3Desc: 'Kết xuất thẻ thanh toán kèm mã VietQR hoặc СБП chứa đúng số tiền cần chuyển.',
    featBadge: 'Công nghệ cốt lõi',
    featHeading: 'Thiết kế chuyên biệt cho chi tiêu nhóm hiện đại',
    featSub: 'Mọi công cụ bạn cần để giữ sự minh bạch tài chính trong các buổi tụ tập.',
    feat1Title: 'Nhận diện OCR đa ngôn ngữ',
    feat1Desc: 'Đọc hiểu chuẩn xác hóa đơn tiếng Việt, tiếng Anh, tiếng Nga và tiếng Trung.',
    feat2Title: 'Nhóm hóa đơn (Timeline Trips)',
    feat2Desc: 'Nhóm nhiều hóa đơn khách sạn, vé xe, ăn uống suốt chuyến du lịch và chốt nợ 1 lần.',
    feat3Title: 'Báo cáo tài chính & Cạ cứng',
    feat3Desc: 'Phân tích cơ cấu chi tiêu hàng tháng và tự động xếp hạng bạn bè đi ăn cùng nhiều nhất.',
    feat4Title: 'Thanh toán VietQR & СБП tự động',
    feat4Desc: 'Tự động tính toán đường đi chuyển khoản ngắn nhất kèm mã QR đúng số tiền lẻ.',
    audBadge: 'Đối tượng sử dụng',
    audHeading: 'Phù hợp cho mọi kịch bản chi tiêu',
    aud1Title: 'Hội bạn bè ăn uống',
    aud1Desc: 'Ăn lẩu, nướng, cafe; tính tiền sòng phẳng không ngại ngùng.',
    aud2Title: 'Nhóm du lịch, phượt',
    aud2Desc: 'Quản lý chi phí suốt hành trình nhiều ngày với chế độ hóa đơn chặng.',
    aud3Title: 'Bạn cùng phòng (Roommates)',
    aud3Desc: 'Chia tiền điện nước, internet và đồ dùng sinh hoạt hàng tháng.',
    aud4Title: 'Đồng nghiệp công sở',
    aud4Desc: 'Order cơm trưa, trà sữa; gửi thẻ chia tiền kèm QR vào nhóm chat trong 1 chạm.',
    faqBadge: 'Câu hỏi thường gặp',
    faqHeading: 'Mọi điều bạn cần biết về FairShare',
    faqs: [
      {
        q: 'Hóa đơn bị nhăn, mờ hoặc in nhiệt nhạt màu thì AI có đọc được không?',
        a: 'Có. Mô hình AI OCR của FairShare được huấn luyện chuyên sâu cho hóa đơn thực tế tại nhà hàng, có khả năng tự cân bằng sáng và khôi phục ký tự bị mờ.',
      },
      {
        q: 'Chế độ Hóa đơn chặng (Timeline Trips) hoạt động thế nào?',
        a: 'Bạn có thể thêm nhiều hóa đơn nhỏ trong suốt chuyến đi (khách sạn, vé xe, ăn uống). Hệ thống sẽ tự bù trừ các khoản chi chéo nhau và rút gọn số lần chuyển khoản ít nhất có thể.',
      },
      {
        q: 'Báo cáo chi tiêu cá nhân có được bảo mật không?',
        a: 'Toàn bộ dữ liệu chi tiêu hàng tháng và danh sách bạn bè chỉ hiển thị cho riêng bạn, giúp bạn nắm rõ cơ cấu tài chính cá nhân.',
      },
      {
        q: 'Các thành viên khác có bắt buộc phải tải app hay tạo tài khoản không?',
        a: 'Hoàn toàn không. Chỉ cần 1 người quét bill và chia sẻ liên kết hoặc ảnh QR, mọi người chỉ việc mở app ngân hàng quét mã.',
      },
    ],
    ctaHeading: 'Sẵn sàng chia hóa đơn công bằng và thông minh?',
    ctaSub: 'Trải nghiệm quét thử hóa đơn đầu tiên hoàn toàn miễn phí ngay trên trình duyệt của bạn.',
    ctaCreateBtn: 'Tạo tài khoản miễn phí',
    footerBrandDesc:
      'Nền tảng chia hóa đơn nhóm thông minh với AI OCR, Hóa đơn chặng và tích hợp thanh toán VietQR / СБП tự động.',
    footerNavTitle: 'Điều hướng',
    footerSupportTitle: 'Chăm sóc khách hàng',
    footerSupportDesc: 'Mọi thắc mắc hoặc yêu cầu hỗ trợ kỹ thuật, hãy gửi thư tới:',
    footerSupportEmail: 'fairshare.app.admin@gmail.com',
    footerSupportTime: 'Thường phản hồi trong 45 phút (10:00 - 22:00)',
    legalPrivacyTitle: 'Chính sách bảo mật',
    legalPrivacyBody: `FairShare cam kết bảo vệ dữ liệu người dùng tuyệt đối:
1. Dữ liệu xử lý: Ảnh chụp hóa đơn chỉ được truyền qua API xử lý OCR để bóc tách món ăn và số tiền.
2. Lưu trữ: Chúng tôi không lưu trữ vĩnh viễn hình ảnh hóa đơn trên máy chủ công cộng nếu bạn không yêu cầu lưu lại lịch sử.
3. Bảo mật: Mọi dữ liệu cá nhân không bao giờ được cung cấp hoặc bán cho bất kỳ bên thứ ba nào.`,
    legalTermsTitle: 'Điều khoản dịch vụ',
    legalTermsBody: `Điều khoản khi sử dụng nền tảng FairShare:
1. Kiểm tra dữ liệu: Người dùng có trách nhiệm rà soát lại các mục món ăn và giá trị được AI nhận diện trước khi thực hiện chuyển tiền thực tế.
2. Thanh toán: FairShare chỉ tạo mã QR chuyển khoản theo cú pháp ngân hàng, giao dịch thực tế diễn ra trực tiếp trên ứng dụng Mobile Banking của bạn.
3. Giới hạn: Nhóm sử dụng thông thường hỗ trợ tối đa 8 người dùng để đảm bảo hiệu suất tính toán tối ưu nhất.`,
    legalSecurityTitle: 'Bảo mật thanh toán',
    legalSecurityBody: `Cơ chế an toàn thanh toán tại FairShare:
1. Mã hóa chuẩn cao: Toàn bộ phiên kết nối được mã hóa đầu cuối bằng giao thức HTTPS/TLS 256-bit.
2. Không lưu thẻ/mật khẩu: Ứng dụng không yêu cầu số thẻ tín dụng, mã CVV hay mật khẩu tài khoản ngân hàng.
3. Chuyển khoản an toàn: Tiền được chuyển khoản trực tiếp giữa tài khoản cá nhân thông qua chuẩn VietQR và СБП.`,
    legalCloseBtn: 'Đã hiểu & Đóng',
    loginTab: 'Đăng nhập',
    signupTab: 'Đăng ký',
    welcomeBack: 'Chào mừng bạn quay lại',
    welcomeSub: 'Đăng nhập để đồng bộ lịch sử hóa đơn và danh sách nhóm của bạn.',
    createNew: 'Tạo tài khoản FairShare',
    createSub: 'Miễn phí trọn đời. Bắt đầu quản lý chi tiêu nhóm thông minh ngay hôm nay.',
    forgotSub: 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.',
    displayName: 'Tên hiển thị của bạn',
    email: 'Địa chỉ Email',
    password: 'Mật khẩu (tối thiểu 6 ký tự)',
    signInBtn: 'Đăng nhập vào ứng dụng',
    signUpBtn: 'Đăng ký & Bắt đầu ngay',
    googleBtn: 'Tiếp tục nhanh với Google',
    or: 'hoặc tiếp tục với email',
    forgotPassword: 'Quên mật khẩu?',
    forgotTitle: 'Khôi phục mật khẩu',
    sendReset: 'Gửi liên kết khôi phục',
    backToLogin: '← Quay lại màn hình đăng nhập',
    resetSent: 'Nếu email này hợp lệ, hướng dẫn khôi phục sẽ được gửi tới hộp thư của bạn.',
    signupSuccess: 'Đăng ký thành công! Hãy đăng nhập để trải nghiệm đầy đủ.',
    securityNote: 'Bảo mật SSL 256-bit · Không lưu mật khẩu ngân hàng',
  },
  en: {
    badge: 'Good food, fair share, zero awkward math',
    heroTitle: 'Split the bill, keep the friendship.',
    heroSub:
      'Snap a receipt and AI reads every line item. Tap who had what — tax and tip are shared proportionally. No spreadsheets.',
    scanCta: 'Scan your first receipt',
    howCta: 'See how it works',
    freeTag: 'Fast · Convenient · No app download needed',
    itemsDetected: 'AI detected 5 items',
    whoPaysWhat: 'Who pays what',
    taxTipIncluded: 'Includes 7% tax & tip',
    members: [
      { name: 'Linh', amount: '$18.40', color: 'bg-emerald-600', initial: 'LT' },
      { name: 'Minh', amount: '$11.20', color: 'bg-blue-600', initial: 'MN' },
      { name: 'Sasha', amount: '$21.50', color: 'bg-sky-600', initial: 'SV' },
      { name: 'Wei', amount: '$17.86', color: 'bg-amber-600', initial: 'WC' },
    ],
    stat1Val: 'High Precision',
    stat1Label: 'Optimized for clear snaps',
    stat2Val: '~5 - 15s',
    stat2Label: 'Lightning-fast OCR speed',
    stat3Val: '4 Languages',
    stat3Label: 'VI · EN · RU · ZH Support',
    stat4Val: 'Realtime Sync',
    stat4Label: 'Updates instantly across devices',
    navHow: 'How it works',
    navFeatures: 'Features',
    navAudience: 'Who it’s for',
    navFaq: 'FAQ',
    navLogin: 'Log in',
    navStart: 'Get started',
    howBadge: '3-Step Workflow',
    howHeading: 'From a paper receipt to instant QR settlement',
    howSub: 'Eliminate manual data entry and awkward debates over tax and service charges.',
    howStep1Title: 'Snap or upload receipt',
    howStep1Desc: 'AI Vision automatically detects items, quantities, prices, and discounts.',
    howStep2Title: 'Tap to assign items',
    howStep2Desc: 'Everyone pays for what they had. Tax and tip distribute proportionally.',
    howStep3Title: 'Scan QR to settle',
    howStep3Desc: 'Generate clean summary cards with embedded VietQR or SBP payment codes.',
    featBadge: 'Core Technology',
    featHeading: 'Purpose-built for modern group expenses',
    featSub: 'Everything you need to keep group finances crystal clear and friction-free.',
    feat1Title: 'Multi-Language AI OCR',
    feat1Desc: 'Accurately parses Vietnamese, English, Russian, and Chinese receipts.',
    feat2Title: 'Bill Groups (Timeline Trips)',
    feat2Desc: 'Bundle hotels, flights, and meals across multi-day vacations with 1-step settlement.',
    feat3Title: 'Analytics & Top Buddies',
    feat3Desc: 'Track monthly spending patterns and automatically rank your most frequent dining friends.',
    feat4Title: 'Instant VietQR & SBP Transfers',
    feat4Desc: 'Optimizes debt settlement paths with exact payment QR codes.',
    audBadge: 'Use Cases',
    audHeading: 'Built for every shared expense scenario',
    aud1Title: 'Dining with Friends',
    aud1Desc: 'Weekend hotpot, BBQ, or coffee; settle up in seconds.',
    aud2Title: 'Group Travel & Trips',
    aud2Desc: 'Track shared flights, hotels, and daily meals throughout your multi-day journey.',
    aud3Title: 'Roommates',
    aud3Desc: 'Split monthly utilities, internet, and shared grocery runs with clarity.',
    aud4Title: 'Office Colleagues',
    aud4Desc: 'Team lunches and coffee orders; drop a QR settlement card right into work chat.',
    faqBadge: 'Frequently Asked Questions',
    faqHeading: 'Everything you need to know about FairShare',
    faqs: [
      {
        q: 'Can the AI read crumpled, blurry, or faded thermal receipts?',
        a: 'Yes. FairShare’s OCR engine is specifically trained on restaurant receipts, enhancing contrast and reconstructing faded text.',
      },
      {
        q: 'How does Timeline Trips mode work?',
        a: 'You can add multiple small expenses throughout a long trip. The app cancels out cross-debts and calculates the minimum number of transfers.',
      },
      {
        q: 'Is personal financial analytics data secure?',
        a: 'All monthly analytics and friends statistics are completely private and visible only to your authenticated account.',
      },
      {
        q: 'Do my friends need to download an app or create an account?',
        a: 'Not at all. Friends simply scan the QR code with their banking app without registering.',
      },
    ],
    ctaHeading: 'Ready to split bills effortlessly?',
    ctaSub: 'Try scanning your first receipt completely free right in your browser.',
    ctaCreateBtn: 'Create free account',
    footerBrandDesc:
      'Next-generation group expense platform powered by AI OCR, Timeline Trips, and instant QR payments.',
    footerNavTitle: 'Navigation',
    footerSupportTitle: 'Customer Support',
    footerSupportDesc: 'For questions or technical feedback, contact us directly:',
    footerSupportEmail: 'fairshare.app.admin@gmail.com',
    footerSupportTime: 'Usually replies within 45 minutes (10:00 - 22:00)',
    legalPrivacyTitle: 'Privacy Policy',
    legalPrivacyBody: `FairShare is committed to securing your personal information:
1. Data Processing: Receipt images are only processed through OCR algorithms to extract line items.
2. Storage: We do not permanently store receipt images on public servers unless saved to your personal history.
3. Third Parties: Your data is never sold or shared with advertisers or third-party brokers.`,
    legalTermsTitle: 'Terms of Service',
    legalTermsBody: `Terms of using the FairShare application:
1. Accuracy Verification: Users are responsible for double-checking OCR results before making financial transfers.
2. Settlements: FairShare provides QR formats; monetary transactions occur directly via your banking apps.
3. Limits: Standard accounts support up to 8 members per bill to ensure real-time performance.`,
    legalSecurityTitle: 'Payment Security',
    legalSecurityBody: `Security standards implemented at FairShare:
1. End-to-End Encryption: All transmissions are secured with 256-bit HTTPS/TLS protocols.
2. Zero Sensitive Storage: We never request or store credit card numbers, CVVs, or bank passwords.
3. Direct Transfers: Money moves directly between user accounts via authorized QR payment standards.`,
    legalCloseBtn: 'Understood & Close',
    loginTab: 'Log In',
    signupTab: 'Sign Up',
    welcomeBack: 'Welcome back',
    welcomeSub: 'Sign in to sync your receipt history and saved friend groups.',
    createNew: 'Create your FairShare account',
    createSub: 'Free forever. Start managing group expenses effortlessly today.',
    forgotSub: 'Enter your registered email and we will send you a password reset link.',
    displayName: 'Your Display Name',
    email: 'Email address',
    password: 'Password (min 6 chars)',
    signInBtn: 'Sign In to FairShare',
    signUpBtn: 'Sign Up & Get Started',
    googleBtn: 'Continue with Google',
    or: 'or continue with email',
    forgotPassword: 'Forgot password?',
    forgotTitle: 'Reset your password',
    sendReset: 'Send reset link',
    backToLogin: '← Back to sign in',
    resetSent: 'If this email is registered, password recovery instructions are on the way.',
    signupSuccess: 'Account created! Please sign in to proceed.',
    securityNote: '256-bit SSL Encrypted · Zero bank credentials stored',
  },
  ru: {
    badge: 'Вкусный ужин — честный счет',
    heroTitle: 'Делите общий чек легко и без споров.',
    heroSub:
      'Сфотографируйте чек, и ИИ распознает каждую позицию. Отметьте участников — налог и чаевые распределятся пропорционально.',
    scanCta: 'Сканировать первый чек',
    howCta: 'Как это работает',
    freeTag: 'Быстро · Удобно · Без установки приложения',
    itemsDetected: 'ИИ распознал 5 позиций',
    whoPaysWhat: 'Кто сколько платит',
    taxTipIncluded: 'С учетом налога 7% и чаевых',
    members: [
      { name: 'Линь', amount: '1 680 ₽', color: 'bg-emerald-600', initial: 'ЛТ' },
      { name: 'Минь', amount: '990 ₽', color: 'bg-blue-600', initial: 'МН' },
      { name: 'Саша', amount: '1 950 ₽', color: 'bg-sky-600', initial: 'СВ' },
      { name: 'Вэй', amount: '1 620 ₽', color: 'bg-amber-600', initial: 'ВЦ' },
    ],
    stat1Val: 'Точно',
    stat1Label: 'Лучший результат при хорошем свете',
    stat2Val: '~5 - 15с',
    stat2Label: 'Мгновенное распознавание',
    stat3Val: '4 Языка',
    stat3Label: 'RU · EN · VI · ZH',
    stat4Val: 'Онлайн-синхр.',
    stat4Label: 'Мгновенное обновление данных',
    navHow: 'Как работает',
    navFeatures: 'Возможности',
    navAudience: 'Для кого',
    navFaq: 'Вопросы',
    navLogin: 'Вход',
    navStart: 'Начать',
    howBadge: 'Процесс из 3 шагов',
    howHeading: 'От фото чека до мгновенной оплаты по QR',
    howSub: 'Забудьте о ручном вводе цифр в калькулятор и спорах о чаевых.',
    howStep1Title: 'Загрузите фото чека',
    howStep1Desc: 'ИИ извлекает названия блюд, количество, цены и скидки.',
    howStep2Title: 'Отметьте участников',
    howStep2Desc: 'Общие блюда делятся поровну, налоги — пропорционально заказу.',
    howStep3Title: 'Оплатите по QR-коду',
    howStep3Desc: 'Карточка расчета с QR-кодом СБП или VietQR с точной суммой.',
    featBadge: 'Технологии',
    featHeading: 'Создано для современного учета общих расходов',
    featSub: 'Все необходимые инструменты для прозрачных расчетов в любой компании.',
    feat1Title: 'Мультиязычный OCR',
    feat1Desc: 'Распознает чеки на русском, вьетнамском, английском и китайском языках.',
    feat2Title: 'Группы счетов (Timeline Trips)',
    feat2Desc: 'Объединяйте счета отелей, билетов и ресторанов за всю поездку в один расчет.',
    feat3Title: 'Аналитика и частые друзья',
    feat3Desc: 'Ежемесячная структура расходов и рейтинг друзей, с кем чаще всего отдыхаете.',
    feat4Title: 'Быстрые переводы через СБП',
    feat4Desc: 'Умный алгоритм сокращает число переводов между друзьями до минимума.',
    audBadge: 'Сценарии',
    audHeading: 'Идеально подходит для любых совместных трат',
    aud1Title: 'Встречи с друзьями',
    aud1Desc: 'Ужины в кафе и барах; быстрый расчет без неловких подсчетов.',
    aud2Title: 'Совместные путешествия',
    aud2Desc: 'Учет расходов на билеты, отели и еду на протяжении всей поездки.',
    aud3Title: 'Соседи по квартире',
    aud3Desc: 'Разделение счетов за ЖКУ, интернет и бытовые покупки.',
    aud4Title: 'Коллеги по офису',
    aud4Desc: 'Заказы обедов и кофе с отправкой QR-кода в рабочий чат.',
    faqBadge: 'Частые вопросы',
    faqHeading: 'Ответы на популярные вопросы о FairShare',
    faqs: [
      {
        q: 'Распознает ли ИИ мятые или размытые кассовые чеки?',
        a: 'Да. Алгоритмы FairShare обучены на ресторанных чеках и автоматически улучшают контрастность.',
      },
      {
        q: 'Как работает режим поездки (Timeline Trips)?',
        a: 'Вы можете вносить множество мелких трат за все дни отпуска. Приложение автоматически взаимозачтет долги.',
      },
      {
        q: 'Безопасны ли личные финансовые данные?',
        a: 'Вся аналитика доступна исключительно вам после авторизации и не передается третьим лицам.',
      },
      {
        q: 'Нужно ли друзьям устанавливать приложение?',
        a: 'Нет. Достаточно одному отсканировать чек, остальные сканируют QR-код через мобильный банк.',
      },
    ],
    ctaHeading: 'Готовы забыть о сложных расчетах по чекам?',
    ctaSub: 'Попробуйте отсканировать свой первый чек бесплатно прямо сейчас в браузере.',
    ctaCreateBtn: 'Создать бесплатный аккаунт',
    footerBrandDesc:
      'Платформа нового поколения для умного разделения чеков с ИИ, поездками и платежами через СБП.',
    footerNavTitle: 'Навигация',
    footerSupportTitle: 'Служба поддержки',
    footerSupportDesc: 'По вопросам и предложениям пишите напрямую разработчику:',
    footerSupportEmail: 'fairshare.app.admin@gmail.com',
    footerSupportTime: 'Обычно отвечаем в течение 45 минут (10:00 - 22:00)',
    legalPrivacyTitle: 'Политика конфиденциальности',
    legalPrivacyBody: `FairShare гарантирует защиту ваших данных:
1. Обработка: Изображения чеков обрабатываются исключительно для распознавания позиций.
2. Хранение: Мы не сохраняем чеки на публичных серверах без вашего запроса.
3. Конфиденциальность: Личные данные никогда не передаются сторонним организациям.`,
    legalTermsTitle: 'Условия использования',
    legalTermsBody: `Правила использования сервиса FairShare:
1. Проверка: Пользователь проверяет распознанные данные перед переводом средств.
2. Платежи: FairShare формирует QR-коды, транзакции проходят в вашем банковском приложении.
3. Ограничения: Бесплатный режим поддерживает до 8 участников в одном счете.`,
    legalSecurityTitle: 'Безопасность платежей',
    legalSecurityBody: `Стандарты безопасности FairShare:
1. Шифрование: Все соединения защищены современными сертификатами HTTPS/TLS 256-бит.
2. Без хранения карт: Сервис не запрашивает и не сохраняет данные банковских карт и пароли.
3. Прямые расчеты: Переводы производятся напрямую между счетами по системе QR-платежей.`,
    legalCloseBtn: 'Понятно и закрыть',
    loginTab: 'Вход',
    signupTab: 'Регистрация',
    welcomeBack: 'С возвращением',
    welcomeSub: 'Войдите, чтобы синхронизировать историю чеков и списки друзей.',
    createNew: 'Создать аккаунт FairShare',
    createSub: 'Бесплатно навсегда. Управляйте совместными расходами легко и прозрачно.',
    forgotSub: 'Введите ваш email, и мы отправим ссылку для восстановления пароля.',
    displayName: 'Ваше отображаемое имя',
    email: 'Электронная почта',
    password: 'Пароль (мин. 6 символов)',
    signInBtn: 'Войти в приложение',
    signUpBtn: 'Зарегистрироваться',
    googleBtn: 'Продолжить через Google',
    or: 'или через электронную почту',
    forgotPassword: 'Забыли пароль?',
    forgotTitle: 'Восстановление пароля',
    sendReset: 'Отправить ссылку',
    backToLogin: '← Вернуться ко входу',
    resetSent: 'Инструкции по восстановлению отправлены на вашу почту.',
    signupSuccess: 'Регистрация завершена! Пожалуйста, войдите.',
    securityNote: 'Шифрование SSL 256-бит · Банковские данные не хранятся',
  },
  zh: {
    badge: '聚餐尽兴，算账省心',
    heroTitle: '账单算得清，友情更长久。',
    heroSub:
      '拍照扫描账单小票，AI 自动识别每一道菜品。轻轻勾选就餐成员——税费与小费按比例公摊，告别手工计算。',
    scanCta: '扫描您的首张小票',
    howCta: '了解如何运作',
    freeTag: '快捷 · 方便 · 无需下载应用',
    itemsDetected: 'AI 已精准识别 5 项菜品',
    whoPaysWhat: '各成员应付明细',
    taxTipIncluded: '已含 7% 税费及服务费',
    members: [
      { name: 'Linh', amount: '¥132.50', color: 'bg-emerald-600', initial: 'LT' },
      { name: 'Minh', amount: '¥81.00', color: 'bg-blue-600', initial: 'MN' },
      { name: 'Sasha', amount: '¥155.20', color: 'bg-sky-600', initial: 'SV' },
      { name: 'Wei', amount: '¥128.80', color: 'bg-amber-600', initial: 'WC' },
    ],
    stat1Val: '精准提取',
    stat1Label: '平整光线下识别最佳',
    stat2Val: '~5 - 15秒',
    stat2Label: '极速秒级识别解析',
    stat3Val: '4 种语言',
    stat3Label: '中 · 越 · 英 · 俄全支持',
    stat4Val: '实时同步',
    stat4Label: '数据即时更新',
    navHow: '工作原理',
    navFeatures: '核心功能',
    navAudience: '适用场景',
    navFaq: '常见问题',
    navLogin: '登录',
    navStart: '立即体验',
    howBadge: '三步极简流程',
    howHeading: '从纸质小票照片到一键扫码收款',
    howSub: '彻底告别手动按计算器与繁琐的税费平摊争论。',
    howStep1Title: '拍照或上传小票',
    howStep1Desc: 'AI 视觉引擎自动提取菜品名称、数量、单价及折扣。',
    howStep2Title: '勾选就餐成员',
    howStep2Desc: '多人共享菜品均摊，增值税与服务费按消费比例智能分摊。',
    howStep3Title: '扫码即刻结算',
    howStep3Desc: '一键生成包含每位成员精确应付金额与收款码的结算卡片。',
    featBadge: '核心技术架构',
    featHeading: '专为现代团队聚餐与分账打造',
    featSub: '提供全方位的透明分账体验，让每一次聚会都轻松愉快。',
    feat1Title: '多语言 AI OCR 引擎',
    feat1Desc: '自动识别中文、越南语、英语及俄语餐饮小票。',
    feat2Title: '账单分组 (Timeline Trips)',
    feat2Desc: '汇总多日行程中的机票、住宿及餐饮开销，自动对冲债务并一键清算。',
    feat3Title: '月度财务统计与聚会常客',
    feat3Desc: '智能分析个人消费类别分布，自动生成聚会最频繁的好友榜单。',
    feat4Title: '智能扫码秒转账',
    feat4Desc: '按最优路径合并转账频次，生成带精确金额的转账码。',
    audBadge: '适用人群',
    audHeading: '完美契合各类日常分摊场景',
    aud1Title: '好友聚餐 AA 制',
    aud1Desc: '火锅、烧烤、下午茶；账目清晰明了。',
    aud2Title: '结伴旅行出游',
    aud2Desc: '全程记录机票、民宿及日常餐饮开销，财务公开透明。',
    aud3Title: '合租室友日常',
    aud3Desc: '每月水电网络及超市采购账单一键分摊。',
    aud4Title: '职场同事拼单',
    aud4Desc: '工作日外卖与下午茶，导出结算卡直接发至工作群。',
    faqBadge: '常见问题解答',
    faqHeading: '关于 FairShare 您想了解的一切',
    faqs: [
      {
        q: '如果小票有折痕或模糊，AI 还能识别吗？',
        a: '可以。FairShare 的模型针对真实小票深度优化，能够自动增强对比度并识别文字。',
      },
      {
        q: '旅行分程模式 (Timeline Trips) 是如何工作的？',
        a: '您可以把一次旅行中产生的所有多笔小票加入同一行程，系统自动对冲交叉债务，将转账次数降到最少。',
      },
      {
        q: '个人财务报告数据是否安全？',
        a: '您的月度分析数据受端到端加密保护，仅供您登录后个人查阅，绝不公开。',
      },
      {
        q: '同行的朋友也需要注册账号吗？',
        a: '完全不需要。一人扫码生成结算单，其他人直接使用手机银行 App 扫码转账即可。',
      },
    ],
    ctaHeading: '准备好体验更聪明的聚餐分账方式了吗？',
    ctaSub: '无需安装，立即在浏览器中免费体验您的第一次智能账单扫描。',
    ctaCreateBtn: '创建免费账户',
    footerBrandDesc:
      '融合 AI OCR 识别、多日行程分账与一键二维码转账的新一代团队账单拆分平台。',
    footerNavTitle: '快速导航',
    footerSupportTitle: '客户服务与支持',
    footerSupportDesc: '如有任何疑问或技术建议，欢迎联系我们：',
    footerSupportEmail: 'fairshare.app.admin@gmail.com',
    footerSupportTime: '通常在 45 分钟内回复 (10:00 - 22:00)',
    legalPrivacyTitle: '隐私政策',
    legalPrivacyBody: `FairShare 严格守护您的个人隐私安全：
1. 数据处理：您上传的小票图片仅用于 OCR 提取菜品及价格。
2. 数据存储：除非您主动保存至账户历史，否则系统不会永久留存您的小票照片。
3. 严格保密：我们绝不向任何第三方或商业广告网络透露或出售您的数据。`,
    legalTermsTitle: '服务条款',
    legalTermsBody: `使用 FairShare 平台之相关准则：
1. 信息核对：用户在进行真实资金转账前，应对 OCR 识别的金额与项目进行二次确认。
2. 资金安全：本平台仅提供转账码及明细，实际交易全过程由您的手机银行完成。
3. 容量规则：基础模式支持单张小票分摊至最多8位成员，保障毫秒级计算性能。`,
    legalSecurityTitle: '支付安全',
    legalSecurityBody: `FairShare 支付安全防范机制：
1. 全程高强度加密：所有交互均采用行业标准的 256 位 HTTPS/TLS 安全传输。
2. 零敏感信息存储：我们不收集也不保存您的银行密码、CVV 码或信用卡卡号。
3. 点对点交易：所有款项直接在各银行 App 间点对点流转，平台不沉淀任何资金。`,
    legalCloseBtn: '知晓并关闭',
    loginTab: '登录',
    signupTab: '注册',
    welcomeBack: '欢迎回来',
    welcomeSub: '登录您的账户以同步历史账单与常用好友分组。',
    createNew: '创建 FairShare 免费账户',
    createSub: '永久免费使用，立即开启高效透明的团队分账体验。',
    forgotSub: '输入您的注册邮箱，我们将向您发送密码重置链接。',
    displayName: '您的显示名称',
    email: '电子邮箱地址',
    password: '密码（至少6位字符）',
    signInBtn: '登录进入系统',
    signUpBtn: '立即注册并开始',
    googleBtn: '使用 Google 账号继续',
    or: '或使用电子邮箱继续',
    forgotPassword: '忘记密码？',
    forgotTitle: '重置您的密码',
    sendReset: '发送重置链接',
    backToLogin: '← 返回登录界面',
    resetSent: '密码重置说明已发送至您的邮箱，请注意查收。',
    signupSuccess: '注册成功！请使用您的新凭据登录。',
    securityNote: '256位 SSL 加密传输 · 绝不存储银行敏感凭据',
  },
} as const;

type AuthMode = 'login' | 'signup' | 'forgot';
type LegalType = 'privacy' | 'terms' | 'security' | null;

export function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeLegal, setActiveLegal] = useState<LegalType>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSignupTransitioning, setIsSignupTransitioning] = useState(false);

  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    requestPasswordReset,
    isLoading,
    error,
    clearError,
  } = useAuthStore();
  const { theme, toggleTheme } = useBillStore();
  const { locale } = useLocale();

  const copy =
    LANDING_COPY[locale as keyof typeof LANDING_COPY] ?? LANDING_COPY.vi;
  const isDark = theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const openAuth = (targetMode: 'login' | 'signup') => {
    setMode(targetMode);
    setShowPassword(false);
    clearError();
    setSuccessMessage('');
    setIsAuthModalOpen(true);
  };

  const handleModeChange = (next: 'login' | 'signup') => {
    setMode(next);
    setPassword('');
    setShowPassword(false);
    setSuccessMessage('');
    clearError();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    setSuccessMessage('');
    if (isLoading || isSignupTransitioning) return;
    try {
      const ok =
        mode === 'login'
          ? await signInWithEmail(email, password)
          : mode === 'signup'
          ? await signUpWithEmail(email, password, displayName)
          : await requestPasswordReset(email);
      if (!ok) return;
      if (mode === 'signup') {
        setIsSignupTransitioning(true);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
        setMode('login');
        setPassword('');
        setSuccessMessage(copy.signupSuccess);
        setIsSignupTransitioning(false);
        return;
      }
      if (mode === 'forgot') {
        setPassword('');
        setSuccessMessage(copy.resetSent);
      }
    } catch {
      setIsSignupTransitioning(false);
    }
  };

  const receiptItems = [
    { qty: 1, name: 'Pho Bo Dac Biet', price: '$16.50', tag: 'LT, MN' },
    { qty: 1, name: 'Banh Xeo Mien Tay', price: '$14.00', tag: 'SV' },
    { qty: 1, name: 'Fresh Spring Rolls (4)', price: '$12.00', tag: 'ALL' },
    { qty: 2, name: 'Iced Vietnamese Coffee', price: '$13.00', tag: 'LT, WC' },
    { qty: 1, name: 'Craft Saigon Lager', price: '$9.00', tag: 'MN, SV' },
  ];

  return (
    <div
      className={`min-h-screen transition-colors duration-200 selection:bg-[#1f543e] selection:text-white ${
        isDark ? 'bg-[#080d0b] text-zinc-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      <style>{`
        @keyframes receiptScan {
          0% { top: 4%; opacity: 0.95; }
          50% { top: 92%; opacity: 1; }
          100% { top: 4%; opacity: 0.95; }
        }
        .animate-receipt-scan {
          animation: receiptScan 3.8s ease-in-out infinite;
        }
      `}</style>

      {/* HEADER NAVIGATION */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors ${
          isDark
            ? 'border-white/10 bg-[#080d0b]/85 text-white'
            : 'border-slate-200 bg-white/85 text-slate-900'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-500/30 bg-surface shadow-sm">
              <img
                src="/logo.png"
                alt="FairShare Logo"
                className="h-full w-full object-cover scale-125"
              />
            </div>
            <span className="text-lg font-bold tracking-tight">FairShare</span>
          </div>

          <nav className="hidden items-center gap-8 text-xs font-medium text-zinc-400 md:flex">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-emerald-500 transition-colors cursor-pointer"
            >
              {copy.navHow}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-emerald-500 transition-colors cursor-pointer"
            >
              {copy.navFeatures}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('audience')}
              className="hover:text-emerald-500 transition-colors cursor-pointer"
            >
              {copy.navAudience}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="hover:text-emerald-500 transition-colors cursor-pointer"
            >
              {copy.navFaq}
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSelector />
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'border-white/10 bg-white/5 text-zinc-300 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-emerald-400" />
              ) : (
                <Moon className="h-4 w-4 text-emerald-600" />
              )}
            </button>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors hover:text-emerald-500 cursor-pointer ${
                isDark ? 'text-zinc-200' : 'text-slate-700'
              }`}
            >
              {copy.navLogin}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="rounded-xl border border-emerald-500/40 bg-[#1f543e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#25664b] active:scale-95 cursor-pointer"
            >
              {copy.navStart}
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-16 lg:pt-20 lg:pb-24 overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/4 -z-10 h-[420px] w-[550px] rounded-full bg-[#1f543e]/20 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-10 -z-10 h-[350px] w-[450px] rounded-full bg-emerald-900/15 blur-[130px]" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <div className="space-y-6 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/20 px-3.5 py-1 text-xs font-medium text-emerald-500">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>{copy.badge}</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.12]">
              {copy.heroTitle}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
              {copy.heroSub}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#1f543e] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#25664b] active:scale-95 cursor-pointer"
              >
                <ScanLine className="h-4 w-4" />
                <span>{copy.scanCta}</span>
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className={`flex items-center gap-1.5 rounded-xl border px-5 py-3 text-sm font-semibold transition-all cursor-pointer ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span>{copy.howCta}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 font-mono pt-1">
              {copy.freeTag}
            </p>
          </div>

          {/* CỘT PHẢI: HÓA ĐƠN GIẤY THỰC TẾ + TIA LASER */}
          <div className="relative mx-auto w-full max-w-lg lg:col-span-6">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl bg-[#2a211b] p-3 sm:p-4">
              <div
                className="relative overflow-hidden rounded-2xl p-6 sm:p-8 flex justify-center items-center min-h-[490px]"
                style={{
                  background:
                    'radial-gradient(circle at 50% 35%, #d8c8b4 0%, #b8a38a 60%, #968169 100%)',
                }}
              >
                <div className="pointer-events-none absolute inset-0 opacity-15 bg-[repeating-linear-gradient(90deg,transparent,transparent_18px,rgba(60,40,20,0.18)_19px,transparent_20px)]" />
                <div className="absolute top-4 left-5 z-30 flex items-center gap-1.5 rounded-full border border-zinc-300/80 bg-white/95 px-3 py-1 text-xs font-semibold text-zinc-800 shadow-md backdrop-blur-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{copy.itemsDetected}</span>
                </div>

                <div className="relative z-10 w-full max-w-[315px] -rotate-[1.2deg] bg-[#fcfbf7] text-zinc-900 shadow-[0_22px_45px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:rotate-0 overflow-hidden">
                  <div className="pointer-events-none absolute left-0 right-0 z-10 animate-receipt-scan">
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_12px_#10b981]" />
                    <div className="h-10 w-full bg-gradient-to-b from-emerald-400/20 to-transparent" />
                  </div>
                  <svg
                    className="w-full h-2.5 text-[#fcfbf7] -mt-2 block relative z-20"
                    viewBox="0 0 100 10"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      fill="currentColor"
                      points="0,10 5,0 10,10 15,0 20,10 25,0 30,10 35,0 40,10 45,0 50,10 55,0 60,10 65,0 70,10 75,0 80,10 85,0 90,10 95,0 100,10"
                    />
                  </svg>
                  <div className="px-5 pt-3 pb-5 font-mono text-[11px] leading-snug relative z-20">
                    <div className="text-center space-y-0.5 pb-3 border-b border-dashed border-zinc-400">
                      <h3 className="font-sans font-black text-base tracking-widest uppercase text-zinc-900">
                        MAMA SAIGON
                      </h3>
                      <p className="text-[10px] tracking-wide text-zinc-600">
                        KITCHEN & CRAFT BAR · DIST 1
                      </p>
                      <p className="text-[9px] text-zinc-400">
                        Tel: (028) 3824 9102 · Tax ID: 03168921
                      </p>
                      <div className="flex justify-between text-[10px] text-zinc-600 pt-2">
                        <span>TABLE: 14 (VIP)</span>
                        <span>DATE: 26/10/2026</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-600">
                        <span>SERVER: SARAH</span>
                        <span>CHK: #0112 · 19:45</span>
                      </div>
                    </div>
                    <div className="py-3 space-y-1.5">
                      {receiptItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded px-1.5 py-0.5 bg-emerald-500/[0.07] border border-emerald-600/25"
                        >
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className="font-bold text-zinc-700">{item.qty}</span>
                            <span className="truncate text-zinc-900">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="rounded bg-emerald-700/15 px-1 text-[8px] font-bold text-emerald-800">
                              {item.tag}
                            </span>
                            <span className="font-bold text-zinc-900">{item.price}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-dashed border-zinc-400 pt-2.5 space-y-1 text-[10.5px]">
                      <div className="flex justify-between text-zinc-700">
                        <span>SUBTOTAL</span>
                        <span>$64.50</span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>SALES TAX (7%)</span>
                        <span>$4.46</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs pt-1.5 mt-1 border-t border-zinc-800 text-zinc-950">
                        <span>TOTAL DUE</span>
                        <span>$68.96</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-2 border-t border-dashed border-zinc-300 flex flex-col items-center">
                      <div className="h-6 w-44 bg-[repeating-linear-gradient(90deg,#18181b,#18181b_2px,transparent_2px,transparent_4px,#18181b_4px,#18181b_5px,transparent_5px,transparent_8px)] opacity-75" />
                      <span className="mt-1 text-[8px] tracking-[0.25em] text-zinc-400">
                        *FS-2026-8849201*
                      </span>
                    </div>
                  </div>
                  <svg
                    className="w-full h-2.5 text-[#fcfbf7] -mb-2 block rotate-180 relative z-20"
                    viewBox="0 0 100 10"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      fill="currentColor"
                      points="0,10 5,0 10,10 15,0 20,10 25,0 30,10 35,0 40,10 45,0 50,10 55,0 60,10 65,0 70,10 75,0 80,10 85,0 90,10 95,0 100,10"
                    />
                  </svg>
                </div>

                <div className="absolute bottom-3 left-3 z-30 w-64 rounded-2xl border border-white/20 bg-white/95 p-3.5 text-zinc-900 shadow-[0_15px_35px_rgba(0,0,0,0.45)] backdrop-blur-md dark:border-white/15 dark:bg-[#0c1411]/95 dark:text-white">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-2 mb-2">
                    <span className="text-xs font-bold">{copy.whoPaysWhat}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {copy.taxTipIncluded}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {copy.members.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${m.color}`}
                          >
                            {m.initial}
                          </span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-200">
                            {m.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-emerald-400">
                          {m.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className={`grid grid-cols-2 gap-4 rounded-2xl border p-6 sm:grid-cols-4 ${
              isDark
                ? 'border-white/10 bg-[#0c1411]/80'
                : 'border-slate-200 bg-white shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-ink text-sm sm:text-base leading-tight break-words">{copy.stat1Val}</div>
                <div className="text-xs text-zinc-400">{copy.stat1Label}</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-ink text-sm sm:text-base leading-tight break-words">{copy.stat2Val}</div>
                <div className="text-xs text-zinc-400">{copy.stat2Label}</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Languages className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-ink text-sm sm:text-base leading-tight break-words">{copy.stat3Val}</div>
                <div className="text-xs text-zinc-400">{copy.stat3Label}</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-ink text-sm sm:text-base leading-tight break-words">{copy.stat4Val}</div>
                <div className="text-xs text-zinc-400">{copy.stat4Label}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className={`border-t py-20 scroll-mt-16 ${
          isDark ? 'border-white/10 bg-[#060a08]/70' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              {copy.howBadge}
            </h2>
            <h3 className="text-2xl font-extrabold sm:text-3xl">
              {copy.howHeading}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400">
              {copy.howSub}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div
              className={`rounded-2xl border p-6 transition-all hover:border-emerald-500/40 ${
                isDark ? 'border-white/10 bg-[#0f1715]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f543e] font-mono font-bold text-white mb-4">
                01
              </div>
              <h4 className="text-base font-bold mb-2">{copy.howStep1Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {copy.howStep1Desc}
              </p>
            </div>
            <div
              className={`rounded-2xl border p-6 transition-all hover:border-emerald-500/40 ${
                isDark ? 'border-white/10 bg-[#0f1715]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f543e] font-mono font-bold text-white mb-4">
                02
              </div>
              <h4 className="text-base font-bold mb-2">{copy.howStep2Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {copy.howStep2Desc}
              </p>
            </div>
            <div
              className={`rounded-2xl border p-6 transition-all hover:border-emerald-500/40 ${
                isDark ? 'border-white/10 bg-[#0f1715]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f543e] font-mono font-bold text-white mb-4">
                03
              </div>
              <h4 className="text-base font-bold mb-2">{copy.howStep3Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {copy.howStep3Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES (ĐÃ CẬP NHẬT HÓA ĐƠN CHẶNG & BÁO CÁO TÀI CHÍNH) */}
      <section id="features" className="py-20 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              {copy.featBadge}
            </h2>
            <h3 className="text-2xl font-extrabold sm:text-3xl">
              {copy.featHeading}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400">
              {copy.featSub}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`rounded-2xl border p-6 transition-all hover:border-emerald-500/40 ${
                isDark ? 'border-white/10 bg-[#0f1715]/70' : 'border-slate-200 bg-white'
              }`}
            >
              <Globe className="h-6 w-6 text-emerald-400 mb-3" />
              <h4 className="text-base font-bold mb-1.5">{copy.feat1Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.feat1Desc}</p>
            </div>
            <div
              className={`rounded-2xl border p-6 transition-all hover:border-emerald-500/40 ${
                isDark ? 'border-white/10 bg-[#0f1715]/70' : 'border-slate-200 bg-white'
              }`}
            >
              <Layers className="h-6 w-6 text-emerald-400 mb-3" />
              <h4 className="text-base font-bold mb-1.5">{copy.feat2Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.feat2Desc}</p>
            </div>
            <div
              className={`rounded-2xl border p-6 transition-all hover:border-emerald-500/40 ${
                isDark ? 'border-white/10 bg-[#0f1715]/70' : 'border-slate-200 bg-white'
              }`}
            >
              <PieChart className="h-6 w-6 text-emerald-400 mb-3" />
              <h4 className="text-base font-bold mb-1.5">{copy.feat3Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.feat3Desc}</p>
            </div>
            <div
              className={`rounded-2xl border p-6 transition-all hover:border-emerald-500/40 ${
                isDark ? 'border-white/10 bg-[#0f1715]/70' : 'border-slate-200 bg-white'
              }`}
            >
              <QrCode className="h-6 w-6 text-emerald-400 mb-3" />
              <h4 className="text-base font-bold mb-1.5">{copy.feat4Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.feat4Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE */}
      <section
        id="audience"
        className={`border-t py-20 scroll-mt-16 ${
          isDark ? 'border-white/10 bg-[#060a08]/80' : 'border-slate-200 bg-slate-100'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              {copy.audBadge}
            </h2>
            <h3 className="text-2xl font-extrabold sm:text-3xl">
              {copy.audHeading}
            </h3>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`rounded-2xl border p-6 text-center ${
                isDark ? 'border-white/10 bg-[#0f1715]' : 'border-slate-200 bg-white'
              }`}
            >
              <Users className="mx-auto h-7 w-7 text-emerald-400 mb-3" />
              <h4 className="font-bold text-sm mb-1.5">{copy.aud1Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.aud1Desc}</p>
            </div>
            <div
              className={`rounded-2xl border p-6 text-center ${
                isDark ? 'border-white/10 bg-[#0f1715]' : 'border-slate-200 bg-white'
              }`}
            >
              <Compass className="mx-auto h-7 w-7 text-emerald-400 mb-3" />
              <h4 className="font-bold text-sm mb-1.5">{copy.aud2Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.aud2Desc}</p>
            </div>
            <div
              className={`rounded-2xl border p-6 text-center ${
                isDark ? 'border-white/10 bg-[#0f1715]' : 'border-slate-200 bg-white'
              }`}
            >
              <Home className="mx-auto h-7 w-7 text-emerald-400 mb-3" />
              <h4 className="font-bold text-sm mb-1.5">{copy.aud3Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.aud3Desc}</p>
            </div>
            <div
              className={`rounded-2xl border p-6 text-center ${
                isDark ? 'border-white/10 bg-[#0f1715]' : 'border-slate-200 bg-white'
              }`}
            >
              <Briefcase className="mx-auto h-7 w-7 text-emerald-400 mb-3" />
              <h4 className="font-bold text-sm mb-1.5">{copy.aud4Title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{copy.aud4Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section id="faq" className="py-20 scroll-mt-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              {copy.faqBadge}
            </h2>
            <h3 className="text-2xl font-extrabold sm:text-3xl">
              {copy.faqHeading}
            </h3>
          </div>
          <div className="space-y-3">
            {copy.faqs.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all ${
                    isDark
                      ? 'border-white/10 bg-[#0c1411]/90'
                      : 'border-slate-200 bg-white shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-emerald-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs leading-relaxed text-zinc-400 border-t border-white/5 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-[#11241b] via-[#18382a] to-[#1f543e] p-8 text-center text-white shadow-2xl sm:p-12">
            <h3 className="text-2xl font-extrabold sm:text-3xl">
              {copy.ctaHeading}
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-xs sm:text-sm text-emerald-100/80">
              {copy.ctaSub}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="rounded-xl bg-white px-7 py-3 text-xs font-bold text-emerald-950 shadow-lg hover:bg-emerald-50 transition-all cursor-pointer"
              >
                {copy.ctaCreateBtn}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER (HÀI HÒA MÀU SẮC, KHÔNG GÓP Ý NHANH, ĐỔI MAIL & GIỜ PHẢN HỒI) */}
      <footer className="border-t border-emerald-950/40 bg-gradient-to-b from-[#0b1310] via-[#070c0a] to-[#040705] text-neutral-300 py-12 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            {/* Cột 1: Brand */}
            <div className="space-y-3 md:col-span-5">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-500/30 bg-surface shadow-sm">
                  <img
                    src="/logo.png"
                    alt="FairShare Logo"
                    className="h-full w-full object-cover scale-125"
                  />
                </div>
                <span className="text-base font-bold text-white">FairShare</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
                {copy.footerBrandDesc}
              </p>
              <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
                <ShieldCheck className="h-4 w-4" />
                <span>2026 - fairshare · All rights reserved</span>
              </div>
            </div>

            {/* Cột 2: Điều hướng */}
            <div className="space-y-3 md:col-span-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                {copy.footerNavTitle}
              </h4>
              <ul className="space-y-2 text-xs text-neutral-400">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {copy.navHow}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('features')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {copy.navFeatures}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('audience')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {copy.navAudience}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('faq')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {copy.navFaq}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openAuth('login')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {copy.navLogin}
                  </button>
                </li>
              </ul>
            </div>

            {/* Cột 3: Chăm sóc khách hàng */}
            <div className="space-y-3 md:col-span-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                {copy.footerSupportTitle}
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {copy.footerSupportDesc}
              </p>
              <div className="space-y-2 text-xs pt-1">
                <a
                  href={`mailto:${copy.footerSupportEmail}`}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition font-semibold"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>{copy.footerSupportEmail}</span>
                </a>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 pt-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{copy.footerSupportTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Links */}
          <div className="mt-12 flex flex-col items-center justify-between border-t border-white/5 pt-6 text-xs text-neutral-500 sm:flex-row">
            <p>© 2026 FairShare. All rights reserved.</p>
            <div className="mt-3 flex gap-6 sm:mt-0 font-medium">
              <button
                type="button"
                onClick={() => setActiveLegal('privacy')}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {copy.legalPrivacyTitle}
              </button>
              <button
                type="button"
                onClick={() => setActiveLegal('terms')}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {copy.legalTermsTitle}
              </button>
              <button
                type="button"
                onClick={() => setActiveLegal('security')}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {copy.legalSecurityTitle}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL (ĐÃ GỠ BỎ NÚT TIẾP TỤC VỚI TƯ CÁCH KHÁCH) */}
      {isAuthModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/70 animate-in fade-in duration-200"
          onClick={() => setIsAuthModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-[420px] overflow-hidden rounded-3xl border p-6 sm:p-8 transition-all ${
              isDark
                ? 'border-white/15 bg-[#0b1310]/95 text-white shadow-[0_25px_70px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.1)]'
                : 'border-slate-200 bg-white text-slate-800 shadow-2xl'
            }`}
          >
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-36 w-64 rounded-full bg-emerald-500/25 blur-3xl" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-3 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/30 bg-surface shadow-sm">
                <img
                  src="/logo.png"
                  alt="FairShare Logo"
                  className="h-full w-full object-cover scale-125"
                />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">
                {mode === 'login'
                  ? copy.welcomeBack
                  : mode === 'signup'
                  ? copy.createNew
                  : copy.forgotTitle}
              </h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-xs leading-relaxed">
                {mode === 'login'
                  ? copy.welcomeSub
                  : mode === 'signup'
                  ? copy.createSub
                  : copy.forgotSub}
              </p>
            </div>

            {mode !== 'forgot' && (
              <div
                className={`grid grid-cols-2 rounded-2xl border p-1 mb-5 ${
                  isDark ? 'border-white/10 bg-black/50' : 'border-slate-200 bg-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'border border-emerald-400/30 bg-gradient-to-r from-[#1f543e] to-[#286a4e] text-white shadow-[0_2px_12px_rgba(31,84,62,0.5)]'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {copy.loginTab}
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('signup')}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'border border-emerald-400/30 bg-gradient-to-r from-[#1f543e] to-[#286a4e] text-white shadow-[0_2px_12px_rgba(31,84,62,0.5)]'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {copy.signupTab}
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-[#14231c] p-3 text-xs text-emerald-300"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div className="relative group">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={copy.displayName}
                    className={`w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                      isDark
                        ? 'border-white/10 bg-black/40 text-white placeholder-zinc-500'
                        : 'border-slate-300 bg-slate-50 text-slate-800 placeholder-slate-400'
                    }`}
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              <div className="relative group">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.email}
                  className={`w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                    isDark
                      ? 'border-white/10 bg-black/40 text-white placeholder-zinc-500'
                      : 'border-slate-300 bg-slate-50 text-slate-800 placeholder-slate-400'
                  }`}
                  autoComplete="email"
                  required
                />
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="relative group">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={copy.password}
                      className={`w-full rounded-xl border py-2.5 pr-10 pl-10 text-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                        isDark
                          ? 'border-white/10 bg-black/40 text-white placeholder-zinc-500'
                          : 'border-slate-300 bg-slate-50 text-slate-800 placeholder-slate-400'
                      }`}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {mode === 'login' && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setPassword('');
                          setSuccessMessage('');
                          clearError();
                        }}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                      >
                        {copy.forgotPassword}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-[#1f543e] to-[#2b7254] py-3 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(31,84,62,0.45)] transition-all hover:from-[#25664b] hover:to-[#328562] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>
                      {mode === 'login'
                        ? copy.signInBtn
                        : mode === 'signup'
                        ? copy.signUpBtn
                        : copy.sendReset}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {mode === 'forgot' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setPassword('');
                  setSuccessMessage('');
                  clearError();
                }}
                className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-center text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {copy.backToLogin}
              </button>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-full border-t ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}
                  />
                  <span
                    className={`px-3 font-mono text-[10px] uppercase tracking-wider shrink-0 ${
                      isDark ? 'bg-[#0b1310] text-zinc-500' : 'bg-white text-slate-400'
                    }`}
                  >
                    {copy.or}
                  </span>
                  <div
                    className={`w-full border-t ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={isLoading}
                  className={`flex w-full items-center justify-center gap-2.5 rounded-xl border py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    isDark
                      ? 'border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>{copy.googleBtn}</span>
                </button>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>{copy.securityNote}</span>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL POPUP MODAL */}
      {activeLegal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/65 animate-in fade-in duration-200"
          onClick={() => setActiveLegal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
              isDark
                ? 'border-white/10 bg-[#0c1411] text-white'
                : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveLegal(null)}
              className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-emerald-400 mb-3">
              {activeLegal === 'privacy'
                ? copy.legalPrivacyTitle
                : activeLegal === 'terms'
                ? copy.legalTermsTitle
                : copy.legalSecurityTitle}
            </h3>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-zinc-400 pr-2">
              {activeLegal === 'privacy'
                ? copy.legalPrivacyBody
                : activeLegal === 'terms'
                ? copy.legalTermsBody
                : copy.legalSecurityBody}
            </div>
            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setActiveLegal(null)}
                className="rounded-xl bg-[#1f543e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#25664b] cursor-pointer"
              >
                {copy.legalCloseBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
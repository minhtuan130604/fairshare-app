# FairShare — Chia hóa đơn nhóm thông minh

FairShare là ứng dụng web hiện đại (React 18 + TypeScript + Tailwind CSS) giúp chia hóa đơn nhóm theo món ăn, phân bổ thuế/phí theo tỷ lệ thực tế, tối ưu hóa các khoản chuyển tiền nợ và quét hóa đơn tự động bằng AI.

Hệ thống kết nối Backend Supabase (Auth, Cloud Sync, Realtime), hỗ trợ thanh toán VietQR / СБП và giao diện đa ngôn ngữ (VI, EN, RU, ZH).

---

## Trải nghiệm trực tiếp (Live Demo)

- **Website chính thức:** [https://fairshair-app.vercel.app](https://fairshair-app.vercel.app)
- **Nền tảng hỗ trợ:** Web Responsive (Desktop, Tablet, Mobile) & Progressive Web App (PWA).

---

## Tính năng chính

- **Chia hóa đơn theo món:** Chọn từng thành viên chia từng món ăn cụ thể thay vì chia cào bằng.
- **Tính thuế & phí theo tỷ lệ:** Phân bổ VAT, phí dịch vụ và giảm giá chính xác theo số tiền thực tế mỗi người sử dụng.
- **Đa tiền tệ:** Hỗ trợ linh hoạt 4 đơn vị tiền tệ chính: `VND (₫)`, `RUB (₽)`.
- **Tối ưu thanh toán nợ:** Thuật toán giải quyết nợ chéo giúp tối thiểu hóa số lần chuyển tiền và tạo mã thanh toán nhanh qua **VietQR** (Việt Nam) hoặc **СБП** (Nga).
- **Quét hóa đơn bằng AI:** Tự động nhận diện tên món, đơn giá và tổng hóa đơn qua **Google Gemini Vision API** (kèm chế độ dự phòng **OCR cục bộ Tesseract.js** khi ngoại tuyến).
- **Đồng bộ thời gian thực:** Đăng nhập an toàn qua **Google OAuth**, lưu trữ đám mây và đồng bộ tức thì trên nhiều thiết bị với **Supabase**.
- **Nhóm hóa đơn (Timeline Trips):** Quản lý chi phí tập trung cho các chuyến du lịch, sự kiện nhiều ngày theo dòng thời gian.
- **Trang Quản trị & Thông báo hệ thống:** Theo dõi KPI vận hành, gửi broadcast thông báo toàn cục dạng popup modal đa ngôn ngữ tức thì.
- **PWA & Giao diện hiện đại:** Hỗ trợ Dark/Light mode, khả năng cài đặt ứng dụng về màn hình chính điện thoại (PWA) với logo nhận diện thương hiệu sắc nét.

---

## Cấu hình môi trường (`.env`)

Sao chép file cấu hình mẫu:

```bash
# Trên Windows CMD
copy .env.example .env

# Trên PowerShell / Linux / macOS
cp .env.example .env
Điền các biến môi trường vào file .env:

Фрагмент кода
# Google Gemini Vision API (Dùng cho AI OCR)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Backend (Auth, Database & Realtime)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
Lưu ý bảo mật: Không commit file .env chứa khóa thật lên các kho lưu trữ công khai. Đối với các biến môi trường khi triển khai trên Vercel / Netlify, hãy thiết lập trực tiếp trong mục Settings -> Environment Variables.

Cài đặt và Khởi chạy
Yêu cầu môi trường đã cài đặt Node.js (khuyến nghị phiên bản 18 trở lên).

Bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi chạy máy chủ phát triển (Development)
npm run dev

# 3. Kiểm tra mã nguồn và build phát hành (Production Build)
npm test
npm run build
Cấu trúc thư mục
Plaintext
fairshare-app/
├── public/                     # Tài nguyên tĩnh: logo.png, favicon.svg, manifest.webmanifest
├── src/
│   ├── components/             # Các khối UI tái sử dụng
│   │   ├── analytics/          # Biểu đồ và phân tích chi tiêu
│   │   ├── auth/               # Modal đăng nhập, Landing page giới thiệu
│   │   ├── bill/               # Danh mục chi tiêu, chi tiết hóa đơn
│   │   ├── items/              # Quản lý danh sách món, form thêm nhanh, timeline
│   │   ├── layout/             # Header, Footer, Điều khiển hóa đơn, Modal thông báo toàn cục
│   │   ├── members/            # Quản lý thành viên trong nhóm
│   │   ├── profile/            # Trang cá nhân và cài đặt người dùng
│   │   └── summary/            # Dòng tiền trả nợ, Live Receipt, xuất hóa đơn
│   ├── hooks/                  # Custom React hooks (useLocale, useAutoSaveBill,...)
│   ├── pages/                  # Các trang chính (App, HistoryPage, AdminPage)
│   ├── store/                  # Quản lý State toàn cục bằng Zustand (Auth, Bill, Notification, Profile)
│   ├── types/                  # Định nghĩa TypeScript data models
│   └── utils/                  # Thuật toán tính nợ, OCR, định dạng tiền tệ
├── index.html                  # File HTML chính, cấu hình SEO & App Icons
├── package.json                # Dependencies và scripts
├── supabase_schema.sql         # SQL schema, RLS Policies và Triggers Supabase
└── vite.config.ts              # Cấu hình Vite & PWA
Bản quyền
Phát triển bởi đội ngũ FairShare © 2026. Mọi quyền được bảo lưu.
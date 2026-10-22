# FairShare — Tóm tắt dự án

## Mục tiêu
Ứng dụng web giúp nhóm chia hóa đơn theo từng món, phân chia thuế/phí theo tỷ lệ và xác định các khoản cần chuyển để cân bằng số tiền đã ứng.

## Công nghệ
- React, TypeScript, Vite
- Zustand và localStorage cho trạng thái ứng dụng
- Tailwind CSS, Framer Motion, Lucide React
- Gemini Vision là bước nhận diện mặc định; Tesseract.js chỉ chạy khi người dùng chủ động chọn OCR cục bộ dự phòng

## Các phần chính
- `src/components/layout`: đầu trang, thiết lập hóa đơn, điều hướng và chọn ngôn ngữ.
- `src/components/members`: quản lý thành viên và người đã ứng tiền.
- `src/components/items`: nhập món, phân công thành viên và quét hóa đơn.
- `src/components/summary`: tổng tiền, thanh toán, chia sẻ và xuất PNG.
- `src/hooks/useLocale.tsx`: bốn ngôn ngữ giao diện (vi/en/ru/zh).
- `src/store/useBillStore.ts`: trạng thái và thao tác hóa đơn.
- `src/utils/calculations.ts`: phép tính chia tiền và tối ưu thanh toán.
- `src/utils/ocr.ts`, `src/utils/receiptParser.ts`: OCR và phân tích dữ liệu hóa đơn.

## Chạy và kiểm tra
```bash
npm install
npm run dev
npm test
npm run build
```

Gemini Vision được ưu tiên để nhận diện hóa đơn; khi thiếu khóa hoặc API lỗi, giao diện báo lỗi rõ ràng và không tự động chấp nhận kết quả Tesseract. Người dùng có thể chủ động chọn OCR cục bộ dự phòng. Khóa `VITE_GEMINI_API_KEY` nằm trong `.env`; giữ file này kín vì biến `VITE_` được đưa vào bundle trình duyệt.

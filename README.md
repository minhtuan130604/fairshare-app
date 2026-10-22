# FairShare — Chia hóa đơn nhóm

FairShare là ứng dụng web React + TypeScript để chia hóa đơn theo món, tính thuế/phí, tối ưu các khoản chuyển tiền và xuất bản tóm tắt để chia sẻ.

## Tính năng chính

- Thêm thành viên, món ăn, số lượng và người cùng chia từng món.
- Chia thuế/phí theo tỷ lệ, hỗ trợ VND, RUB, USD và EUR.
- Tính các khoản chuyển tiền giữa thành viên và đánh dấu đã thanh toán.
- Giao diện sáng/tối, lưu trạng thái trong trình duyệt.
- Chuyển ngôn ngữ giao diện: Tiếng Việt, English, Русский và 中文.
- Quét ảnh hóa đơn để gợi ý tên món, số lượng, đơn giá và tổng tiền; người dùng có thể rà soát trước khi thêm.
- Chia sẻ hóa đơn bằng URL, sao chép nội dung hoặc xuất ảnh PNG.

## Chạy ứng dụng

Cần Node.js tương thích với phiên bản Vite trong `package.json`.

```bash
npm install
npm run dev
```

Kiểm tra mã và build bản phát hành:

```bash
npm test
npm run build
```

## Quét hóa đơn và cấu hình AI

Gemini Vision là công cụ nhận diện mặc định để đọc tên món, số lượng, đơn giá và tổng tiền. Khóa API được đọc từ `.env` ở thư mục dự án:

Trên Windows CMD, chạy lệnh sau trong thư mục dự án:

```bat
copy .env.example .env
```

Sau đó mở `.env`, thêm hoặc thay dòng bằng khóa API mới của bạn:

```dotenv
VITE_GEMINI_API_KEY=PASTE_YOUR_NEW_KEY_HERE
```

Trước khi chạy, hãy điền khóa mới của bạn vào `.env`. Không chia sẻ file `.env`. Nếu thiếu khóa hoặc Gemini báo lỗi, ứng dụng sẽ hiển thị lỗi thay vì âm thầm chấp nhận kết quả OCR kém chính xác. Với lỗi tạm thời như HTTP 503/429, ứng dụng tự thử lại có thời gian chờ tăng dần, sau đó thử model Gemini Flash ổn định khác. Tại màn hình lỗi, người dùng vẫn có thể chủ động chọn **OCR cục bộ**; kết quả sẽ được đánh dấu rõ là dùng Tesseract.

**Lưu ý bảo mật:** biến có tiền tố `VITE_` được đưa vào bundle phía trình duyệt. ZIP không chứa file `.env` hay khóa API. Vì khóa phía trình duyệt có thể bị người dùng cuối xem được khi chạy ứng dụng, không dùng cách này cho một ứng dụng công khai; hãy hạn chế khóa theo API/referrer và quota hoặc chuyển lệnh gọi Gemini qua backend.

## Cấu trúc

```text
fairshair-app/
├── public/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── store/
│   ├── types/
│   └── utils/
├── .env.example
├── index.html
├── package.json
└── ...các cấu hình TypeScript/Vite
```

`node_modules` và bản build `dist` không được đóng gói; cài thư viện bằng `npm install` trên máy cần chạy ứng dụng. File `.env` trong gói này chứa cấu hình riêng và phải được giữ kín.

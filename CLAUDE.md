# UI & Design System Guidelines for Claude Code

## Tech Stack & Styling Rules
- Framework: React 18 + Vite + TypeScript + Tailwind CSS.
- Icons: Dùng exclusively từ `lucide-react`.
- Design Philosophy: Phong cách FinTech Minimalist (cảm hứng từ Linear / Raycast / Stripe).

## Critical Safety Constraints
- KHÔNG BAO GIỜ xóa, đổi tên hoặc sửa đổi logic bên trong các store (`useBillStore`, `useAuthStore`, `useLocale`).
- KHÔNG BAO GIỜ tự ý thay đổi file cấu hình gốc (`vite.config.ts`, `tailwind.config.js`, `.env`).
- Luôn giữ nguyên các prop interfaces (`LandingPageProps`, các callbacks `onStartScan`, `onContinueAsGuest`).
- Khi sửa component, chỉ tinh chỉnh cấu trúc JSX và class Tailwind CSS, bảo toàn toàn bộ logic `useEffect`, state, handler functions.

## Visual Standards
- Border: Ưu tiên border mảnh 1px (`border-slate-200 dark:border-slate-800`), bo góc hiện đại (`rounded-2xl`, `rounded-3xl`).
- Shadows: Tránh shadow đậm. Dùng `shadow-sm`, `shadow-md` hoặc `backdrop-blur-md` tinh tế.
- Brand Color: Tone chủ đạo Pine Green (`#1f543e`, `hover:bg-[#184332]`).
- Numbers: Số tiền và định lượng luôn kèm class `font-mono tabular-nums`.

## UI/UX Design System Rules
- Theme: Dark FinTech Minimalist (#0a0e0d base, #1f543e primary accent).
- Borders: Always 1px sharp borders (`border-white/10` with hover `border-emerald-500/30`).
- Corners: Consistently use `rounded-2xl` for cards and `rounded-xl` for controls/inputs.
- Cards: Bento-grid style with subtle inner shadows (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]`) and glassmorphism backdrop blur.
- Never use flat dull gray backgrounds or plain box borders.
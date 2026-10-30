-- Bảng lưu trữ hóa đơn (Bills)
CREATE TABLE IF NOT EXISTS public.bills (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Chính sách RLS: Chỉ cho phép chủ sở hữu truy cập
CREATE POLICY "Người dùng chỉ có thể quản lý hóa đơn của chính mình" ON public.bills
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bảng quan hệ bạn bè (Friends)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Người dùng có thể xem quan hệ bạn bè của mình" ON public.friendships
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Người dùng có thể tạo lời mời kết bạn" ON public.friendships
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Người dùng có thể cập nhật trạng thái quan hệ" ON public.friendships
  FOR UPDATE
  USING (auth.uid() = friend_id);

-- Bảng chia sẻ hóa đơn (Bill Shares)
CREATE TABLE IF NOT EXISTS public.bill_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id TEXT NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bill_id, receiver_id)
);

ALTER TABLE public.bill_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Người gửi có thể xem hóa đơn mình đã chia sẻ" ON public.bill_shares
  FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Người nhận có thể xem hóa đơn được chia sẻ cho mình" ON public.bill_shares
  FOR SELECT
  USING (auth.uid() = receiver_id);

CREATE POLICY "Người dùng có thể chia sẻ hóa đơn" ON public.bill_shares
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Người nhận có thể cập nhật xác nhận hóa đơn" ON public.bills
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.bill_shares
      WHERE bill_shares.bill_id = bills.id
        AND bill_shares.receiver_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.bill_shares
      WHERE bill_shares.bill_id = bills.id
        AND bill_shares.receiver_id = auth.uid()
    )
  );

-- Trigger tự động cập nhật updated_at cho bills
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_updated_at_column();

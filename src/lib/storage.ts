import { supabase } from './supabase';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

/** Upload ảnh hồ sơ/QR lên bucket public avatars và trả về public URL. */
export async function uploadProfileImage(file: File, path: string): Promise<string | null> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.');
  if (!file.type.startsWith('image/')) throw new Error('Vui lòng chọn một tệp ảnh hợp lệ.');
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Kích thước ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.');

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) throw new Error('Vui lòng đăng nhập để tải ảnh lên.');

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    file.type.split('/')[1]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const safePath = path.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const filePath = `${userId}/${safePath}_${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl || null;
}

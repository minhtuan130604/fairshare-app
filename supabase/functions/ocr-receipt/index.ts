// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';



const MAX_BASE64_IMAGE_LENGTH = 7 * 1024 * 1024;
// @ts-nocheck
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b';

const RECEIPT_OCR_PROMPT = `
Bạn là hệ thống đọc hóa đơn đa năng. Đọc ảnh hóa đơn và trả về DUY NHẤT một JSON hợp lệ theo cấu trúc:
{
  "language": "vi",
  "title": "Tên cửa hàng/nhà hàng/dịch vụ",
  "category": "dining",
  "items": [
    { "name": "Ốc Hương", "quantity": 3, "price": 720000 }
  ],
  "detectedTotal": 2160000
}

Quy tắc bắt buộc:
0. Mỗi dòng món ăn (line items) phải giữ nguyên đơn giá và thành tiền thập phân chính xác, không được làm tròn từng món (ví dụ: 79.99, 69.99). Tuyệt đối KHÔNG làm tròn hoặc cắt bỏ phần thập phân của bất kỳ số tiền nào. Chép chính xác đơn giá và tổng tiền như trên hóa đơn; ví dụ 29.99 phải trả về 29.99, 54.99 phải trả về 54.99. Dùng dấu chấm làm dấu thập phân trong JSON. Phân biệt dấu phân cách hàng nghìn và dấu thập phân theo định dạng/ngữ cảnh hóa đơn (bao gồm RUB).
1. language chỉ là "vi", "en", "ru" hoặc "zh", tùy ngôn ngữ trên hóa đơn.
2. title là tên thương hiệu/nhà hàng/siêu thị/quán in trên đầu hóa đơn (Ví dụ: "Haidilao Hotpot", "WinMart", "Lotte Cinema"). Nếu không rõ, để trống "".
3. category bắt buộc chọn đúng 1 trong các giá trị sau dựa vào ngữ cảnh:
   - "dining": Quán ăn, nhà hàng, cafe, đồ uống, lẩu, nướng, bia, trà sữa, thức ăn nhanh.
   - "shopping": Siêu thị, cửa hàng tiện lợi, quần áo, mỹ phẩm, đồ gia dụng, tạp hóa.
   - "transport": Taxi, Grab, Yandex Go, xăng dầu, vé máy bay, vé tàu xe.
   - "entertainment": Vé xem phim, karaoke, bida, bowling, khu vui chơi, quán bar/pub.
   - "travel": Khách sạn, homestay, resort, tour du lịch, vé cáp treo/tham quan.
   - "other": Hóa đơn chi phí khác.
4. name là tên hàng hóa/món ăn. Giữ nguyên thông tin định lượng/đơn vị nếu hóa đơn có khối lượng hoặc thể tích (kg, g, l, ml), đặt trong tên món, ví dụ "Thịt ba chỉ (0.85 kg)" hoặc "Nước giặt 1.5L". Chỉ bỏ số thứ tự; không xóa định lượng có ý nghĩa.
5. quantity là số lượng dòng hàng. Giữ số thập phân nếu có (ví dụ 1.5 hoặc 0.8). Nếu không có, đặt là 1.
6. price là đơn giá của một đơn vị/số lượng ghi trên dòng, KHÔNG lấy tổng tiền dòng nếu có đơn giá riêng.
7. detectedTotal là tổng số tiền thanh toán cuối cùng thực tế của hóa đơn, sau khi cộng thuế/phí và trừ chiết khấu. Nếu không đọc được, trả về null.
8. Kiểm tra kỹ mọi dòng VAT/НДС/tax, phí phục vụ/service charge, phụ phí và discount/скидка. Không đưa các dòng này vào items. Đối chiếu subtotal + thuế + phí - chiết khấu với detectedTotal; nếu không có trường riêng để trả về, hãy phản ánh đúng các khoản này trong detectedTotal và không làm lệch tổng so với các món lẻ.
9. Bỏ qua tiền khách đưa, tiền thừa, phương thức thanh toán, mã giao dịch và các dòng không phải hàng hóa/dịch vụ.
10. Dữ liệu số (quantity, price, detectedTotal) phải là kiểu number trong JSON, không kèm chữ hay ký hiệu tiền tệ.
11. Chỉ trả về JSON thuần theo cấu trúc trên, không bọc trong markdown code fence, không thêm lời giải thích hoặc văn bản bên ngoài JSON.
`.trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dùng Deno.serve chuẩn của Supabase Edge Functions
Deno.serve(async (req: Request) => {
  // Xử lý CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  let user;
  try {
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    user = userData.user;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('ocr_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneDayAgo);

    if (countError) {
      return new Response(JSON.stringify({ error: 'OCR_USAGE_CHECK_FAILED' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((count ?? 0) >= 20) {
      return new Response(JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Bạn đã vượt quá giới hạn quét hóa đơn (tối đa 20 lượt/ngày).',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'MISSING_SERVER_GROQ_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { base64Image } = await req.json();
    if (typeof base64Image !== 'string' || base64Image.length === 0 || base64Image.length > MAX_BASE64_IMAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'PAYLOAD_TOO_LARGE' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const groqResponse = await fetch(GROQ_API_URL, {
      signal: AbortSignal.timeout(35_000),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: RECEIPT_OCR_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
            ],
          },
        ],
      }),
    });

    const data = await groqResponse.json();
    if (groqResponse.ok && data?.choices?.[0]?.message?.content) {
      const { error: usageError } = await supabase
        .from('ocr_usage')
        .insert({ user_id: user.id });

      if (usageError) {
        console.error('Failed to record OCR usage:', usageError);
      }
    }

    return new Response(JSON.stringify(data), {
      status: groqResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
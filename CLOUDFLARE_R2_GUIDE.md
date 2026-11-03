# 🚀 Hướng Dẫn Thiết Lập Cloudflare R2 Storage (Gói R2 Paid)

Tài liệu này hướng dẫn chi tiết từng bước kết nối ứng dụng **Cloudflare Drive Mini** với dịch vụ lưu trữ **Cloudflare R2** của bạn.

---

## 🛡️ Cơ Chế Khóa An Toàn Chống Trừ Tiền Thẻ Ngân Hàng (100% Free)
Để bạn hoàn toàn an tâm sử dụng và **tuyệt đối không bao giờ bị Cloudflare trừ tiền vào thẻ tín dụng**:
- Ứng dụng đã được tích hợp **Chốt chặn Server-side Hard-Cap**: Khóa cứng hạn mức lưu trữ tối đa ở mốc **10 GB miễn phí** đi kèm gói R2 Paid.
- **Server Guard (`/api/upload`)**: Kiểm tra kích thước file trước khi lưu. Nếu file mới làm dung lượng đạt hoặc vượt 10 GB, server lập tức chặn và trả về lỗi 403 từ chối upload.
- **Client Guard (`useFileUploadValidation`)**: Báo đỏ và vô hiệu hóa nút upload khi dung lượng chạm 10 GB.
- **$0 Phí Băng Thông (Zero Egress Fees)**: Bạn xem trước phim, ảnh, nghe nhạc hoặc tải file bao nhiêu lần cũng không tốn 1 đồng nào.
- Kết quả: **Chi phí thẻ ngân hàng của bạn luôn được giữ ở mức $0.00!**

---

## 🛠️ 4 Bước Cấu Hình Nhanh

### Bước 1: Lấy Cloudflare Account ID
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Nhìn lên thanh địa chỉ trình duyệt (URL), bạn sẽ thấy Account ID dạng chuỗi 32 ký tự:
   ```text
   https://dash.cloudflare.com/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/...
   ```
   Hoặc truy cập trang chủ tài khoản, cột bên phải sẽ hiển thị dòng **Account ID**.
3. Sao chép chuỗi này và điền vào biến `CLOUDFLARE_ACCOUNT_ID` trong `.env.local`.

---

### Bước 2: Tạo R2 API Token (Access Key & Secret Key)
1. Ở menu bên trái Cloudflare Dashboard, chọn **Storage & databases** > **R2**.
2. Nhấn vào nút **Manage R2 API Tokens** (nằm ở góc trên bên phải trang R2 Overview).
3. Nhấn **Create API token**:
   - **Token name**: Đặt tên gợi nhớ (ví dụ: `drive-mini-token`).
   - **Permissions**: Chọn **Admin Read & Write** (hoặc *Object Read & Write*).
   - **Specify bucket(s)**: Chọn *All buckets* hoặc chọn riêng bucket của bạn.
   - **TTL**: Đặt ngày hết hạn hoặc để vô hạn.
4. Nhấn **Create API Token**.
5. Màn hình sẽ hiển thị 2 thông số (chỉ hiển thị 1 lần duy nhất, hãy lưu lại):
   - **Access Key ID** ➔ Điền vào `R2_ACCESS_KEY_ID`
   - **Secret Access Key** ➔ Điền vào `R2_SECRET_ACCESS_KEY`

---

### Bước 3: Tạo Bucket Lưu Trữ Trên R2
1. Trở lại trang **R2 Overview**, nhấn **Create bucket**.
2. Đặt tên Bucket (ví dụ: `google-drive-mini` hoặc `cloud-drive-mini`).
   *(Lưu ý: Tên bucket viết thường, không dấu, dùng dấu gạch ngang).*
3. Mục **Location Hint**: Để **Automatic** (Cloudflare sẽ tự động định vị tối ưu theo địa lý).
4. Nhấn **Create bucket**. Điền tên bucket này vào `R2_BUCKET_NAME` trong `.env.local`.

---

### Bước 4: Cấu hình CORS cho Bucket (Rất Quan Trọng)
Để ứng dụng có thể tải file lên và xem trước mượt mà không bị trình duyệt chặn:
1. Vào bên trong bucket bạn vừa tạo > chọn tab **Settings**.
2. Cuộn xuống phần **CORS Policy** > nhấn **Add CORS policy** (hoặc Edit).
3. Dán đoạn JSON cấu hình chuẩn sau đây:
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://*.vercel.app",
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Type",
      "Content-Length"
    ],
    "MaxAgeSeconds": 3600
  }
]
```
4. Nhấn **Save**.

---

### (Tùy chọn) Bật Public Domain hoặc R2 Dev URL
Nếu bạn muốn link tải file trực tiếp với tốc độ CDN toàn cầu của Cloudflare:
1. Trong tab **Settings** của Bucket > cuộn đến mục **Public Access**.
2. Nhấn **Connect Domain** (nếu bạn có tên miền riêng trên Cloudflare) hoặc bật **R2.dev subdomain**.
3. Sao chép URL đó (ví dụ: `https://pub-xxxxxxxxxx.r2.dev`) và dán vào `R2_PUBLIC_DOMAIN` trong `.env.local`.
*(Nếu để trống, hệ thống sẽ tự động stream file qua API Next.js `/api/files/download` an toàn và bảo mật).*

---

## 📝 Mẫu Tệp Tin `.env.local` Hoàn Chỉnh

Hãy mở tệp [`.env.local`](file:///I:\DATA\NEXTJS\storage\google-drive-mini/.env.local) và điền các thông tin của bạn:

```env
# ===================================================
# CẤU HÌNH CLOUDFLARE R2 STORAGE (PAID PLAN)
# ===================================================

# 1. Cloudflare Account ID
CLOUDFLARE_ACCOUNT_ID=dán_account_id_của_bạn_vào_đây

# 2. R2 API Tokens
R2_ACCESS_KEY_ID=dán_access_key_id_vào_đây
R2_SECRET_ACCESS_KEY=dán_secret_access_key_vào_đây

# 3. Tên Bucket trên Cloudflare R2
R2_BUCKET_NAME=google-drive-mini

# 4. Gói R2: 'paid' (Gói R2 Paid - Không giới hạn cứng dung lượng) hoặc 'free'
R2_PLAN_TYPE=paid

# 5. Định mức hiển thị trên thanh tiến trình UI (GB) - Tùy chọn, mặc định 100 GB
R2_MAX_QUOTA_GB=100

# 6. Public Domain / R2 Dev URL (Tùy chọn, để trống nếu dùng API stream nội bộ)
R2_PUBLIC_DOMAIN=
```

---

## 🚀 Khởi Chạy Ứng Dụng
Sau khi lưu file `.env.local`:
```bash
npm run dev
```
Mở trình duyệt tại [http://localhost:3000](http://localhost:3000) để trải nghiệm kho lưu trữ đám mây Cloudflare R2 tốc độ cao!

# Hướng dẫn cấu hình CORS cho Firebase Storage

## Vấn đề
Khi mở file .doc/.docx để chỉnh sửa, bạn gặp lỗi "Failed to fetch" do CORS policy.

## Giải pháp

### Cách 1: Sử dụng Firebase Console (Khuyến nghị)

1. Mở [Firebase Console](https://console.firebase.google.com/)
2. Chọn project của bạn
3. Vào **Storage** → **Files**
4. Click vào **Rules** tab
5. Thêm rule cho phép đọc file:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;  // Cho phép đọc tất cả file
      allow write: if request.auth != null;  // Chỉ cho phép ghi nếu đã đăng nhập
    }
  }
}
```

### Cách 2: Sử dụng gsutil CLI

1. **Cài đặt Google Cloud SDK** (nếu chưa có):
   - Windows: https://cloud.google.com/sdk/docs/install
   - Mac/Linux: `curl https://sdk.cloud.google.com | bash`

2. **Xác thực**:
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

3. **Áp dụng CORS configuration**:
```bash
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

Thay `YOUR_BUCKET_NAME` bằng tên bucket của bạn (thường là `your-project-id.appspot.com`)

4. **Kiểm tra CORS đã được áp dụng**:
```bash
gsutil cors get gs://YOUR_BUCKET_NAME
```

### Cách 3: Sử dụng Firebase Storage REST API

Nếu bạn không thể dùng gsutil, có thể set CORS qua REST API:

```bash
curl -X PUT \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d @cors.json \
  "https://storage.googleapis.com/storage/v1/b/YOUR_BUCKET_NAME"
```

## File cors.json mẫu

File `cors.json` đã được tạo sẵn trong thư mục gốc của project:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"]
  }
]
```

**Lưu ý**: `"origin": ["*"]` cho phép tất cả domain. Trong production, nên giới hạn:
```json
"origin": ["https://yourdomain.com", "https://www.yourdomain.com"]
```

## Kiểm tra sau khi cấu hình

1. Mở Chrome DevTools (F12) → Console
2. Thử mở file .doc/.docx để edit
3. Kiểm tra logs - không còn lỗi CORS
4. File sẽ load thành công vào editor

## Troubleshooting

### Vẫn bị lỗi sau khi cấu hình CORS?

1. **Clear browser cache**: Ctrl+Shift+Delete
2. **Hard reload**: Ctrl+Shift+R (hoặc Cmd+Shift+R trên Mac)
3. **Đợi 5-10 phút** để CORS settings propagate
4. **Kiểm tra bucket name**: Đảm bảo dùng đúng tên bucket
5. **Check Firebase Storage Rules**: Đảm bảo rule cho phép read

### Lỗi "Permission denied"?

Kiểm tra Storage Rules - cần có rule:
```
allow read: if true;
```

### Không có quyền gsutil?

Yêu cầu Owner hoặc Editor role trong Firebase project.

## Tài liệu tham khảo

- [Firebase Storage CORS](https://firebase.google.com/docs/storage/web/download-files#cors_configuration)
- [Google Cloud Storage CORS](https://cloud.google.com/storage/docs/configuring-cors)
- [gsutil cors command](https://cloud.google.com/storage/docs/gsutil/commands/cors)

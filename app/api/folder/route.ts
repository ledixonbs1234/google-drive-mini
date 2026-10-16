import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME, isR2Configured } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return NextResponse.json(
        { error: 'Cloudflare R2 chưa được cấu hình' },
        { status: 400 }
      );
    }

    const body = await request.json();
    let folderPath = body.path as string;

    if (!folderPath) {
      return NextResponse.json({ error: 'Thiếu đường dẫn thư mục' }, { status: 400 });
    }

    // Chuẩn hóa path
    folderPath = folderPath.replace(/^\//, '');
    if (!folderPath.endsWith('/')) {
      folderPath = `${folderPath}/`;
    }

    const key = folderPath.startsWith('uploads/') ? `${folderPath}.keep` : `uploads/${folderPath}.keep`;

    // Tạo file marker .keep với Body rỗng
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(''),
        ContentType: 'application/x-directory',
      })
    );

    return NextResponse.json({
      success: true,
      folderPath,
      key,
    });
  } catch (error: any) {
    console.error('Lỗi khi tạo thư mục trên Cloudflare R2:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi tạo thư mục' },
      { status: 500 }
    );
  }
}

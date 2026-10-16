import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME, isR2Configured } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return new NextResponse('Cloudflare R2 chưa được cấu hình', { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return new NextResponse('Thiếu tham số key', { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
      return new NextResponse('Không tìm thấy nội dung file', { status: 404 });
    }

    // Biến đổi stream sang Web ReadableStream
    const stream = response.Body.transformToWebStream();

    const headers = new Headers();
    if (response.ContentType) {
      headers.set('Content-Type', response.ContentType);
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }

    if (response.ContentLength) {
      headers.set('Content-Length', response.ContentLength.toString());
    }

    // Hỗ trợ browser caching
    headers.set('Cache-Control', 'public, max-age=3600');

    // Xác định tên file để đặt Content-Disposition
    const fileName = key.split('/').pop() || 'file';
    const isInline = /\.(jpg|jpeg|png|gif|webp|svg|pdf|txt|mp4|webm|mp3)$/i.test(fileName);
    const disposition = isInline ? 'inline' : `attachment; filename="${encodeURIComponent(fileName)}"`;
    headers.set('Content-Disposition', disposition);

    return new NextResponse(stream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Lỗi download file từ Cloudflare R2:', error);
    return new NextResponse(error.message || 'Lỗi tải file', { status: 500 });
  }
}

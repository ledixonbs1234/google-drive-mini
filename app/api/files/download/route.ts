import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME, isR2Configured, isValidUserStorageKey } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return new NextResponse('Cloudflare R2 chưa được cấu hình', { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const forceDownload = searchParams.get('download') === '1';

    if (!key || !isValidUserStorageKey(key)) {
      return new NextResponse('Tham số key không hợp lệ', { status: 400 });
    }

    const rangeHeader = request.headers.get('range') || undefined;

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Range: rangeHeader,
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
      return new NextResponse('Không tìm thấy nội dung file', { status: 404 });
    }

    const stream = response.Body.transformToWebStream();

    const headers = new Headers();
    headers.set('Accept-Ranges', 'bytes');

    if (response.ContentType) {
      headers.set('Content-Type', response.ContentType);
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }

    if (response.ContentLength !== undefined) {
      headers.set('Content-Length', response.ContentLength.toString());
    }

    if (response.ContentRange) {
      headers.set('Content-Range', response.ContentRange);
    }

    if (response.ETag) {
      headers.set('ETag', response.ETag);
    }

    headers.set('Cache-Control', 'public, max-age=3600');

    const fileName = key.split('/').pop() || 'file';
    const isInline = !forceDownload && /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|pdf|txt|md|json|csv|xml|html|mp4|webm|ogg|mov|mp3|wav|m4a|flac)$/i.test(fileName);
    const encodedFileName = encodeURIComponent(fileName);
    const disposition = isInline
      ? `inline; filename*=UTF-8''${encodedFileName}`
      : `attachment; filename*=UTF-8''${encodedFileName}`;
    headers.set('Content-Disposition', disposition);

    return new NextResponse(stream, {
      status: rangeHeader && response.ContentRange ? 206 : 200,
      headers,
    });
  } catch (error: any) {
    console.error('Lỗi download file từ Cloudflare R2:', error);
    return new NextResponse(error.message || 'Lỗi tải file', { status: 500 });
  }
}

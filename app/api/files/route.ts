import { NextRequest, NextResponse } from 'next/server';
import {
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME, isR2Configured, getFileUrl } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

export interface StorageItemDto {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string;
  size?: number;
  updated?: string;
}

export async function GET(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return NextResponse.json(
        {
          error: 'Cloudflare R2 chưa được cấu hình. Vui lòng thiết lập biến môi trường trong .env.local',
          items: [],
          configured: false,
        },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(request.url);
    let currentPath = searchParams.get('currentPath') || '';
    const searchTerm = (searchParams.get('search') || '').trim().toLowerCase();

    // Chuẩn hóa path: đảm bảo bắt đầu từ uploads/
    if (currentPath.startsWith('/')) currentPath = currentPath.slice(1);
    const prefix = currentPath ? `uploads/${currentPath}` : 'uploads/';

    // Trường hợp 1: TÌM KIẾM TOÀN BỘ (không dùng Delimiter để quét toàn bộ subfolder)
    if (searchTerm) {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: 'uploads/',
        MaxKeys: 1000,
      });

      const response = await r2Client.send(command);
      const objects = response.Contents || [];

      const results: StorageItemDto[] = [];
      const foundFolders = new Set<string>();

      for (const obj of objects) {
        if (!obj.Key || obj.Key.endsWith('.keep')) continue;

        const relativeKey = obj.Key.replace(/^uploads\//, '');
        const segments = relativeKey.split('/');
        const fileName = segments[segments.length - 1];

        // Kiểm tra tên thư mục cha
        for (let i = 0; i < segments.length - 1; i++) {
          const folderName = segments[i];
          const folderFullPath = 'uploads/' + segments.slice(0, i + 1).join('/') + '/';
          if (folderName.toLowerCase().includes(searchTerm) && !foundFolders.has(folderFullPath)) {
            foundFolders.add(folderFullPath);
            results.push({
              name: folderName,
              fullPath: folderFullPath,
              isFolder: true,
            });
          }
        }

        // Kiểm tra tên file
        if (fileName && fileName.toLowerCase().includes(searchTerm)) {
          results.push({
            name: fileName,
            fullPath: obj.Key,
            isFolder: false,
            url: getFileUrl(obj.Key),
            size: obj.Size,
            updated: obj.LastModified?.toISOString(),
          });
        }
      }

      return NextResponse.json({ items: results, configured: true });
    }

    // Trường hợp 2: LẤY DANH SÁCH THƯ MỤC HIỆN TẠI (Dùng Delimiter '/')
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      Delimiter: '/',
    });

    const response = await r2Client.send(command);
    const items: StorageItemDto[] = [];

    // 1. Thư mục con (CommonPrefixes)
    if (response.CommonPrefixes) {
      for (const cp of response.CommonPrefixes) {
        if (!cp.Prefix) continue;
        const cleanPrefix = cp.Prefix.endsWith('/') ? cp.Prefix.slice(0, -1) : cp.Prefix;
        const folderName = cleanPrefix.split('/').pop() || '';
        if (folderName) {
          items.push({
            name: folderName,
            fullPath: cp.Prefix,
            isFolder: true,
          });
        }
      }
    }

    // 2. Files trong thư mục hiện tại (Contents)
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key) continue;
        // Bỏ qua chính prefix hoặc các file ẩn .keep
        if (obj.Key === prefix || obj.Key.endsWith('.keep')) continue;

        const fileName = obj.Key.split('/').pop() || '';
        if (fileName) {
          items.push({
            name: fileName,
            fullPath: obj.Key,
            isFolder: false,
            url: getFileUrl(obj.Key),
            size: obj.Size,
            updated: obj.LastModified?.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ items, configured: true });
  } catch (error: any) {
    console.error('Lỗi khi lấy danh sách files từ Cloudflare R2:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi lấy danh sách file', items: [], configured: false },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return NextResponse.json({ error: 'Cloudflare R2 chưa được cấu hình' }, { status: 400 });
    }

    const body = await request.json();
    const { key, isFolder } = body;

    if (!key) {
      return NextResponse.json({ error: 'Thiếu key của file hoặc thư mục cần xóa' }, { status: 400 });
    }

    if (isFolder) {
      // Xóa toàn bộ objects có prefix bắt đầu bằng folder path
      const folderPrefix = key.endsWith('/') ? key : `${key}/`;
      let continuationToken: string | undefined = undefined;
      let totalDeleted = 0;

      do {
        const listRes: ListObjectsV2CommandOutput = await r2Client.send(
          new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: folderPrefix,
            ContinuationToken: continuationToken,
          })
        );
        const objectsToDelete = (listRes.Contents || [])
          .filter((o): o is typeof o & { Key: string } => typeof o.Key === 'string')
          .map(o => ({ Key: o.Key }));

        if (objectsToDelete.length > 0) {
          await r2Client.send(
            new DeleteObjectsCommand({
              Bucket: BUCKET_NAME,
              Delete: { Objects: objectsToDelete },
            })
          );
          totalDeleted += objectsToDelete.length;
        }

        continuationToken = listRes.NextContinuationToken;
      } while (continuationToken);

      return NextResponse.json({ success: true, deletedCount: totalDeleted });
    }

    // Xóa 1 file đơn lẻ
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return NextResponse.json({ success: true, deletedKey: key });
  } catch (error: any) {
    console.error('Lỗi xóa object từ Cloudflare R2:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xóa object' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME, isR2Configured } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

const NOTEPAD_R2_KEY = '_system/notepad.json';
const d1DatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

// Memory fallback khi chưa có R2 cấu hình để app không bao giờ bị crash
let memoryNotepadContent = {
  content: '',
  updatedAt: new Date().toISOString(),
  version: 1,
};

/**
 * Đọc nội dung ghi chú từ D1 (nếu có cấu hình) hoặc R2
 */
export async function GET() {
  try {
    // 1. Thử đọc từ Cloudflare D1 nếu có D1 Config
    if (d1DatabaseId && accountId && apiToken) {
      try {
        const d1Res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1DatabaseId}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: 'CREATE TABLE IF NOT EXISTS shared_notepad (id TEXT PRIMARY KEY, content TEXT, updated_at TEXT); SELECT content, updated_at FROM shared_notepad WHERE id = "main_note" LIMIT 1;',
            }),
          }
        );

        if (d1Res.ok) {
          const d1Data = await d1Res.json();
          const rows = d1Data.result?.[1]?.results || [];
          if (rows.length > 0) {
            return NextResponse.json({
              content: rows[0].content || '',
              updatedAt: rows[0].updated_at || new Date().toISOString(),
              source: 'cloudflare-d1',
            });
          }
        }
      } catch (d1Err) {
        console.warn('Lỗi kết nối D1, fallback sang R2:', d1Err);
      }
    }

    // 2. Đọc từ Cloudflare R2
    if (isR2Configured) {
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: NOTEPAD_R2_KEY,
        });

        const response = await r2Client.send(command);
        if (response.Body) {
          const raw = await response.Body.transformToString();
          const parsed = JSON.parse(raw);
          return NextResponse.json({
            ...parsed,
            source: 'cloudflare-r2',
          });
        }
      } catch (r2Err: any) {
        // Nếu file chưa tồn tại (404/NoSuchKey) thì trả về rỗng
        if (r2Err.name === 'NoSuchKey' || r2Err.$metadata?.httpStatusCode === 404) {
          return NextResponse.json({
            content: '',
            updatedAt: new Date().toISOString(),
            source: 'cloudflare-r2',
          });
        }
        console.warn('Lỗi đọc R2 notepad:', r2Err);
      }
    }

    // 3. Fallback bộ nhớ tạm
    return NextResponse.json({
      ...memoryNotepadContent,
      source: 'memory',
    });
  } catch (error: any) {
    console.error('Lỗi GET /api/notepad:', error);
    return NextResponse.json(
      { content: '', updatedAt: new Date().toISOString(), error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Ghi nội dung ghi chú lên Cloudflare D1 / R2
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content : '';
    const now = new Date().toISOString();

    // 1. Thử lưu vào Cloudflare D1
    if (d1DatabaseId && accountId && apiToken) {
      try {
        const d1Res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1DatabaseId}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: `CREATE TABLE IF NOT EXISTS shared_notepad (id TEXT PRIMARY KEY, content TEXT, updated_at TEXT);
                    INSERT INTO shared_notepad (id, content, updated_at) VALUES ("main_note", ?1, ?2)
                    ON CONFLICT(id) DO UPDATE SET content = ?1, updated_at = ?2;`,
              params: [content, now],
            }),
          }
        );

        if (d1Res.ok) {
          return NextResponse.json({
            success: true,
            updatedAt: now,
            source: 'cloudflare-d1',
          });
        }
      } catch (d1Err) {
        console.warn('Lỗi lưu D1, fallback sang R2:', d1Err);
      }
    }

    // 2. Lưu vào Cloudflare R2
    if (isR2Configured) {
      const dataToSave = JSON.stringify({
        content,
        updatedAt: now,
      });

      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: NOTEPAD_R2_KEY,
          Body: Buffer.from(dataToSave, 'utf-8'),
          ContentType: 'application/json; charset=utf-8',
        })
      );

      return NextResponse.json({
        success: true,
        updatedAt: now,
        source: 'cloudflare-r2',
      });
    }

    // 3. Fallback bộ nhớ tạm
    memoryNotepadContent = {
      content,
      updatedAt: now,
      version: memoryNotepadContent.version + 1,
    };

    return NextResponse.json({
      success: true,
      updatedAt: now,
      source: 'memory',
    });
  } catch (error: any) {
    console.error('Lỗi POST /api/notepad:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi lưu ghi chú' },
      { status: 500 }
    );
  }
}

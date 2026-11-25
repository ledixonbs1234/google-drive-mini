import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME, isR2Configured } from '@/lib/cloudflareR2';
import { SharedNoteItem } from '@/types/shared-notepad';

export const dynamic = 'force-dynamic';

const NOTEPAD_R2_KEY = '_system/notepad.json';
const d1DatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

interface StoredNotepadPayload {
  notes: SharedNoteItem[];
  content?: string;
  updatedAt: string;
  version: number;
}

function createDefaultPayload(initialContent = ''): StoredNotepadPayload {
  const now = new Date().toISOString();
  return {
    notes: [
      {
        id: 'main_note',
        title: 'Ghi chú chung',
        content: initialContent,
        pinned: true,
        updatedAt: now,
      },
    ],
    content: initialContent,
    updatedAt: now,
    version: 1,
  };
}

function normalizePayload(raw: any): StoredNotepadPayload {
  const now = new Date().toISOString();
  if (raw && Array.isArray(raw.notes) && raw.notes.length > 0) {
    return {
      notes: raw.notes.map((n: any, idx: number) => ({
        id: String(n.id || `note_${idx}`),
        title: String(n.title || `Ghi chú ${idx + 1}`),
        content: typeof n.content === 'string' ? n.content : '',
        pinned: Boolean(n.pinned),
        updatedAt: n.updatedAt || raw.updatedAt || now,
      })),
      content: raw.notes[0]?.content || '',
      updatedAt: raw.updatedAt || now,
      version: Number(raw.version) || 1,
    };
  }
  const legacyContent = typeof raw?.content === 'string' ? raw.content : '';
  const payload = createDefaultPayload(legacyContent);
  if (raw?.updatedAt) {
    payload.updatedAt = raw.updatedAt;
    payload.notes[0].updatedAt = raw.updatedAt;
  }
  return payload;
}

let memoryNotepad: StoredNotepadPayload = createDefaultPayload('');

export async function GET() {
  try {
    // 1. Thử đọc từ Cloudflare D1 nếu có cấu hình
    if (d1DatabaseId && accountId && apiToken) {
      try {
        const d1Res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1DatabaseId}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
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
            const rawStr = rows[0].content || '';
            let parsed: StoredNotepadPayload;
            try {
              const maybeJson = JSON.parse(rawStr);
              parsed = normalizePayload(maybeJson);
            } catch {
              parsed = normalizePayload({ content: rawStr, updatedAt: rows[0].updated_at });
            }
            return NextResponse.json({
              ...parsed,
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
          const parsed = normalizePayload(JSON.parse(raw));
          return NextResponse.json({
            ...parsed,
            source: 'cloudflare-r2',
          });
        }
      } catch (r2Err: any) {
        if (r2Err.name === 'NoSuchKey' || r2Err.$metadata?.httpStatusCode === 404) {
          return NextResponse.json({
            ...createDefaultPayload(''),
            source: 'cloudflare-r2',
          });
        }
        console.warn('Lỗi đọc R2 notepad:', r2Err);
      }
    }

    // 3. Fallback bộ nhớ tạm
    return NextResponse.json({
      ...memoryNotepad,
      source: 'memory',
    });
  } catch (error: any) {
    console.error('Lỗi GET /api/notepad:', error);
    return NextResponse.json(
      { ...createDefaultPayload(''), error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();

    let payloadToSave: StoredNotepadPayload;
    if (Array.isArray(body.notes) && body.notes.length > 0) {
      const sanitizedNotes: SharedNoteItem[] = body.notes.slice(0, 30).map((n: any, idx: number) => ({
        id: String(n.id || `note_${Date.now()}_${idx}`),
        title: String(n.title || 'Không tiêu đề').slice(0, 120),
        content: typeof n.content === 'string' ? n.content.slice(0, 100000) : '',
        pinned: Boolean(n.pinned),
        updatedAt: n.updatedAt || now,
      }));
      payloadToSave = {
        notes: sanitizedNotes,
        content: sanitizedNotes[0]?.content || '',
        updatedAt: now,
        version: (Number(body.version) || 1) + 1,
      };
    } else {
      const content = typeof body.content === 'string' ? body.content.slice(0, 100000) : '';
      payloadToSave = createDefaultPayload(content);
      payloadToSave.updatedAt = now;
    }

    const serialized = JSON.stringify(payloadToSave);

    // 1. Thử lưu vào Cloudflare D1
    if (d1DatabaseId && accountId && apiToken) {
      try {
        const d1Res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1DatabaseId}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: `CREATE TABLE IF NOT EXISTS shared_notepad (id TEXT PRIMARY KEY, content TEXT, updated_at TEXT);
                    INSERT INTO shared_notepad (id, content, updated_at) VALUES ("main_note", ?1, ?2)
                    ON CONFLICT(id) DO UPDATE SET content = ?1, updated_at = ?2;`,
              params: [serialized, now],
            }),
          }
        );

        if (d1Res.ok) {
          return NextResponse.json({
            success: true,
            ...payloadToSave,
            source: 'cloudflare-d1',
          });
        }
      } catch (d1Err) {
        console.warn('Lỗi lưu D1, fallback sang R2:', d1Err);
      }
    }

    // 2. Lưu vào Cloudflare R2
    if (isR2Configured) {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: NOTEPAD_R2_KEY,
          Body: Buffer.from(serialized, 'utf-8'),
          ContentType: 'application/json; charset=utf-8',
        })
      );

      return NextResponse.json({
        success: true,
        ...payloadToSave,
        source: 'cloudflare-r2',
      });
    }

    // 3. Fallback bộ nhớ tạm
    memoryNotepad = payloadToSave;

    return NextResponse.json({
      success: true,
      ...payloadToSave,
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

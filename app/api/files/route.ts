import { NextRequest, NextResponse } from 'next/server';
import {
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  r2Client,
  BUCKET_NAME,
  PUBLIC_DOMAIN,
  isR2Configured,
  getFileUrl,
  invalidateStorageUsageCache,
  encodeR2CopySource,
  isValidUserStorageKey,
  verifySafetyLimit,
} from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

const STARRED_KEY = '_system/starred.json';
const TRASH_MANIFEST_KEY = '_system/trash.json';

export interface StorageItemDto {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string;
  size?: number;
  updated?: string;
  starred?: boolean;
  trashId?: string;
  originalPath?: string;
  deletedAt?: string;
}

export interface TrashManifestEntry {
  trashId: string;
  name: string;
  originalPath: string;
  trashPath: string;
  isFolder: boolean;
  size: number;
  deletedAt: string;
}

// In-memory cache ngắn hạn cho danh sách gắn sao & thùng rác
let starredCache: { paths: Set<string>; timestamp: number } | null = null;
let trashCache: { items: TrashManifestEntry[]; timestamp: number } | null = null;
const META_CACHE_TTL = 10 * 1000;

async function readJsonFromR2<T>(key: string, fallback: T): Promise<T> {
  if (!isR2Configured) return fallback;
  try {
    const res = await r2Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    if (!res.Body) return fallback;
    const raw = await res.Body.transformToString();
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return fallback;
    }
    console.warn(`Không đọc được ${key}:`, err);
    return fallback;
  }
}

async function writeJsonToR2<T>(key: string, data: T): Promise<void> {
  if (!isR2Configured) return;
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: Buffer.from(JSON.stringify(data), 'utf-8'),
      ContentType: 'application/json; charset=utf-8',
    })
  );
}

async function getStarredPaths(force = false): Promise<Set<string>> {
  const now = Date.now();
  if (!force && starredCache && now - starredCache.timestamp < META_CACHE_TTL) {
    return starredCache.paths;
  }
  const data = await readJsonFromR2<{ paths?: string[] }>(STARRED_KEY, { paths: [] });
  const set = new Set<string>(Array.isArray(data.paths) ? data.paths : []);
  starredCache = { paths: set, timestamp: now };
  return set;
}

async function saveStarredPaths(paths: Set<string>): Promise<void> {
  const arr = Array.from(paths);
  starredCache = { paths: new Set(arr), timestamp: Date.now() };
  await writeJsonToR2(STARRED_KEY, { paths: arr, updatedAt: new Date().toISOString() });
}

async function getTrashManifest(force = false): Promise<TrashManifestEntry[]> {
  const now = Date.now();
  if (!force && trashCache && now - trashCache.timestamp < META_CACHE_TTL) {
    return trashCache.items;
  }
  const data = await readJsonFromR2<{ items?: TrashManifestEntry[] }>(TRASH_MANIFEST_KEY, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  trashCache = { items, timestamp: now };
  return items;
}

async function saveTrashManifest(items: TrashManifestEntry[]): Promise<void> {
  trashCache = { items: [...items], timestamp: Date.now() };
  await writeJsonToR2(TRASH_MANIFEST_KEY, { items, updatedAt: new Date().toISOString() });
}

async function listAllObjectsUnderPrefix(prefix: string): Promise<Array<{ Key: string; Size: number; LastModified?: Date }>> {
  const results: Array<{ Key: string; Size: number; LastModified?: Date }> = [];
  let continuationToken: string | undefined = undefined;

  do {
    const res: ListObjectsV2CommandOutput = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    if (res.Contents) {
      for (const obj of res.Contents) {
        if (obj.Key) {
          results.push({
            Key: obj.Key,
            Size: obj.Size || 0,
            LastModified: obj.LastModified,
          });
        }
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return results;
}

async function deleteKeysBatch(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await r2Client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    );
    deleted += chunk.length;
  }
  return deleted;
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function prefixHasAnyObject(prefix: string): Promise<boolean> {
  const res = await r2Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 1,
    })
  );
  return Boolean(res.Contents && res.Contents.length > 0);
}

function splitFileNameAndExt(name: string): { base: string; ext: string } {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, lastDot), ext: name.slice(lastDot) };
}

async function resolveUniqueDestination(destPath: string, isFolder: boolean): Promise<string> {
  if (isFolder) {
    const clean = destPath.endsWith('/') ? destPath.slice(0, -1) : destPath;
    if (!(await prefixHasAnyObject(`${clean}/`))) {
      return `${clean}/`;
    }
    let counter = 1;
    while (counter < 100) {
      const candidate = `${clean} (${counter})/`;
      if (!(await prefixHasAnyObject(candidate))) return candidate;
      counter++;
    }
    return `${clean} (${Date.now()})/`;
  } else {
    if (!(await objectExists(destPath))) {
      return destPath;
    }
    const lastSlash = destPath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? destPath.slice(0, lastSlash + 1) : 'uploads/';
    const fileName = lastSlash >= 0 ? destPath.slice(lastSlash + 1) : destPath;
    const { base, ext } = splitFileNameAndExt(fileName);
    let counter = 1;
    while (counter < 100) {
      const candidate = `${dir}${base} (${counter})${ext}`;
      if (!(await objectExists(candidate))) return candidate;
      counter++;
    }
    return `${dir}${base} (${Date.now()})${ext}`;
  }
}

async function copyPrefixOrObject(sourcePath: string, destPath: string, isFolder: boolean): Promise<number> {
  if (isFolder) {
    const srcPrefix = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`;
    const dstPrefix = destPath.endsWith('/') ? destPath : `${destPath}/`;
    const allObjs = await listAllObjectsUnderPrefix(srcPrefix);

    if (allObjs.length === 0) {
      // Tạo marker .keep nếu thư mục rỗng
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `${dstPrefix}.keep`,
          Body: Buffer.from(''),
          ContentType: 'application/x-directory',
        })
      );
      return 1;
    }

    for (const obj of allObjs) {
      const suffix = obj.Key.slice(srcPrefix.length);
      const newKey = `${dstPrefix}${suffix}`;
      await r2Client.send(
        new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: encodeR2CopySource(BUCKET_NAME, obj.Key),
          Key: newKey,
        })
      );
    }
    return allObjs.length;
  } else {
    await r2Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: encodeR2CopySource(BUCKET_NAME, sourcePath),
        Key: destPath,
      })
    );
    return 1;
  }
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
    const mode = searchParams.get('mode') || 'browse'; // browse | recent | starred | trash | folders
    const showHidden = searchParams.get('showHidden') === 'true';

    // Chế độ 1: Thùng rác (Trash)
    if (mode === 'trash') {
      const manifest = await getTrashManifest();
      const sorted = [...manifest].sort(
        (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
      );
      const items: StorageItemDto[] = sorted
        .filter((t) => !searchTerm || t.name.toLowerCase().includes(searchTerm))
        .map((t) => ({
          name: t.name,
          fullPath: t.trashPath,
          isFolder: t.isFolder,
          size: t.size,
          updated: t.deletedAt,
          deletedAt: t.deletedAt,
          trashId: t.trashId,
          originalPath: t.originalPath,
          url: t.isFolder ? undefined : getFileUrl(t.trashPath),
        }));
      return NextResponse.json({ items, configured: true });
    }

    const starredSet = await getStarredPaths();

    // Chế độ 2: Lấy toàn bộ danh sách thư mục (cho hộp thoại Di chuyển / Sao chép đến...)
    if (mode === 'folders') {
      const allObjs = await listAllObjectsUnderPrefix('uploads/');
      const folderSet = new Set<string>();
      for (const obj of allObjs) {
        const rel = obj.Key.replace(/^uploads\//, '');
        const parts = rel.split('/');
        for (let i = 0; i < parts.length - 1; i++) {
          if (!parts[i]) continue;
          const folderRel = parts.slice(0, i + 1).join('/') + '/';
          folderSet.add(folderRel);
        }
      }
      const folders = Array.from(folderSet)
        .sort((a, b) => a.localeCompare(b))
        .map((relPath) => ({
          name: relPath.slice(0, -1).split('/').pop() || relPath,
          relativePath: relPath,
          fullPath: `uploads/${relPath}`,
        }));
      return NextResponse.json({ folders, configured: true });
    }

    // Chế độ 3: Gần đây (Recent), Đã gắn sao (Starred), hoặc Tìm kiếm toàn bộ
    if (searchTerm || mode === 'recent' || mode === 'starred') {
      const objects = await listAllObjectsUnderPrefix('uploads/');
      const results: StorageItemDto[] = [];
      const foundFolders = new Set<string>();

      for (const obj of objects) {
        if (!obj.Key || obj.Key.endsWith('.keep')) {
          // Vẫn ghi nhận thư mục rỗng nếu khớp tìm kiếm hoặc gắn sao
          if (obj.Key?.endsWith('/.keep')) {
            const folderFull = obj.Key.slice(0, -'.keep'.length);
            const folderName = folderFull.slice(0, -1).split('/').pop() || '';
            if (
              folderName &&
              !foundFolders.has(folderFull) &&
              (mode === 'starred'
                ? starredSet.has(folderFull)
                : searchTerm
                ? folderName.toLowerCase().includes(searchTerm)
                : false)
            ) {
              foundFolders.add(folderFull);
              results.push({
                name: folderName,
                fullPath: folderFull,
                isFolder: true,
                starred: starredSet.has(folderFull),
                updated: obj.LastModified?.toISOString(),
              });
            }
          }
          continue;
        }

        const relativeKey = obj.Key.replace(/^uploads\//, '');
        const segments = relativeKey.split('/');
        const fileName = segments[segments.length - 1];
        if (!showHidden && fileName.startsWith('.')) continue;

        // Duyệt thư mục cha
        if (mode !== 'recent') {
          for (let i = 0; i < segments.length - 1; i++) {
            const folderName = segments[i];
            if (!showHidden && folderName.startsWith('.')) continue;
            const folderFullPath = 'uploads/' + segments.slice(0, i + 1).join('/') + '/';
            if (foundFolders.has(folderFullPath)) continue;

            const matchesSearch = searchTerm ? folderName.toLowerCase().includes(searchTerm) : true;
            const matchesStar = mode === 'starred' ? starredSet.has(folderFullPath) : true;

            if (matchesSearch && matchesStar && (searchTerm || mode === 'starred')) {
              foundFolders.add(folderFullPath);
              results.push({
                name: folderName,
                fullPath: folderFullPath,
                isFolder: true,
                starred: starredSet.has(folderFullPath),
              });
            }
          }
        }

        const fileMatchesSearch = searchTerm ? fileName.toLowerCase().includes(searchTerm) : true;
        const fileMatchesStar = mode === 'starred' ? starredSet.has(obj.Key) : true;

        if (fileName && fileMatchesSearch && fileMatchesStar) {
          results.push({
            name: fileName,
            fullPath: obj.Key,
            isFolder: false,
            url: getFileUrl(obj.Key),
            size: obj.Size,
            updated: obj.LastModified?.toISOString(),
            starred: starredSet.has(obj.Key),
          });
        }
      }

      if (mode === 'recent') {
        results.sort((a, b) => {
          const tA = a.updated ? new Date(a.updated).getTime() : 0;
          const tB = b.updated ? new Date(b.updated).getTime() : 0;
          return tB - tA;
        });
        return NextResponse.json({ items: results.slice(0, 100), configured: true });
      }

      return NextResponse.json({ items: results, configured: true });
    }

    // Chế độ 4: Duyệt thư mục hiện tại (có hỗ trợ phân trang tự động hết thư mục + lấy thời gian cập nhật thư mục con)
    if (currentPath.startsWith('/')) currentPath = currentPath.slice(1);
    if (currentPath.startsWith('uploads/')) currentPath = currentPath.slice('uploads/'.length);
    const prefix = currentPath ? `uploads/${currentPath.endsWith('/') ? currentPath : `${currentPath}/`}` : 'uploads/';

    // Lấy mẫu nhanh tối đa 1000 objects dưới prefix để suy ra thời gian cập nhật mới nhất của từng thư mục con
    const folderLatestModified = new Map<string, Date>();
    try {
      const sampleRes = await r2Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          MaxKeys: 1000,
        })
      );
      if (sampleRes.Contents) {
        for (const obj of sampleRes.Contents) {
          if (!obj.Key || !obj.LastModified || !obj.Key.startsWith(prefix)) continue;
          const rest = obj.Key.slice(prefix.length);
          const slashIdx = rest.indexOf('/');
          if (slashIdx > 0) {
            const subFolderPrefix = `${prefix}${rest.slice(0, slashIdx + 1)}`;
            const prev = folderLatestModified.get(subFolderPrefix);
            if (!prev || obj.LastModified > prev) {
              folderLatestModified.set(subFolderPrefix, obj.LastModified);
            }
          }
        }
      }
    } catch {
      // Bỏ qua nếu không lấy được mẫu thời gian thư mục
    }

    const items: StorageItemDto[] = [];
    const seenFolders = new Set<string>();
    let continuationToken: string | undefined = undefined;

    do {
      const response: ListObjectsV2CommandOutput = await r2Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          Delimiter: '/',
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      );

      if (response.CommonPrefixes) {
        for (const cp of response.CommonPrefixes) {
          if (!cp.Prefix || seenFolders.has(cp.Prefix)) continue;
          seenFolders.add(cp.Prefix);
          const cleanPrefix = cp.Prefix.endsWith('/') ? cp.Prefix.slice(0, -1) : cp.Prefix;
          const folderName = cleanPrefix.split('/').pop() || '';
          if (!folderName || (!showHidden && folderName.startsWith('.'))) continue;
          items.push({
            name: folderName,
            fullPath: cp.Prefix,
            isFolder: true,
            updated: folderLatestModified.get(cp.Prefix)?.toISOString(),
            starred: starredSet.has(cp.Prefix),
          });
        }
      }

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (!obj.Key) continue;
          if (obj.Key === prefix || obj.Key.endsWith('.keep')) continue;
          const fileName = obj.Key.split('/').pop() || '';
          if (!fileName || (!showHidden && fileName.startsWith('.'))) continue;

          items.push({
            name: fileName,
            fullPath: obj.Key,
            isFolder: false,
            url: getFileUrl(obj.Key),
            size: obj.Size,
            updated: obj.LastModified?.toISOString(),
            starred: starredSet.has(obj.Key),
          });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json({ items, configured: true });
  } catch (error: any) {
    console.error('Lỗi khi lấy danh sách files từ Cloudflare R2:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi lấy danh sách file', items: [], configured: false },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/files
 * Hỗ trợ: rename, move, copy, restore, toggle_star, share
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return NextResponse.json({ error: 'Cloudflare R2 chưa được cấu hình' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    // 1. Gắn sao / Bỏ gắn sao (dùng chung cho cả nhóm)
    if (action === 'toggle_star') {
      const { fullPath } = body as { fullPath: string };
      if (!fullPath || !isValidUserStorageKey(fullPath)) {
        return NextResponse.json({ error: 'Đường dẫn không hợp lệ' }, { status: 400 });
      }
      const starred = await getStarredPaths(true);
      let isNowStarred = false;
      if (starred.has(fullPath)) {
        starred.delete(fullPath);
      } else {
        starred.add(fullPath);
        isNowStarred = true;
      }
      await saveStarredPaths(starred);
      return NextResponse.json({ success: true, starred: isNowStarred });
    }

    // 2. Tạo Link Chia Sẻ có thời hạn (Presigned GET URL)
    if (action === 'share') {
      const { key, expiresInSeconds = 86400 } = body as { key: string; expiresInSeconds?: number };
      if (!key || !isValidUserStorageKey(key)) {
        return NextResponse.json({ error: 'Key chia sẻ không hợp lệ' }, { status: 400 });
      }
      const clampedExpiry = Math.min(Math.max(Number(expiresInSeconds) || 86400, 300), 604800); // 5 phút -> 7 ngày
      const fileName = key.split('/').pop() || 'file';

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      });
      const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: clampedExpiry });
      const downloadCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      });
      const presignedDownloadUrl = await getSignedUrl(r2Client, downloadCommand, { expiresIn: clampedExpiry });

      return NextResponse.json({
        success: true,
        shareUrl: presignedUrl,
        downloadUrl: presignedDownloadUrl,
        publicUrl: PUBLIC_DOMAIN ? getFileUrl(key) : null,
        expiresAt: new Date(Date.now() + clampedExpiry * 1000).toISOString(),
      });
    }

    // 3. Đổi tên File hoặc Thư mục trực tiếp trên R2
    if (action === 'rename') {
      const { sourcePath, newName, isFolder } = body as {
        sourcePath: string;
        newName: string;
        isFolder: boolean;
      };

      const trimmedName = (newName || '').trim();
      if (!sourcePath || !trimmedName || !isValidUserStorageKey(sourcePath)) {
        return NextResponse.json({ error: 'Thông tin đổi tên không hợp lệ' }, { status: 400 });
      }
      if (/[\\/:\*\?"<>\|]/.test(trimmedName)) {
        return NextResponse.json({ error: 'Tên mới chứa ký tự không hợp lệ' }, { status: 400 });
      }

      const cleanSrc = isFolder && sourcePath.endsWith('/') ? sourcePath.slice(0, -1) : sourcePath;
      const parentDir = cleanSrc.slice(0, cleanSrc.lastIndexOf('/') + 1);
      const destPath = isFolder ? `${parentDir}${trimmedName}/` : `${parentDir}${trimmedName}`;

      if (destPath === sourcePath) {
        return NextResponse.json({ success: true, newPath: destPath });
      }

      const exists = isFolder ? await prefixHasAnyObject(destPath) : await objectExists(destPath);
      if (exists) {
        return NextResponse.json({ error: `Đã tồn tại mục có tên "${trimmedName}" trong thư mục này.` }, { status: 409 });
      }

      await copyPrefixOrObject(sourcePath, destPath, isFolder);

      if (isFolder) {
        const srcPrefix = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`;
        const oldObjs = await listAllObjectsUnderPrefix(srcPrefix);
        await deleteKeysBatch(oldObjs.map((o) => o.Key));
      } else {
        await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: sourcePath }));
      }

      // Cập nhật đường dẫn gắn sao nếu có
      const starred = await getStarredPaths(true);
      let starredChanged = false;
      if (isFolder) {
        for (const p of Array.from(starred)) {
          if (p.startsWith(sourcePath)) {
            starred.delete(p);
            starred.add(destPath + p.slice(sourcePath.length));
            starredChanged = true;
          }
        }
      } else if (starred.has(sourcePath)) {
        starred.delete(sourcePath);
        starred.add(destPath);
        starredChanged = true;
      }
      if (starredChanged) await saveStarredPaths(starred);

      invalidateStorageUsageCache();
      return NextResponse.json({ success: true, newPath: destPath });
    }

    // 4. Di chuyển (move) hoặc Sao chép (copy) hàng loạt trực tiếp trên R2
    if (action === 'move' || action === 'copy') {
      const {
        items = [],
        targetFolderPath = '',
        conflictResolution = 'rename',
      } = body as {
        items: Array<{ fullPath: string; isFolder: boolean; name: string }>;
        targetFolderPath: string;
        conflictResolution?: 'rename' | 'overwrite';
      };

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Không có mục nào được chọn' }, { status: 400 });
      }

      let cleanTarget = (targetFolderPath || '').replace(/^\//, '');
      if (cleanTarget.startsWith('uploads/')) {
        cleanTarget = cleanTarget.slice('uploads/'.length);
      }
      if (cleanTarget && !cleanTarget.endsWith('/')) {
        cleanTarget += '/';
      }
      const targetPrefix = `uploads/${cleanTarget}`;

      // Nếu là sao chép (nhân bản), cần kiểm tra Khóa An Toàn 10 GB trước!
      if (action === 'copy') {
        let totalCopyBytes = 0;
        for (const item of items) {
          if (!isValidUserStorageKey(item.fullPath)) continue;
          if (item.isFolder) {
            const objs = await listAllObjectsUnderPrefix(item.fullPath.endsWith('/') ? item.fullPath : `${item.fullPath}/`);
            totalCopyBytes += objs.reduce((s, o) => s + o.Size, 0);
          } else {
            const objs = await listAllObjectsUnderPrefix(item.fullPath);
            const exact = objs.find((o) => o.Key === item.fullPath);
            totalCopyBytes += exact?.Size || 0;
          }
        }
        const safety = await verifySafetyLimit(totalCopyBytes);
        if (!safety.allowed) {
          return NextResponse.json({ error: safety.message }, { status: 403 });
        }
      }

      let processed = 0;
      const skipped: string[] = [];

      for (const item of items) {
        if (!item.fullPath || !isValidUserStorageKey(item.fullPath)) continue;

        if (item.isFolder) {
          const srcFolder = item.fullPath.endsWith('/') ? item.fullPath : `${item.fullPath}/`;
          if (targetPrefix.startsWith(srcFolder)) {
            skipped.push(`${item.name} (không thể chuyển vào chính nó)`);
            continue;
          }
          let destFolder = `${targetPrefix}${item.name}/`;
          if (action === 'move' && destFolder === srcFolder) {
            continue;
          }
          if (conflictResolution === 'rename') {
            destFolder = await resolveUniqueDestination(destFolder, true);
          }

          await copyPrefixOrObject(srcFolder, destFolder, true);
          if (action === 'move') {
            const oldObjs = await listAllObjectsUnderPrefix(srcFolder);
            await deleteKeysBatch(oldObjs.map((o) => o.Key));
          }
          processed++;
        } else {
          let destFile = `${targetPrefix}${item.name}`;
          if (action === 'move' && destFile === item.fullPath) {
            continue;
          }
          if (conflictResolution === 'rename') {
            destFile = await resolveUniqueDestination(destFile, false);
          }

          await copyPrefixOrObject(item.fullPath, destFile, false);
          if (action === 'move') {
            await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: item.fullPath }));
          }
          processed++;
        }
      }

      invalidateStorageUsageCache();
      return NextResponse.json({ success: true, processed, skipped });
    }

    // 5. Khôi phục từ Thùng rác (Restore)
    if (action === 'restore') {
      const { trashIds = [] } = body as { trashIds: string[] };
      if (!Array.isArray(trashIds) || trashIds.length === 0) {
        return NextResponse.json({ error: 'Thiếu danh sách mục cần khôi phục' }, { status: 400 });
      }

      const manifest = await getTrashManifest(true);
      const idSet = new Set(trashIds);
      const toRestore = manifest.filter((m) => idSet.has(m.trashId));
      const remaining = manifest.filter((m) => !idSet.has(m.trashId));

      let restoredCount = 0;
      for (const entry of toRestore) {
        const dest = await resolveUniqueDestination(entry.originalPath, entry.isFolder);
        await copyPrefixOrObject(entry.trashPath, dest, entry.isFolder);

        if (entry.isFolder) {
          const trashObjs = await listAllObjectsUnderPrefix(entry.trashPath);
          await deleteKeysBatch(trashObjs.map((o) => o.Key));
        } else {
          await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: entry.trashPath }));
        }
        restoredCount++;
      }

      await saveTrashManifest(remaining);
      invalidateStorageUsageCache();
      return NextResponse.json({ success: true, restoredCount });
    }

    return NextResponse.json({ error: 'Hành động không được hỗ trợ' }, { status: 400 });
  } catch (error: any) {
    console.error('Lỗi PATCH /api/files:', error);
    return NextResponse.json({ error: error.message || 'Lỗi thao tác tệp' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return NextResponse.json({ error: 'Cloudflare R2 chưa được cấu hình' }, { status: 400 });
    }

    const body = await request.json();
    const {
      key,
      isFolder = false,
      items,
      permanent = false,
      trashId,
      emptyTrash = false,
    } = body as {
      key?: string;
      isFolder?: boolean;
      items?: Array<{ key: string; isFolder?: boolean; trashId?: string }>;
      permanent?: boolean;
      trashId?: string;
      emptyTrash?: boolean;
    };

    // Trường hợp A: Làm trống toàn bộ Thùng rác
    if (emptyTrash) {
      const trashObjs = await listAllObjectsUnderPrefix('_trash/');
      const deletedCount = await deleteKeysBatch(trashObjs.map((o) => o.Key));
      await saveTrashManifest([]);
      invalidateStorageUsageCache();
      return NextResponse.json({ success: true, deletedCount });
    }

    // Chuẩn hóa danh sách các mục cần xóa
    const targets: Array<{ key: string; isFolder: boolean; trashId?: string }> = Array.isArray(items)
      ? items.map((i) => ({ key: i.key, isFolder: Boolean(i.isFolder), trashId: i.trashId }))
      : key
      ? [{ key, isFolder: Boolean(isFolder), trashId }]
      : [];

    if (targets.length === 0) {
      return NextResponse.json({ error: 'Thiếu mục cần xóa' }, { status: 400 });
    }

    const manifest = await getTrashManifest(true);
    let manifestModified = false;
    let totalDeleted = 0;

    for (const target of targets) {
      if (!isValidUserStorageKey(target.key)) continue;

      const isAlreadyInTrash = target.key.startsWith('_trash/') || Boolean(target.trashId);

      // Xóa vĩnh viễn (nếu đang ở trong thùng rác hoặc người dùng chọn xóa hẳn)
      if (permanent || isAlreadyInTrash) {
        if (target.isFolder) {
          const folderPrefix = target.key.endsWith('/') ? target.key : `${target.key}/`;
          const objs = await listAllObjectsUnderPrefix(folderPrefix);
          totalDeleted += await deleteKeysBatch(objs.map((o) => o.Key));
        } else {
          await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: target.key }));
          totalDeleted += 1;
        }

        if (target.trashId) {
          const idx = manifest.findIndex((m) => m.trashId === target.trashId);
          if (idx >= 0) {
            manifest.splice(idx, 1);
            manifestModified = true;
          }
        } else if (target.key.startsWith('_trash/')) {
          const idx = manifest.findIndex((m) => m.trashPath === target.key);
          if (idx >= 0) {
            manifest.splice(idx, 1);
            manifestModified = true;
          }
        }
      } else {
        // Chuyển vào Thùng rác (_trash/) để có thể khôi phục khi cần
        const newTrashId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const cleanKey = target.isFolder && target.key.endsWith('/') ? target.key.slice(0, -1) : target.key;
        const itemName = cleanKey.split('/').pop() || 'item';

        if (target.isFolder) {
          const srcPrefix = target.key.endsWith('/') ? target.key : `${target.key}/`;
          const dstPrefix = `_trash/${newTrashId}/`;
          const objs = await listAllObjectsUnderPrefix(srcPrefix);
          const folderSize = objs.reduce((sum, o) => sum + o.Size, 0);

          await copyPrefixOrObject(srcPrefix, dstPrefix, true);
          totalDeleted += await deleteKeysBatch(objs.map((o) => o.Key));

          manifest.push({
            trashId: newTrashId,
            name: itemName,
            originalPath: srcPrefix,
            trashPath: dstPrefix,
            isFolder: true,
            size: folderSize,
            deletedAt: new Date().toISOString(),
          });
          manifestModified = true;
        } else {
          const objs = await listAllObjectsUnderPrefix(target.key);
          const exactObj = objs.find((o) => o.Key === target.key);
          const dstKey = `_trash/${newTrashId}/${itemName}`;

          await copyPrefixOrObject(target.key, dstKey, false);
          await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: target.key }));
          totalDeleted += 1;

          manifest.push({
            trashId: newTrashId,
            name: itemName,
            originalPath: target.key,
            trashPath: dstKey,
            isFolder: false,
            size: exactObj?.Size || 0,
            deletedAt: new Date().toISOString(),
          });
          manifestModified = true;
        }
      }
    }

    if (manifestModified) {
      await saveTrashManifest(manifest);
    }

    invalidateStorageUsageCache();
    return NextResponse.json({ success: true, deletedCount: totalDeleted, movedToTrash: !permanent });
  } catch (error: any) {
    console.error('Lỗi xóa object từ Cloudflare R2:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xóa object' }, { status: 500 });
  }
}

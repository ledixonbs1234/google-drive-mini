import { S3Client, ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'google-drive-mini';
export const PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');
export const PLAN_TYPE = (process.env.R2_PLAN_TYPE || 'paid').toLowerCase() as 'paid' | 'free';

// Giới hạn an toàn miễn phí của Cloudflare R2 (10 GB) để KHÔNG BAO GIỜ bị trừ tiền thẻ ngân hàng
export const R2_SAFETY_LIMIT_BYTES = (
  process.env.R2_SAFETY_LIMIT_GB 
    ? parseFloat(process.env.R2_SAFETY_LIMIT_GB) 
    : 10
) * 1024 * 1024 * 1024; // 10 GB

export const HARD_CAP_ENABLED = process.env.R2_HARD_CAP_ENABLED !== 'false'; // Mặc định luôn bật khóa an toàn

export const isR2Configured = Boolean(
  accountId && accessKeyId && secretAccessKey && BUCKET_NAME
);

let cachedUsage: {
  usedBytes: number;
  totalObjects: number;
  timestamp: number;
} | null = null;
const CACHE_TTL_MS = 15 * 1000; // Cache 15 giây

/**
 * Lấy tổng dung lượng hiện tại trong R2 với cơ chế cache an toàn
 */
export async function getUsedStorageBytes(forceFresh = false): Promise<{ usedBytes: number; totalObjects: number }> {
  const now = Date.now();
  if (!forceFresh && cachedUsage && now - cachedUsage.timestamp < CACHE_TTL_MS) {
    return {
      usedBytes: cachedUsage.usedBytes,
      totalObjects: cachedUsage.totalObjects,
    };
  }

  let totalUsedBytes = 0;
  let totalObjects = 0;
  let continuationToken: string | undefined = undefined;

  do {
    const response: ListObjectsV2CommandOutput = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key && !item.Key.endsWith('.keep')) {
          totalObjects++;
        }
        totalUsedBytes += item.Size || 0;
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  cachedUsage = {
    usedBytes: totalUsedBytes,
    totalObjects,
    timestamp: now,
  };

  return { usedBytes: totalUsedBytes, totalObjects };
}

/**
 * Invalidate cache khi có upload/delete mới
 */
export function invalidateStorageUsageCache() {
  cachedUsage = null;
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : 'https://dummy.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: accessKeyId || 'dummy',
    secretAccessKey: secretAccessKey || 'dummy',
  },
});

/**
 * Trả về URL truy cập file:
 * - Dùng Public Domain (R2 Dev URL hoặc Custom Domain) nếu đã cấu hình
 * - Hoặc route qua /api/files/download nếu là private bucket
 */
export function getFileUrl(key: string): string {
  if (PUBLIC_DOMAIN) {
    return `${PUBLIC_DOMAIN}/${key}`;
  }
  return `/api/files/download?key=${encodeURIComponent(key)}`;
}

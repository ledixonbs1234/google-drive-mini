import { S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'google-drive-mini';
export const PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');

export const isR2Configured = Boolean(
  accountId && accessKeyId && secretAccessKey && BUCKET_NAME
);

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

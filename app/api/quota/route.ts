import { NextResponse } from 'next/server';
import { ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME, isR2Configured } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

// Hạn mức Cloudflare R2 Free Tier: 10 GB
const CLOUDFLARE_FREE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

let quotaCache: {
  usedBytes: number;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 30 * 1000; // Cache 30 giây

export async function GET() {
  try {
    if (!isR2Configured) {
      return NextResponse.json({
        usedBytes: 0,
        totalBytes: CLOUDFLARE_FREE_QUOTA_BYTES,
        remainingBytes: CLOUDFLARE_FREE_QUOTA_BYTES,
        percentUsed: 0,
        configured: false,
      });
    }

    const now = Date.now();
    if (quotaCache && now - quotaCache.timestamp < CACHE_TTL_MS) {
      const usedBytes = quotaCache.usedBytes;
      const remainingBytes = Math.max(0, CLOUDFLARE_FREE_QUOTA_BYTES - usedBytes);
      const percentUsed = (usedBytes / CLOUDFLARE_FREE_QUOTA_BYTES) * 100;

      return NextResponse.json({
        usedBytes,
        totalBytes: CLOUDFLARE_FREE_QUOTA_BYTES,
        remainingBytes,
        percentUsed: Math.min(percentUsed, 100),
        configured: true,
      });
    }

    let totalUsedBytes = 0;
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
          totalUsedBytes += item.Size || 0;
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Cập nhật cache
    quotaCache = {
      usedBytes: totalUsedBytes,
      timestamp: now,
    };

    const remainingBytes = Math.max(0, CLOUDFLARE_FREE_QUOTA_BYTES - totalUsedBytes);
    const percentUsed = (totalUsedBytes / CLOUDFLARE_FREE_QUOTA_BYTES) * 100;

    return NextResponse.json({
      usedBytes: totalUsedBytes,
      totalBytes: CLOUDFLARE_FREE_QUOTA_BYTES,
      remainingBytes,
      percentUsed: Math.min(percentUsed, 100),
      configured: true,
    });
  } catch (error: any) {
    console.error('Lỗi khi tính quota Cloudflare R2:', error);
    return NextResponse.json(
      {
        usedBytes: 0,
        totalBytes: CLOUDFLARE_FREE_QUOTA_BYTES,
        remainingBytes: CLOUDFLARE_FREE_QUOTA_BYTES,
        percentUsed: 0,
        error: error.message,
        configured: false,
      },
      { status: 500 }
    );
  }
}

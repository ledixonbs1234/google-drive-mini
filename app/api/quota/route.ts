import { NextResponse } from 'next/server';
import {
  isR2Configured,
  PLAN_TYPE,
  R2_SAFETY_LIMIT_BYTES,
  HARD_CAP_ENABLED,
  getUsedStorageBytes,
} from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Luôn khóa cứng ở mức R2_SAFETY_LIMIT_BYTES (10 GB) khi HARD_CAP_ENABLED = true
    const totalBytes = HARD_CAP_ENABLED ? R2_SAFETY_LIMIT_BYTES : R2_SAFETY_LIMIT_BYTES;

    if (!isR2Configured) {
      return NextResponse.json({
        usedBytes: 0,
        totalBytes,
        remainingBytes: totalBytes,
        percentUsed: 0,
        configured: false,
        planType: PLAN_TYPE,
        totalObjects: 0,
        freeTierBytes: R2_SAFETY_LIMIT_BYTES,
        estimatedCostUsd: 0,
        hardCapEnabled: HARD_CAP_ENABLED,
        isLocked: false,
      });
    }

    const { usedBytes, totalObjects } = await getUsedStorageBytes();
    const remainingBytes = Math.max(0, totalBytes - usedBytes);
    const percentUsed = (usedBytes / totalBytes) * 100;
    const isLocked = HARD_CAP_ENABLED && usedBytes >= totalBytes;

    return NextResponse.json({
      usedBytes,
      totalBytes,
      remainingBytes,
      percentUsed: Math.min(percentUsed, 100),
      configured: true,
      planType: PLAN_TYPE,
      totalObjects,
      freeTierBytes: R2_SAFETY_LIMIT_BYTES,
      estimatedCostUsd: 0, // Khóa cứng ở 10 GB nên chi phí luôn là $0.00
      hardCapEnabled: HARD_CAP_ENABLED,
      isLocked,
    });
  } catch (error: any) {
    console.error('Lỗi khi tính quota Cloudflare R2:', error);
    return NextResponse.json(
      {
        usedBytes: 0,
        totalBytes: R2_SAFETY_LIMIT_BYTES,
        remainingBytes: R2_SAFETY_LIMIT_BYTES,
        percentUsed: 0,
        error: error.message,
        configured: false,
        planType: PLAN_TYPE,
        totalObjects: 0,
        hardCapEnabled: HARD_CAP_ENABLED,
        isLocked: false,
      },
      { status: 500 }
    );
  }
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Chỉ cảnh báo, không làm gián đoạn build production với các rule cũ
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Vẫn kiểm tra type an toàn
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

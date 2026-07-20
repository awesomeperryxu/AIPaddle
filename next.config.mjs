/** @type {import('next').NextConfig} */
// 预览部署可经 NEXT_BASE_PATH 挂在子路径（如 Crab 上的 /d1preview）；本地/CI 不设即无影响。
const basePath = process.env.NEXT_BASE_PATH || ''
const nextConfig = {
  ...(basePath ? { basePath } : {}),
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

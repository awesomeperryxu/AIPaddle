/** @type {import('next').NextConfig} */
// 预览部署可经 NEXT_BASE_PATH 挂在子路径（如 Crab 上的 /d1preview）；本地/CI 不设即无影响。
const basePath = process.env.NEXT_BASE_PATH || ''
// 构建输出目录可经 NEXT_DIST_DIR 覆盖（默认 .next）。部署加固用它把新构建产到临时目录
// （如 .next.new），校验完整后再原子切换为 .next，避免构建失败/中断把线上 .next 搞残。
const distDir = process.env.NEXT_DIST_DIR || '.next'
const nextConfig = {
  ...(basePath ? { basePath } : {}),
  ...(distDir !== '.next' ? { distDir } : {}),
  // ⚠️ standalone 暂不启用：pm2 + .env.local 的传递有坑（standalone 的 cwd 是
  // .next/standalone/，读不到项目根目录的 .env.local，所有环境变量丢失导致 500）。
  // 中间件快速路径和 cookie 修复不依赖 standalone，单独生效。
  // output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
// 预览部署可经 NEXT_BASE_PATH 挂在子路径（如 Crab 上的 /d1preview）；本地/CI 不设即无影响。
const basePath = process.env.NEXT_BASE_PATH || ''
// 构建输出目录可经 NEXT_DIST_DIR 覆盖（默认 .next）。部署加固用它把新构建产到临时目录
// （如 .next.new），校验完整后再原子切换为 .next，避免构建失败/中断把线上 .next 搞残。
const distDir = process.env.NEXT_DIST_DIR || '.next'
const nextConfig = {
  ...(basePath ? { basePath } : {}),
  ...(distDir !== '.next' ? { distDir } : {}),
  // standalone：只打包运行需要的文件，冷启动更快、内存占用更小
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

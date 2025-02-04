import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    images: {},
    productionBrowserSourceMaps: true, // TODO удалить перед релизом
    staticPageGenerationTimeout: 1000,
    output: 'standalone',
}

export default nextConfig

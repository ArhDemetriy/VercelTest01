import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    images: {},
    productionBrowserSourceMaps: true, // TODO удалить перед релизом
    staticPageGenerationTimeout: 1000,
    output: 'standalone',
    webpack(
        /** @type {import('webpack').Configuration} */
        config,
    ) {
        if (config.externals == null) config.externals = []
        if (!Array.isArray(config.externals)) config.externals = [config.externals]

        return config
    },
}

export default nextConfig

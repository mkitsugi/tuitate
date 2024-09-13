/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    distDir: process.env.BUILD_TARGET === 'azure' ? '.next' : 'out',
    async rewrites() {
        return [
            {
                source: '/:path*',
                destination: '/:path*',
            },
        ];
    },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    // distDir: 'out',
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

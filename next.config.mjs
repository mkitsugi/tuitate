/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    distDir: process.env.NODE_ENV === 'azure' ? '.next' : 'out',
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

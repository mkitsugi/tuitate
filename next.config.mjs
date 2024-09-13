/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    distDir: 'out',
    images: {
        unoptimized: true,
    },
};

export default nextConfig;

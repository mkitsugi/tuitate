import { SitemapStream, streamToPromise } from 'sitemap'
import { Readable } from 'stream'

export async function GET() {
    // サイトのURLリストを作成
    const links = [
        { url: '/', changefreq: 'monthly', priority: 1 },
        { url: '/app', changefreq: 'monthly', priority: 0.8 },
        // 他のページを追加
    ]

    // 動的なページがある場合、ここでデータベースからURLを取得して追加

    const stream = new SitemapStream({ hostname: 'https://kirishogi.com' })

    const xmlString = await streamToPromise(
        Readable.from(links).pipe(stream)
    ).then((data) => data.toString())

    return new Response(xmlString, {
        headers: {
            'Content-Type': 'application/xml',
        },
    })
}
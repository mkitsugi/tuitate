import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'アプリ',
}

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
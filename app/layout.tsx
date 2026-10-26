import type { Metadata } from 'next';
export const metadata:Metadata={title:'سعي بلس',description:'كل احتياجاتك وفرصك في مكان واحد'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}

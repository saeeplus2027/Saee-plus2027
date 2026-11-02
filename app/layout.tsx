import type { Metadata } from 'next';

const siteUrl = 'https://saeeplus2027.github.io/Saee-plus2027/';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'سعي بلس | من جامعتك، إلى مجتمعك',
    template: '%s | سعي بلس',
  },
  description:
    'سعي بلس منصة تجمع الخدمات والخصومات والمشاريع والفرص الطلابية في الأردن في مكان واحد.',
  applicationName: 'سعي بلس',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ar_JO',
    siteName: 'سعي بلس',
    title: 'سعي بلس | خدمات وخصومات وفرص لطلاب الجامعات في الأردن',
    description:
      'اكتشف الخدمات والخصومات والمشاريع والفرص الطلابية في الأردن عبر سعي بلس.',
    url: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

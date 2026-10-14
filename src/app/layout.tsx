import type { ReactNode } from "react";
import RegisterSW from "./register-sw";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata = {
  title: "オフィスマップ ピン留め",
  manifest: `${BASE}/manifest.webmanifest`,
  icons: { icon: `${BASE}/icon-192.png`, apple: `${BASE}/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: "オフィスマップ", statusBarStyle: "default" as const },
};

export const viewport = { themeColor: "#0969da", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: "system-ui, 'Hiragino Sans', 'Yu Gothic', sans-serif", background: "#f4f5f7", color: "#1f2328" }}>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}

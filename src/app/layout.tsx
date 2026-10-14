import type { ReactNode } from "react";

export const metadata = { title: "オフィスマップ ピン留め" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: "system-ui, 'Hiragino Sans', 'Yu Gothic', sans-serif", background: "#f4f5f7", color: "#1f2328" }}>
        {children}
      </body>
    </html>
  );
}

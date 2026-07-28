import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "팬덤 리서치 대시보드",
  description: "유튜브 영상·댓글 기반 아티스트/브랜드 리서치 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

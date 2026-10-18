import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alveus",
  description: "Lung adenocarcinoma gene reports from public spatial, single-cell, GTEx, and TCGA data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

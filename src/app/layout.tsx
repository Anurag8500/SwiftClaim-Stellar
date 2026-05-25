import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { WalletProvider } from "@/contexts/WalletContext";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SwiftClaim - Zero Gas Web3 Neo-Bank",
  description: "Zero Gas. No Onboarding Walls. Just Borderless Value.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-zinc-950" suppressHydrationWarning>
        <WalletProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}

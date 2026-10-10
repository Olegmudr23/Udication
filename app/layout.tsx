import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Зубодоро · время сосредоточиться",
  description: "Уютный помодоро-таймер с зубом: фокус, перерывы и маленькие победы каждый день.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}

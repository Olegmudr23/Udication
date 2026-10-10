import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Зубодоро · время сосредоточиться",
  description: "Уютный помодоро-таймер с зубом: фокус, перерывы и маленькие победы каждый день.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){var theme;try{theme=localStorage.getItem('zubodoro.theme')}catch(e){}document.documentElement.dataset.theme=theme==='light'||theme==='dark'?theme:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()` }}/></head><body>{children}</body></html>;
}

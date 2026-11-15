import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Ai readiness assessment | Tenhaw Kit", description: "A local-first internal tool starter. Synthetic examples included. Your imported data stays in this browser.", robots: { index: false, follow: false } };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en-GB"><body>{children}</body></html>; }

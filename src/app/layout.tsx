import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "4CHMG2",
    description: "A multi-imageboard media aggregator tailored to kpop enjoyers",
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

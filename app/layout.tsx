import type { Metadata } from "next";
import { Geist, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// 1. Structural Font (Headers, Display)
const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist",
	display: "swap",
});

// 2. Body Font (Standard Text, Tables)
const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	variable: "--font-jakarta",
	display: "swap",
});

// 3. Telemetry Font (Numbers, Data, Code)
const jetbrains = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains",
	display: "swap",
});

export const metadata: Metadata = {
	title: "XAI Bank Lead Analyzer",
	description: "Predict Subscriptions. Understand Why.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geist.variable} ${jakarta.variable} ${jetbrains.variable}`}
		>
			<body className="bg-canvas text-primary font-body min-h-screen antialiased">
				{children}
			</body>
		</html>
	);
}

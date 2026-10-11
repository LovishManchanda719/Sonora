import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider as DescopeAuthProvider } from "@descope/nextjs-sdk";
import { AuthProvider } from "@/lib/auth-context";
import { AnalyticsTracker } from "@/lib/analytics";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://sonora-liart.vercel.app"
  ),
  title: {
    default:
      "Sonora | AI Motor Speech Screening & Vocal Rehabilitation (DysarthriaNet-XC)",
    template: "%s | Sonora Clinical Speech AI",
  },
  description:
    "Sonora is an AI speech research & educational platform for dysarthria acoustic pre-screening, motor speech disability awareness, and interactive vocal biofeedback (decibel loudness meter, digital pacing board, minimal contrast drills, and India RCI SLP center locator).",
  keywords: [
    "Sonora speech AI",
    "dysarthria detection",
    "motor speech disability",
    "AI speech screening",
    "dysarthria severity grading",
    "slurred speech test online",
    "Parkinson's speech therapy exercises",
    "ALS motor speech assessment",
    "neurological speech disorder awareness",
    "Wav2Vec 2.0 dysarthria classifier",
    "digital pacing board speech therapy",
    "vocal loudness decibel meter online",
    "minimal contrast word pair drills",
    "find a speech-language pathologist India",
    "DysarthriaNet-XC",
  ],
  authors: [{ name: "Lovish Manchanda & Sonora (DysarthriaNet-XC) Research Team" }],
  creator: "Lovish Manchanda",
  publisher: "Sonora Clinical Speech AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title:
      "Sonora | AI Dysarthria Detection & Motor Speech Rehabilitation",
    description:
      "Objective 3-step & extended 30s voice screening for dysarthria and motor speech disabilities powered by Wav2Vec 2.0 foundation models, plus free real-time speech therapy tools and Android app.",
    siteName: "Sonora",
    images: [
      {
        url: "/images/hero-consultation.png",
        width: 1200,
        height: 630,
        alt: "Sonora Clinical Motor Speech AI Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Sonora | AI Dysarthria Detection & Motor Speech Disability Screening",
    description:
      "Screen voice acoustics for dysarthria, practice motor speech rehabilitation drills, and locate nearest SLP centers on Web & Android.",
    images: ["/images/hero-consultation.png"],
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon.ico?v=2", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: "/icon.svg?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: "Sonora — Clinical Motor Speech AI (Powered by DysarthriaNet-XC)",
    description:
      "AI-assisted acoustic dysarthria detection, motor speech disability severity grading, and speech rehabilitation biofeedback suite.",
    medicalAudience: [
      { "@type": "MedicalAudience", audienceType: "Patient" },
      { "@type": "MedicalAudience", audienceType: "Speech-Language Pathologist" },
      { "@type": "MedicalAudience", audienceType: "Neurologist" },
    ],
    about: {
      "@type": "MedicalCondition",
      name: "Dysarthria (Motor Speech Disorder)",
      alternateName: [
        "Neurogenic Motor Speech Disability",
        "Slurred Speech",
        "Hypokinetic Dysarthria",
        "Spastic Dysarthria",
      ],
    },
  };

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#F4F7FB] text-[#14171A] pb-24 md:pb-0">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <DescopeAuthProvider
          projectId={
            process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID ||
            "P3KWVTtqHWyqAB1LbAh0ey4CH2nF"
          }
        >
          <AuthProvider>
            <AnalyticsTracker />
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-8 pt-4 sm:pt-8">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </DescopeAuthProvider>
      </body>
    </html>
  );
}

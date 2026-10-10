import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://dysarthrianet.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/screen",
        "/therapy",
        "/resources",
        "/about",
        "/contact",
        "/privacy",
        "/terms",
      ],
      disallow: ["/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

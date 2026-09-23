import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPublicShareData } from "@/lib/actions/share";
import { DocumentViewer, ExpiredLinkCard } from "@/components/forms/document-viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const reqHeaders = await headers();
  const host = reqHeaders.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = host ? `${protocol}://${host}` : process.env.BETTER_AUTH_URL || "http://localhost:3000";

  const ogImageUrl = `${origin}/brand/og-default.png`;

  return {
    title: "Shared document – Garden City Specialist Hospital",
    description: "Tap to view securely",
    robots: {
      index: false,
      follow: false,
    },
    referrer: "no-referrer",
    openGraph: {
      title: "Shared document – Garden City Specialist Hospital",
      description: "Tap to view securely",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "Garden City Specialist Hospital",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Shared document – Garden City Specialist Hospital",
      description: "Tap to view securely",
      images: [ogImageUrl],
    },
  };
}

export default async function PublicSharePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const data = await getPublicShareData(token);

  if (!data.valid) {
    return <ExpiredLinkCard />;
  }

  return (
    <DocumentViewer
      token={token}
      recordId={data.recordId}
      formType={data.formType}
      filename={data.filename}
      expiresAt={data.expiresAt}
      formDate={data.formDate}
      isPublic={true}
    />
  );
}

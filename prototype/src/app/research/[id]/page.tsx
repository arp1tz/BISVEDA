"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function ResearchRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    if (resolvedParams?.id) {
      router.replace(`/chat/${resolvedParams.id}`);
    } else {
      router.replace("/chat");
    }
  }, [router, resolvedParams]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin h-6 w-6 border-2 border-[#0B2A4A] border-t-transparent rounded-full" />
    </div>
  );
}

"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChatRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const newId = `c-${Date.now().toString(36)}`;
    const q = searchParams.get("q");
    if (q) {
      router.replace(`/chat/${newId}?q=${encodeURIComponent(q)}`);
    } else {
      router.replace(`/chat/${newId}`);
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin h-6 w-6 border-2 border-[#0B2A4A] border-t-transparent rounded-full" />
    </div>
  );
}

export default function ChatIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin h-6 w-6 border-2 border-[#0B2A4A] border-t-transparent rounded-full" />
        </div>
      }
    >
      <ChatRedirect />
    </Suspense>
  );
}

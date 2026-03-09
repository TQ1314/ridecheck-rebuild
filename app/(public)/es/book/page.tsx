"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SpanishBookRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/book?lang=es");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-muted-foreground">Redirigiendo...</p>
    </div>
  );
}

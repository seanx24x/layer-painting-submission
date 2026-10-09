"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveTechniqueLocation } from "@/lib/technique-navigation";
export function LegacyTechniqueRedirect({ from, material }: { from?: string; material?: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(resolveTechniqueLocation({ hash: window.location.hash, from, material }).href); }, [router, from, material]);
  return <p role="status">Opening your technique study…</p>;
}

"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyMessageButton({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button onClick={handleCopy} size="sm" type="button" variant="secondary">
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy Message"}
    </Button>
  );
}

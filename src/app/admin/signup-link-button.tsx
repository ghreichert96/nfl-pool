"use client";

import { useState } from "react";

export function SignupLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/signup`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="control-pressed min-h-11 w-full rounded-lg border px-3 text-xs font-black"
    >
      {copied ? "SIGNUP LINK COPIED" : "COPY PUBLIC SIGNUP LINK"}
    </button>
  );
}

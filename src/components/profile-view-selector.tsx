"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { startNavigation } from "./navigation-progress";

const views = [
  ["entry", "Entry"],
  ["settings", "Settings"],
  ["submissions", "Submission Log"],
] as const;

export type ProfileView = (typeof views)[number][0];

export function ProfileViewSelector({ view }: { view: ProfileView }) {
  const router = useRouter();
  const [pending, setPending] = useState<ProfileView | null>(null);
  return (
    <select
      aria-label="Profile section"
      value={pending ?? view}
      onChange={(event) => {
        const next = event.target.value as ProfileView;
        setPending(next);
        startNavigation();
        router.push(`/account?section=${next}`);
      }}
      className="control-raised min-h-9 max-w-32 rounded-md border px-2 text-xs font-black uppercase"
    >
      {views.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

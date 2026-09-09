"use client";

import { useState } from "react";

import { PhoneInput } from "@/components/phone-input";

import { signUp } from "./actions";

export function SignupForm({ error }: { error?: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const matches =
    password.length >= 6 &&
    confirmation.length >= 6 &&
    password === confirmation;

  return (
    <form action={signUp} className="mt-5 grid gap-3">
      <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
        />
      </label>
      <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
        <span>
          Phone{" "}
          <small className="text-[9px] text-slate-500">(numbers only)</small>
        </span>
        <PhoneInput
          placeholder=""
          className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
        />
      </label>
      <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
        <span>
          Entry name{" "}
          <small className="text-[9px] text-slate-500">(max 4 chars)</small>
        </span>
        <input
          name="entry_code"
          minLength={3}
          maxLength={4}
          pattern="[A-Za-z]{3,4}"
          autoCapitalize="characters"
          required
          className="control-raised min-h-12 rounded-lg border px-3 text-base uppercase"
        />
      </label>
      <PasswordField
        id="signup-password"
        label="Password"
        name="password"
        value={password}
        visible={showPassword}
        valid={matches}
        onChange={setPassword}
        onToggle={() => setShowPassword((value) => !value)}
      />
      <PasswordField
        id="signup-confirmation"
        label="Confirm password"
        name="confirmation"
        value={confirmation}
        visible={showConfirmation}
        valid={matches}
        onChange={setConfirmation}
        onToggle={() => setShowConfirmation((value) => !value)}
      />
      {error && (
        <p
          role="alert"
          className="rounded bg-amber-950 p-3 text-sm text-amber-200"
        >
          {error === "invalid"
            ? "Check the highlighted fields."
            : "Account creation failed."}
        </p>
      )}
      <button className="control-pressed min-h-12 rounded-lg border px-4 font-black">
        CREATE ACCOUNT
      </button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  name,
  value,
  visible,
  valid,
  onChange,
  onToggle,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  visible: boolean;
  valid: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="grid gap-1 text-xs font-black uppercase text-slate-300">
      <label htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            name={name}
            type={visible ? "text" : "password"}
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
            required
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="control-raised min-h-12 w-full rounded-lg border px-3 pr-12 text-base normal-case"
          />
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              visible
                ? `Hide ${label.toLowerCase()}`
                : `Show ${label.toLowerCase()}`
            }
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400"
          >
            <EyeIcon crossed={visible} />
          </button>
        </div>
        <span
          aria-label={valid ? "Passwords match" : undefined}
          className={`grid size-6 shrink-0 place-items-center rounded-full text-sm font-black ${valid ? "bg-emerald-500 text-slate-950" : "invisible"}`}
        >
          ✓
        </span>
      </div>
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {crossed && <path d="m4 4 16 16" />}
    </svg>
  );
}

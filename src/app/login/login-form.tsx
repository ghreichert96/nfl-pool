"use client";

import Link from "next/link";
import { useState } from "react";

import {
  requestMagicLink,
  requestPasswordReset,
  signInWithPassword,
} from "./actions";

export function LoginForm({
  invalidCredentials = false,
}: {
  invalidCredentials?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={signInWithPassword} className="mt-5 space-y-3">
      <label
        htmlFor="password-identifier"
        className="block text-xs font-black uppercase tracking-wide text-slate-300"
      >
        Email or entry name
      </label>
      <input
        id="password-identifier"
        name="identifier"
        type="text"
        autoComplete="username"
        required
        className="min-h-12 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-base outline-none focus:border-slate-200"
      />
      <label
        htmlFor="password"
        className="block text-xs font-black uppercase tracking-wide text-slate-300"
      >
        Password
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          minLength={6}
          required
          className="min-h-12 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 pr-12 text-base outline-none focus:border-slate-200"
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400"
        >
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
            {showPassword && <path d="m4 4 16 16" />}
          </svg>
        </button>
      </div>
      {invalidCredentials && (
        <p role="alert" className="text-sm text-amber-300">
          That email, entry name, and password combination was not recognized.
        </p>
      )}
      <button
        type="submit"
        className="control-pressed min-h-12 w-full rounded-lg border px-4 font-black"
      >
        SIGN IN
      </button>
      <div className="grid grid-cols-3 gap-1.5">
        <Link
          href="/signup"
          className="control-raised grid min-h-12 place-items-center rounded-lg border px-1 text-center text-[10px] font-black leading-tight"
        >
          SIGN UP
        </Link>
        <button
          type="submit"
          formAction={requestMagicLink}
          formNoValidate
          className="control-raised min-h-12 rounded-lg border px-1 text-[10px] font-black leading-tight"
        >
          EMAIL SIGN-IN LINK
        </button>
        <button
          type="submit"
          formAction={requestPasswordReset}
          formNoValidate
          className="control-raised min-h-12 rounded-lg border px-1 text-[10px] font-black leading-tight"
        >
          FORGOT PASSWORD
        </button>
      </div>
    </form>
  );
}

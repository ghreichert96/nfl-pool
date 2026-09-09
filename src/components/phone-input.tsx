"use client";

import { useState } from "react";

import { sanitizePhoneInput } from "@/features/auth/phone";

export function PhoneInput({
  defaultValue = "",
  className,
}: {
  defaultValue?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <input
      name="phone"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      required
      value={value}
      onChange={(event) => setValue(sanitizePhoneInput(event.target.value))}
      placeholder="+14344090768"
      className={className}
    />
  );
}

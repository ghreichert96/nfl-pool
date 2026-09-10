"use client";

import { useState } from "react";

import { sanitizePhoneInput } from "@/features/auth/phone";

export function PhoneInput({
  defaultValue = "",
  className,
  placeholder = "+14344090768",
}: {
  defaultValue?: string;
  className?: string;
  placeholder?: string;
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
      placeholder={placeholder}
      className={className}
    />
  );
}

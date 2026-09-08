import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LoginPage from "./page";

afterEach(cleanup);

describe("LoginPage", () => {
  it("accepts email or abbreviation and offers all self-service methods", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByLabelText(/email or entry abbreviation/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeVisible();
    expect(screen.getByText("FORGOT PASSWORD?")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "EMAIL PASSWORD RESET" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "EMAIL SIGN-IN LINK" }),
    ).toBeVisible();
  });

  it("shows password-recovery delivery feedback", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ recovery_sent: "1" }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Check your email for a password-reset link.",
    );
  });
});

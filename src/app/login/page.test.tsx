import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LoginPage from "./page";

afterEach(cleanup);

describe("LoginPage", () => {
  it("accepts email or abbreviation and offers all self-service methods", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByLabelText(/email or entry name/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeVisible();
    expect(screen.getByRole("link", { name: "SIGN UP" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "FORGOT PASSWORD" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "EMAIL SIGN-IN LINK" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Show password" })).toBeVisible();
  });

  it("reveals and hides the entered password", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
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

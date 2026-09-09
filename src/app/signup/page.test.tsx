import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SignupPage from "./page";

afterEach(cleanup);

describe("SignupPage", () => {
  it("has blank identity fields and reveals matching passwords", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByLabelText(/phone/i)).toHaveAttribute("placeholder", "");
    expect(screen.getByLabelText(/entry name/i)).not.toHaveAttribute(
      "placeholder",
    );
    const password = screen.getByLabelText("Password");
    const confirmation = screen.getByLabelText("Confirm password");
    fireEvent.change(password, { target: { value: "secret" } });
    fireEvent.change(confirmation, { target: { value: "secret" } });
    expect(screen.getAllByLabelText("Passwords match")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("links to sign in when the account exists", async () => {
    render(
      await SignupPage({ searchParams: Promise.resolve({ exists: "1" }) }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Account already exists.",
    );
    expect(screen.getByRole("link", { name: "Sign in." })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

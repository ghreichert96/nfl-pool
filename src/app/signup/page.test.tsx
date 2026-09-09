import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SignupPage from "./page";

afterEach(cleanup);

describe("SignupPage", () => {
  it("collects the public enrollment fields", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Phone")).toBeRequired();
    expect(screen.getByLabelText("Entry name")).toHaveAttribute(
      "maxlength",
      "4",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "6");
    expect(
      screen.getByRole("button", { name: "CREATE ACCOUNT" }),
    ).toBeVisible();
  });
});

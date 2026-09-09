import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/account?section=settings");
}

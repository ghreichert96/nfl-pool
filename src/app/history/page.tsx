import { redirect } from "next/navigation";
export default function HistoryPage() {
  redirect("/account?section=submissions");
}

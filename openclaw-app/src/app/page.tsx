import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to chat page by default
  redirect("/chat");
}

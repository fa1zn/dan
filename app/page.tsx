import { redirect } from "next/navigation";

// Today is the rep's home. The old exec-style overview is cut from the rep experience
// (a manager view can live elsewhere later).
export default function Home() {
  redirect("/today");
}

import { redirect } from "next/navigation";

export default function PeoplePage() {
  redirect("/tracking?tab=people");
}

import { redirect } from "next/navigation";
import PickQuestions from "@/components/PickQuestions";
import SetupNeeded from "@/components/SetupNeeded";
import { pageUser } from "@/lib/page";

export const metadata = { title: "Help me pick · Movie Queue" };

export default async function PickPage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");
  return <PickQuestions />;
}

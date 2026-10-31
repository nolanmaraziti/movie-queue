import { redirect } from "next/navigation";
import PictureMaker from "@/components/PictureMaker";
import SetupNeeded from "@/components/SetupNeeded";
import { getPic } from "@/lib/avatars";
import { pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export const metadata = { title: "Make your picture · Movie Queue" };

// Make a profile picture by cutting a shape out of a movie poster.
export default async function PicturePage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");
  const [current, queue] = await Promise.all([getPic(user.username), getQueue(user.id)]);
  return <PictureMaker username={user.username} current={current} queue={queue} />;
}

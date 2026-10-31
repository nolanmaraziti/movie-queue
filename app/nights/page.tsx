import Link from "next/link";
import { redirect } from "next/navigation";
import NightsList from "@/components/NightsList";
import SetupNeeded from "@/components/SetupNeeded";
import TabBar from "@/components/TabBar";
import TmdbCredit from "@/components/TmdbCredit";
import { myNights } from "@/lib/nights";
import { navCounts, pageUser } from "@/lib/page";

export const metadata = { title: "Movie nights · Movie Queue" };

export default async function NightsPage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");
  const [{ upcoming, past }, counts] = await Promise.all([myNights(user.id), navCounts(user.id)]);

  return (
    <>
      <div className="app">
        <div className="top">
          <h1>Movie nights</h1>
          <Link className="pill hot" href="/nights/new">Plan one</Link>
        </div>
        <NightsList me={user.username} upcoming={upcoming} past={past} />
        <TmdbCredit />
      </div>
      <TabBar username={user.username} pending={counts.pending} nights={counts.nights} />
    </>
  );
}

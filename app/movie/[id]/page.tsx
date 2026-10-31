import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackIcon } from "@/components/icons";
import MovieActions from "@/components/MovieActions";
import Poster from "@/components/Poster";
import SetupNeeded from "@/components/SetupNeeded";
import TmdbCredit from "@/components/TmdbCredit";
import { friendsWithQueues } from "@/lib/friends";
import { pageUser } from "@/lib/page";
import { cleanPickToken, fitsFor, getSession, sessionState } from "@/lib/pick";
import { fmtRun, MAX } from "@/lib/queue";
import { getQueue } from "@/lib/serverQueue";
import { getDetails, TmdbError } from "@/lib/tmdb";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> };

export const metadata = { title: "Movie · Movie Queue" };

// A movie's profile: pictures, what it's about, who made it, why it fits your answers,
// which friends have it queued, and where to stream it.
export default async function MoviePage({ params, searchParams }: Props) {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let d;
  try {
    d = await getDetails(id);
  } catch (err) {
    if (err instanceof TmdbError && /404/.test(err.message)) notFound();
    throw err;
  }

  const token = cleanPickToken((await searchParams).s ?? "");
  const session = token ? await getSession(token) : null;
  const [queue, friends, state] = await Promise.all([
    getQueue(user.id),
    friendsWithQueues(user.id),
    session ? sessionState(session.id, user.id) : Promise.resolve(null),
  ]);
  const fits = session
    ? fitsFor(session.answers, {
        genreIds: d.genreIds, year: Number(d.movie.year) || 0, runtime: d.movie.runtime, votes: d.votes, rating: d.rating, language: "",
      }).filter((f) => !/English/.test(f.label))
    : [];
  const who = friends.filter((f) => f.queue.some((m) => m.id === d.movie.id)).map((f) => f.username);
  const back = session ? `/pick/${session.token}` : "/search";
  const pictures = d.stills.length ? d.stills : d.backdrop ? [d.backdrop] : [];

  return (
    <>
      <div className="app movie-page">
        <div className="movie-hero">
          {pictures.length > 0 ? (
            <div className="stills">
              {pictures.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={`https://image.tmdb.org/t/p/w780${p}`} alt="" loading="lazy" />
              ))}
            </div>
          ) : (
            <div className="movie-hero-poster"><Poster movie={d.movie} size="lg" /></div>
          )}
          <Link className="round over" href={back} aria-label="Back"><BackIcon /></Link>
          {pictures.length > 1 && <span className="stills-count">{pictures.length} pictures · swipe</span>}
        </div>

        <section className="movie-head">
          <h1>{d.movie.title} {d.movie.year && <span>{d.movie.year}</span>}</h1>
          <span className="tip">{[fmtRun(d.movie.runtime), d.certification, d.language, d.rating ? `★ ${d.rating.toFixed(1)} on TMDB` : ""].filter(Boolean).join(" · ")}</span>
          {d.genres.length > 0 && <div className="chips">{d.genres.map((g) => <span key={g} className="chipbtn static">{g}</span>)}</div>}
        </section>

        {d.overview && (
          <section className="block">
            <div className="label">About</div>
            <p className="about">{d.overview}</p>
          </section>
        )}

        {(d.director || d.cast.length > 0) && (
          <section className="two people">
            {d.director && <div><div className="label">Director</div><b>{d.director}</b></div>}
            {d.cast.length > 0 && <div><div className="label">Starring</div><b>{d.cast[0]}</b><small>{d.cast.slice(1, 3).join(", ")}</small></div>}
          </section>
        )}

        {fits.length > 0 && (
          <section className="block">
            <div className="label">Why it fits your answers</div>
            {fits.map((f) => (
              <div key={f.label} className={`fitrow${f.ok ? " ok" : ""}`}><span>{f.ok ? "✓" : "–"}</span>{f.label}</div>
            ))}
          </section>
        )}

        {who.length > 0 && (
          <section className="block">
            <div className="label">Your friends</div>
            <span className="tip">{who.map((u) => `@${u}`).join(", ")} {who.length === 1 ? "has" : "have"} it in their queue.</span>
          </section>
        )}

        <section className="block">
          <div className="label">Where to watch</div>
          {d.providers.length === 0 ? (
            <span className="tip">Not streaming on a subscription service in the US right now.</span>
          ) : (
            <div className="providers">
              {d.providers.map((p) => (
                <span key={p.name} className="provider">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.logo && <img src={`https://image.tmdb.org/t/p/w92${p.logo}`} alt="" />}
                  {p.name}
                </span>
              ))}
            </div>
          )}
          <small className="tip">Streaming info from JustWatch{d.providerLink && <>, via <a href={d.providerLink} target="_blank" rel="noopener noreferrer">TMDB</a></>}.</small>
        </section>

        <MovieActions
          movie={d.movie}
          session={session?.token}
          swiped={state?.mine[d.movie.id]}
          inQueue={queue.some((m) => m.id === d.movie.id)}
          full={queue.length >= MAX}
        />
        <TmdbCredit />
      </div>
    </>
  );
}

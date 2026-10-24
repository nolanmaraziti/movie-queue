// TMDB asks every app that uses its data to credit it like this.
// https://www.themoviedb.org/about/logos-attribution
export default function TmdbCredit() {
  return (
    <footer className="credit">
      <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="credit-mark">
        Powered by <b>TMDB</b>
      </a>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </footer>
  );
}

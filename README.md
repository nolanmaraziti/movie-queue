# Movie Queue

Your next ten movies, in order. Search any movie on The Movie Database (TMDB), add it to your queue, and drag to reorder. The #1 movie is "Up next". Your queue is saved in your browser.

## How it fits together

```
app/
  page.tsx              the main screen
  layout.tsx            page title and fonts
  globals.css           all the colors and styles
  api/search/route.ts   server only: searches TMDB with your secret token
  api/movie/[id]/       server only: looks up one movie's details
components/
  MovieQueue.tsx        header, queue, + button, and messages
  QueueList.tsx         the numbered list, drag to reorder, remove (×)
  SearchSheet.tsx       the "Add a movie" search panel
  Poster.tsx            TMDB poster, or a colored tile if there isn't one
  TmdbCredit.tsx        the "Powered by TMDB" credit
lib/
  tmdb.ts               the only file that uses your token (server only)
  queue.ts              saving to the browser, the 10-movie limit
.env.example            template for your secret settings
```

The browser never talks to TMDB directly. It asks this app's own server (`/api/search`), and only the server sends your token to TMDB. Your token never appears in the code the browser downloads.

## Run it on your computer

You need [Node.js](https://nodejs.org) version 20.9 or newer (pick the "LTS" download).

1. Open a terminal in this folder.
2. Install the building blocks (only needed once):
   ```
   npm install
   ```
3. Make your secret settings file. Copy `.env.example` to a new file called `.env.local`, open it, and paste your TMDB **API Read Access Token** after `TMDB_API_TOKEN=`. You can find the token at https://www.themoviedb.org/settings/api.
4. Start the app:
   ```
   npm run dev
   ```
5. Open http://localhost:3000 in your browser.

`.env.local` is listed in `.gitignore`, so it never gets uploaded to GitHub.

## Put it online with Vercel (free)

1. Sign in at https://vercel.com with your GitHub account.
2. Click **Add New → Project** and import the `movie-queue` repository.
3. Before clicking Deploy, open **Environment Variables** and add one:
   - Name: `TMDB_API_TOKEN`
   - Value: your TMDB API Read Access Token
4. Click **Deploy**. Every time new code is pushed to GitHub, Vercel updates the site automatically.

## Credit

This product uses the TMDB API but is not endorsed or certified by TMDB.

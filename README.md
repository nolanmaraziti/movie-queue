# Movie Queue

Your next ten movies, in order. Search any movie on The Movie Database (TMDB), add it to your queue, and drag to reorder. The #1 movie is "Up next".

Log in with a username and password and your queue is saved to your account, so it follows you to any device. Search for other people by username and send friend requests. Once they accept, you can see each other's queues, and movies you both have are tagged "You both".

## How it fits together

```
app/
  page.tsx              the main screen (or the log in screen if you're signed out)
  friends/page.tsx      find people, friend requests, your friends
  u/[username]/page.tsx a friend's queue, with "You both" tags
  layout.tsx            page title and fonts
  globals.css           all the colors and styles
  api/search/route.ts   server only: searches TMDB with your secret token
  api/movie/[id]/       server only: looks up one movie's details
  api/auth/             sign up, log in, log out
  api/queue/            saves your queue to your account
  api/users/search/     finds people by username
  api/friends/          send, accept, decline and remove friends
components/
  MovieQueue.tsx        header, queue, + button, and messages
  AuthForm.tsx          the log in / sign up form
  Nav.tsx               My queue / Friends / Log out row
  FriendsPanel.tsx      the search box and lists on the Friends page
  QueueList.tsx         the numbered list, drag to reorder, remove (×)
  SearchSheet.tsx       the "Add a movie" search panel
  Poster.tsx            TMDB poster, or a colored tile if there isn't one
  TmdbCredit.tsx        the "Powered by TMDB" credit
lib/
  tmdb.ts               the only file that uses your token (server only)
  db.ts                 connects to the database and creates the tables (server only)
  auth.ts               password hashing and staying signed in (server only)
  friends.ts            friend requests (server only)
  serverQueue.ts        reading and saving queues in the database (server only)
  queue.ts              the 10-movie limit, and the old browser-saved queue
.env.example            template for your secret settings
```

Passwords are never stored. The database keeps only a one-way scramble (a "hash") of each password, so even someone who could read the database couldn't see them. Staying signed in uses a cookie that the page's scripts can't read.

If someone used the app before accounts existed, the movies saved in their browser are copied into their account the first time they sign up or log in there.

The browser never talks to TMDB directly. It asks this app's own server (`/api/search`), and only the server sends your token to TMDB. Your token never appears in the code the browser downloads.

## Run it on your computer

You need [Node.js](https://nodejs.org) version 20.9 or newer (pick the "LTS" download).

1. Open a terminal in this folder.
2. Install the building blocks (only needed once):
   ```
   npm install
   ```
3. Make your secret settings file. Copy `.env.example` to a new file called `.env.local`, open it, and paste your TMDB **API Read Access Token** after `TMDB_API_TOKEN=`. You can find the token at https://www.themoviedb.org/settings/api.
   Also paste a database connection string after `DATABASE_URL=`. The easiest is to copy the one Vercel made for you: in your Vercel project, open **Storage**, click your Neon database, and copy the `DATABASE_URL` value. The app creates its tables by itself.
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
5. Add the database (free): in your Vercel project, open the **Storage** tab, click **Create Database**, pick **Neon** (Serverless Postgres), choose the free plan, and connect it to this project. Vercel adds the `DATABASE_URL` setting for you. Then redeploy (**Deployments → ⋯ → Redeploy**) so the site picks it up. The tables are created automatically on the first visit.

## Credit

This product uses the TMDB API but is not endorsed or certified by TMDB.

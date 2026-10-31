# Movie Queue

Your next ten movies, in order. Search any movie on The Movie Database (TMDB), add it to your queue, and drag to reorder. The #1 movie is "Up next".

Log in with a username and password and your queue is saved to your account, so it follows you to any device. Search for other people by username and send friend requests. Once they accept, you can see each other's queues, and movies you both have are tagged "You both".

The app has four tabs along the bottom: **Queue** (home), **Nights** (movie nights), **Friends** and **Profile**. Home shows your queue, open spots you can tap to fill, group invites, your group queues, and what each friend has up next. The search button at the top searches movies, cast and crew, people to add as friends, and your groups. Tap any friend to see their profile: their queue (with a + to copy a movie into yours), and the groups you're both in. Share your profile link and anyone who opens it can add you.

Movie nights: tap "Plan a night" on home (or "Plan one" on the Nights tab). Pick a movie club at someone's place or a theater screening, give it a name, date, time and place, and choose how the movie gets picked: guests vote on the top 3 of a queue, it's whatever is up next, or the host spins the wheel on the night. Invite friends and whole groups, then share the link with anyone else. People without an account can answer Going / Maybe / Can't go with just their name (and a phone number if they like). Signed-in guests can vote, write on the wall, and add the night to their calendar. A home address only shows to people who said they're going or maybe, and only the host sees phone numbers.

Can't decide? Tap "Help me pick" on home. Answer up to eight quick questions (who's watching, what kind of movie, decade, mood, length, well known or hidden gem, rating, subtitles), or skip straight to the movies whenever you like. You get a deck of about 20 movies from TMDB that fit, best fits first, skipping ones already in your queue. Swipe right to watch, left to pass, or tap the eye if you've seen it. Alone, a right swipe is a match. Tap Invite to send friends the link: everyone who opens it swipes the same deck, and a match is a movie everyone said yes to. From a match you can add it to your queue or plan a movie night with it. Tap any card (or a search result) for the movie's profile: pictures, what it's about, who made it, why it fits your answers, friends who have it queued, and where it's streaming.

Group queues are shared queues for you and your friends. From home, tap "Start a group", give it a name, then invite friends. Once they join, everyone in the group can add, move and remove movies, and each movie shows who added it. A group queue has ten slots too.

## How it fits together

```
app/
  page.tsx              home: your queue, invites, groups, friends' up next (or log in if signed out)
  search/page.tsx       search movies, cast & crew, people and your groups
  friends/page.tsx      the Friends tab: share your link, requests, everyone's queues
  u/[username]/page.tsx someone's profile: their queue, groups in common, or Add friend
  profile/page.tsx      the Profile tab: your numbers, up next, your groups, log out
  pick/page.tsx         "Help me pick": the questions
  pick/[token]/page.tsx swiping on a deck of movies, alone or with friends
  movie/[id]/page.tsx   a movie's profile
  nights/page.tsx       the Nights tab: upcoming, invites waiting on you, and past nights
  nights/new/page.tsx   plan a movie night
  n/[token]/page.tsx    a movie night's invitation (works for people without an account too)
  groups/page.tsx       start a group queue, answer invites, your groups
  groups/[id]/page.tsx  one group queue (members only)
  layout.tsx            page title and fonts
  globals.css           all the colors and styles
  api/search/route.ts   server only: searches TMDB with your secret token
  api/movie/[id]/       server only: looks up one movie's details
  api/auth/             sign up, log in, log out
  api/queue/            saves your queue to your account, or adds one movie to it
  api/search/people/    server only: searches TMDB for actors and filmmakers
  api/pick/             build a deck from your answers; save swipes and find matches
  api/nights/           plan a night; answer, vote, pick the movie, write on the wall, cancel
  api/users/search/     finds people by username
  api/friends/          send, accept, decline and remove friends
  api/groups/           make groups, invite, join, leave, and change a group's queue
components/
  MovieQueue.tsx        the home screen
  SearchScreen.tsx      the full search screen
  TabBar.tsx            Queue / Nights / Friends / Profile along the bottom
  Avatar.tsx            the round letter picture for each person
  GroupTile.tsx         a group's 2x2 poster picture, as a tile or a row
  FriendButton.tsx      Add friend / Accept / Friends on a profile
  AddToQueueButton.tsx  the + next to a friend's movie
  ShareButton.tsx       shares or copies a link (your profile, or a movie night)
  PlanNight.tsx         the "New movie night" form
  NightView.tsx         a night's page for signed-in people
  GuestInvite.tsx       a night's page for people without an account
  NightsList.tsx        the Upcoming / Invites / Past lists
  NightRow.tsx          one night in a list, with its date block
  NightInviteCard.tsx   the "You're invited" card with Going / Maybe / Can't go
  RsvpButtons.tsx       Going / Maybe / Can't go
  PickQuestions.tsx     the "Help me pick" questions, one at a time
  SwipeDeck.tsx         the card stack, swiping, and the "It's a match" screen
  MovieActions.tsx      the buttons along the bottom of a movie's profile
  AuthForm.tsx          the log in / sign up form
  FriendsPanel.tsx      the search box and lists on the Friends page
  GroupsPanel.tsx       the new-group box, invites and group list on the Groups page
  GroupQueue.tsx        a group's queue, members and invite buttons
  JoinButton.tsx        "Join group" on a group you're invited to
  QueueList.tsx         the numbered list, drag to reorder, remove (×)
  SearchSheet.tsx       the "Add a movie" search panel
  Poster.tsx            TMDB poster, or a colored tile if there isn't one
  TmdbCredit.tsx        the "Powered by TMDB" credit
lib/
  tmdb.ts               the only file that uses your token (server only)
  db.ts                 connects to the database and creates the tables (server only)
  auth.ts               password hashing and staying signed in (server only)
  friends.ts            friend requests (server only)
  groups.ts             group queues, members and invites (server only)
  nights.ts             movie nights, RSVPs, votes and the wall (server only)
  when.ts               shows a night's date and time in the host's time zone
  questions.ts          the "Help me pick" questions and what each answer means
  pick.ts               turns answers into a deck of movies, and runs swipe rounds (server only)
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

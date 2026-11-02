# The London Table

A production-ready responsive, Instagram-inspired London restaurant guide made from lightweight HTML, CSS and JavaScript. No sample restaurants, fake ratings, fake likes, or demo database are published. This repo deploys to GitHub Pages through GitHub Actions.

**Website:** https://stepzach.github.io/the-london-table/ (available after enabling GitHub Pages)

## Deployment: GitHub Pages

1. Open **Settings → Pages** in this repository, select **Build and deployment → Source: GitHub Actions**. The deploy workflow is already committed and runs on pushes to `main`.
2. Open **Actions → Deploy website to GitHub Pages** to check deployment. Once configured, the workflow publishes the site automatically after each push to `main`. You can also use **Run workflow** after changing the GitHub secrets.
3. The first deployment may show an empty feed, deliberately: the production `CONTENT.posts` array contains no fabricated reviews.

A repo administrator must enable Pages in the repository settings; source code cannot do that. This workflow does not require Firebase to publish the static site.

## Firebase setup (likes, comments, total likes)

Create a Firebase project on the **Spark (no-cost)** tier, register a **Web app**, create **Cloud Firestore**, and enable **Authentication → Sign-in method → Anonymous**. Under **Authentication → Settings → Authorized domains**, make sure `stepzach.github.io` is permitted. In Firestore **Rules**, publish the contents of `firestore.rules` from this repository (do **not** use open test-mode rules). These are one-time Firebase Console steps; GitHub repository secrets alone do not enable Auth, create Firestore or publish rules.

In this repository open **Settings → Secrets and variables → Actions → New repository secret**. Add all four **Repository secrets** using the values from Firebase Console → Project settings → Your apps → Web app:

| Secret name | Value from the Firebase Web App config |
| --- | --- |
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_APP_ID` | `appId` |

After adding secrets, **Actions → Deploy website to GitHub Pages → Run workflow**, or push a new commit to `main`.

**Important:** These four values are *Firebase web app configuration*, not service account credentials; they are publicly visible in the deployed JavaScript by design. Never add admin credentials or private service-account JSON to this site. Access control relies on `firestore.rules`. The build refuses partially configured values and creates a valid, inert config when none are set. Until Firebase is connected, no real likes or comments are recorded; there is **no fake local demo fallback**.

If you use an API key restricted by HTTP referrer, include your deployed origin. Free-tier quotas apply, and anonymous authentication does not prevent spam by a motivated attacker. Monitor traffic/usage and consider App Check and moderation before broad promotion.

## Publish a real restaurant

Open `script.js` → `CONTENT.posts` (currently `[]`). Add a real review object in the array. Example shape (documentation only, **not** shown as a restaurant on the site):

```js
{
  id: 'unique-permanent-restaurant-id',
  name: 'Real restaurant name',
  foodType: 'Italian · Pasta',
  priceRange: '££',
  location: 'Soho, London',
  nearestTube: 'Tottenham Court Road',
  rating: 4.5, // out of 5
  category: 'italian',
  tags: ['date-night'],
  description: 'Your actual review goes here.',
  date: '2026-11-02',
  websiteUrl: 'https://restaurant.example',
  mapEmbedUrl: 'https://www.google.com/maps/embed?pb=...',
  images: [
    { url: 'https://your-image-host/restaurant.jpg', alt: 'Restaurant interior' },
    { url: 'https://your-image-host/food.jpg', alt: 'Food on the table' },
    { url: 'https://your-image-host/receipt.jpg', alt: 'Receipt, personal details hidden' }
  ]
}
```

Use your **real** restaurant details and real photo URLs before committing. The first image is the grid cover; the remaining two appear in the carousel. `mapEmbedUrl` is the iframe `src` copied from Google Maps → Share → Embed a map. Any missing photos show a neutral unavailable state, not invented sample imagery.

**Do not reuse or change an existing post `id`** after visitors have liked or commented. Firestore interactions are stored under `/posts/{postId}/likes/{uid}` and `/posts/{postId}/comments/{commentId}`. Removing a post from `CONTENT.posts` immediately removes it from the grid and its likes from the displayed profile total; it does not automatically delete its Firestore subcollections. If necessary, delete orphaned data separately in Firebase Console.

## Profile image / counts

Change `CONTENT.profile.avatarUrl` in `script.js` **once** to update the large profile photo and the smaller review-author avatar everywhere. The initial value is the associated GitHub account's avatar URL. Profile post count comes from the number of published entries. The total likes counter sums Firestore count aggregations for each currently published post. Totals are refreshed on initial page load, after closing a post and on tab re-entry; live listeners track likes/comments on the currently open restaurant. If Firebase isn't configured, the like total displays a dash (unless there are zero posts).

Saved restaurants are stored locally in each visitor's browser; no Firebase collection is needed for bookmarks.

## Local build / checks

To preview the exact GitHub Pages artifact, run:

```bash
python3 scripts/build.py
python3 -m http.server 8000 --directory dist
```

Then visit `http://localhost:8000/`. To test Firebase locally, provide the four `FIREBASE_*` environment variables when running `scripts/build.py`. You can also run `node --check script.js` for syntax validation.

## Security and accessibility

- Firestore rules require signed-in anonymous auth for creating likes and comments; each auth UID can like a post once and can delete only its own likes/comments.
- Comment author and text lengths are checked by Firestore rules. Dynamic content is rendered with `textContent` rather than unsafe HTML.
- Keep identifiable information off receipt photos.
- There are no visitor accounts or fake engagement counters; the only persistent browser data is saved places and an optional saved comment-display name.
- Interactions support mouse, touch, keyboard and small screens.

This guide is an independent, Instagram-inspired website, not associated with Instagram.
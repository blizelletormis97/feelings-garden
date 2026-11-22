# Feelings Garden

A gentle daily check-in app. Pick how you feel, say how big the feeling is and what it is about, do a calm activity
made for that feeling, and a flower grows in your garden for each day:

| Feeling | Activity made for it |
|---|---|
| Angry | Squeeze the ball tight, then let go |
| Worried | Put the worry in a jar (the words are never saved) |
| Sad | Kind words, then a hug |
| Tired | A gentle stretch |
| Happy, Okay | Pick 3 things that make you happy |
| Calm | Notice 5, 4, 3, 2, 1 things around you |

Breathing with the flower and popping bubbles are there for every feeling. "My feelings this week" shows the last
seven days, and "Learn about feelings" explains what each feeling can feel like in the body and what helps.

"My diary" has writing prompts that match the day's feeling, tap-to-start sentences and stickers. Pages can be
filtered by feeling, edited, deleted, and downloaded as a text file. Like the garden, the diary is kept only on the
device (browser storage) and is never sent anywhere.

## Premium (preview)

A "Feelings Garden Premium" section for grown-ups describes a planned subscription ($2.99 a month or $24.99 a year).
**Subscriptions are not open yet and no payment is taken**: the Subscribe button is disabled, and a free "Premium
preview" switch (saved on the device) unlocks the Premium features so they can be tried:

- Garden themes (beach, snow with falling snow, space), a bonus sticker pack and the "Shake it out" activity
- Feelings report: monthly counts, patterns (topics, hardest weekday) and a print view; diary words are never included
- Backup: save and restore a backup file of everything (cloud sync is marked "coming soon")
- Family: a separate garden, diary and friends for each child (stored under keys ending in `:<child id>`)

To take real payments later, connect a payment provider (for example Stripe Checkout plus a small server or Cloudflare
Worker that confirms who is subscribed) and replace the preview switch with that check. Made to be easy for everyone: big buttons, a very readable font,
no timers, no scores and no ways to fail.

## Install it

Open the app's address in your phone's browser:

- **iPhone / iPad:** open it in **Safari**, tap **Share** (the square with an arrow), then **Add to Home Screen**, then
  **Add**. It gets its own flower icon and launch screen and opens full screen.
- **Android (Chrome):** tap **Install app** on the page, or the menu **⋮ → Install app**.
- **Computer (Chrome / Edge):** click the install icon in the address bar.

It then opens full screen from its own icon and works offline.

## Privacy

The garden is saved only on the device (browser storage). Nothing is sent anywhere. Clearing the browser's website
data, or deleting the app, removes the garden.

## How it's built

A single page with no build step:

| File | What it is |
|---|---|
| `index.html` | The app (HTML, CSS and JavaScript) |
| `garden3d.js` | The 3D garden, drawn with [three.js](https://threejs.org): flowers, butterflies, a hiding ladybug, a watering cloud, and a sun or moon-and-stars sky that follows the bright or dark theme. Devices without WebGL get the flat garden |
| `vendor/` | three.js r160 (MIT license, see `vendor/three-LICENSE.txt`), kept here so the app works offline |
| `manifest.webmanifest` | App name, colors and icons for installing |
| `sw.js` | Service worker that keeps the app working offline; bump `VERSION` after changing files |
| `icons/` | App icons (pastel flower on mint); `icons/splash/` holds the iPhone launch screens |
| `.github/workflows/pages.yml` | Publishes the app to GitHub Pages on every push to `main` |

It is published at **https://blizelletormis97.github.io/feelings-garden/**.

One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source** and choose
**GitHub Actions**.

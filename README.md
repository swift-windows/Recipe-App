# Recipe Box

A recipe app for Sean & Liv. The box starts empty: each of you answers a 12-question
questionnaire (diet, allergies, dislikes, cuisines, spice, time, confidence, goals, favourite meal),
and the app then fills the box from a library of 46 recipes picked to suit you.

- **💛 Both of you**: recipes that genuinely appeal to you both. **⭐ Sean's / Liv's pick**: ones one of you will love and the other can still eat.
- Allergies are hard exclusions for everyone. Diet and dislikes are per person.
- Each recipe explains *why it's in your box*.
- Servings scaler, favourites, search and filters, "What's for tea?" random pick, cooking mode with timers, and a merged shopping list.
- Change answers or rebuild any time from **Our tastes**. Your own uploaded recipes are never touched by a rebuild.

Open `index.html` in a browser (or serve the folder). Everything is saved in the browser on that device.

## Sharing between phones

Open the app with `?box=<code>` on the end of the link and `sync.js` mirrors everything (answers, recipes,
favourites, basket) to the Worker, so each person can use their own phone. Answers merge per person, so two
phones filling in at once never overwrite each other. Answers already on a phone are sent up the first time
it opens the shared link.

`worker/worker.js` is the Cloudflare Worker: it serves the app files from KV and stores each box in D1
(`worker/schema.sql`).

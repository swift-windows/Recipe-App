# Recipe Box

A recipe app for Sean & Liv. The box starts empty: each of you answers a 12-question
questionnaire (diet, allergies, dislikes, cuisines, spice, time, confidence, goals, favourite meal),
and the app then fills the box from a library of 99 recipes picked to suit you.

51 of those are Sean's dinners (`always: true` in `library.js`): they go in the box whatever the questionnaire
says, though a ticked allergy still keeps one out. New ones are added to an already-built box the next time the
app opens, so there's no need to rebuild, and anything you've binned stays binned.

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

## Recipe photos

Each library recipe has a photo at `img/<recipe id>.jpg`, served by the Worker from KV. They're AI-generated
(Cloudflare Workers AI, `@cf/black-forest-labs/flux-2-klein-4b`, 640×480; Sean's dinners use
`@cf/black-forest-labs/flux-1-schnell`, 1024×1024) from the prompt:
"Professional food photography of {title}. {blurb} Plated and ready to eat, natural window light, 45 degree angle,
shallow depth of field, appetising, photorealistic, no text, no people." Your own uploaded photo always wins, and
the emoji shows if a picture fails to load.

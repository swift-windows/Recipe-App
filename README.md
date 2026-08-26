# Swift Survey

An on-site survey app for Swift Windows. You draw the window, write the sizes, and it
produces a report that Claude reads and enters into Tommy Trinder (Framepoint) for you.

Works offline, on a phone, from the customer's hallway.

---

## The idea

A photo of a scribbled sketch makes Claude *guess*: which way the hinges go, which light
is fixed, whether that dashed line is lead or an opener. A guess costs a remake.

So in this app **the drawing is the data**. You tap a light to say how it opens, and the
elevation on screen redraws with the proper surveyor symbol. Nothing has to be
interpreted afterwards, because nothing was ever ambiguous — the report comes out with
exact pane positions, hinge hands and glass specs, plus the VS2 build steps to enter them.

---

## Using it on site

1. **New survey** — customer name, address, and the job-wide spec (finish, cill, handles)
   once, so you are not retyping it per window.
2. **Add window or door** — pick the product. It matches the Tommy Trinder catalogue, so
   `uPVC Casement` here is `*uPVC Casement` on the PVCu tab there.
3. **Draw it:**
   - **＋ Mullion** adds a vertical bar.
   - **＋ Transom** adds a fanlight across every section.
   - Tap a single light → **Add fanlight above** for a partial transom (a fanlight over
     the outer lights only, which is the common case).
   - **Auto-configure** applies the standard surveyor assumption for that shape — three
     sections become opener / fixed / opener, a cruciform gets fixed fanlights over
     opening lights. Anything it assumes is flagged `[assumed]` in the report so it gets
     confirmed rather than ordered on a guess.
4. **Tap a light** to set how it opens (side-hung left/right, top-hung, bottom-hung, tilt
   & turn, dummy, fixed) and its glass (obscure pattern, toughened, leaded, glazing bars,
   trickle vent).
5. **Sizes** — width and height in mm. This is the **Basic Frame Size**, the frame only;
   a 150mm cill adds about 30mm to the overall height and must not be included.
6. **Photos** — tap Add photo. They are shrunk on device and stored locally.
7. **Report** → **Share** or **Copy report**.

Then send it to Claude and say **"quote this up in Tommy Trinder"**.

### What it checks before you leave

The report screen lists anything that would stall the quote:

- missing width, height or location
- a door with no handing, a bi-fold with no fold direction, a bay with no facet widths
- glazing in a critical location (a door, or a cill under 800mm from floor) with no
  toughened glass specified — Approved Document K
- a frame with no opening sash at all
- duplicate item references

None of it blocks sending. Everything unanswered is carried through as a **query**, so
the quote is never built on an invented measurement.

---

## What the report contains

One Markdown file, three layers:

1. **A survey report** in the block format the `read-window-drawings` skill expects —
   `Ref / Room / Width / Height / Window Type / Configuration / Glass Specification /
   Special Features / Assumptions Made / Queries`.
2. **A build plan.** Identical frames are grouped automatically, so the quote is built
   the fast way: build one, hit the duplicate icon, rename. On a typical job a third to
   a half of the frames repeat.
3. **A JSON payload** (`swift-survey/v1`) with the exact structure — every pane, its VS2
   pane name (`upperTransomPane0`, `fullMullionPane1`…), the opener tile to click in the
   "Opener at Pane X" dialog, and the glass spec.

Each item also carries collapsed **build steps**, written against the real VS2 workflow:
which tab, which product image, expected pane count before confirming, which dialog tile
gives a hinge-right sash, `Apply to All` when the glass is uniform, and the Auto Grid
step that glazing bars need in order to actually draw.

Where the pane naming is not predictable — three or more sections stacked in one column —
it says so rather than inventing a name.

See [`docs/example-report.md`](docs/example-report.md) for a full worked example —
that is exactly what Claude receives.

---

## Installing it on the phone

Open the hosted URL, then **Add to Home Screen**. It installs as an app, runs full
screen, and works with no signal: everything is cached, surveys save as you type.

Surveys live **on the device only**. Nothing is uploaded unless you press Share, Email,
or configure a Post endpoint in Settings. Use **Settings → Export all surveys** for a
backup before changing phone or clearing browser data.

---

## Hosting

Any static host will do — the app has no backend.

- **GitHub Pages:** enable Pages on this repo and point it at the branch root.
- **Swift Hub:** `npm run build` produces `dist/survey.html`, a single self-contained
  file. Write it to KV as a tool and it serves at `/tools/<slug>`:

  ```bash
  curl -s -X PUT ".../storage/kv/namespaces/$NS/values/tool:survey" \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: text/plain" \
    --data-binary @dist/survey.html
  ```

- **No host at all:** open `dist/survey.html` from the phone's files. It works from
  `file://`.

### Sending straight to the Hub (optional)

Settings has a **Post endpoint** field. Leave it blank and nothing ever leaves the phone
automatically. Set it to a URL that accepts `POST {markdown, payload}` and the report
screen gains a **Send to Swift Hub** button — that is the hook for a fully hands-off
pipeline once there is an endpoint to receive it.

---

## Development

```bash
npm test      # 31 assertions over the model and report generator
npm run build # bundle to dist/survey.html
npm run serve # http://localhost:8080
```

No dependencies and no build step for development — `index.html` loads the ES modules
directly.

### Layout

| File | Purpose |
|---|---|
| `js/model.js` | Data model, catalogue, surveyor assumptions, Building Regs checks. Pure. |
| `js/report.js` | Markdown report, JSON payload, VS2 build steps. Pure. |
| `js/elevation.js` | Draws the frame as an SVG elevation with survey symbols. |
| `js/editor.js` | The on-site item screen. |
| `js/app.js` | Screens and routing. |
| `js/store.js` | localStorage for surveys, IndexedDB for photos. |
| `js/share.js` | Share / copy / download / email / post. |
| `build.js` | Bundles everything into one HTML file. |
| `tools/selftest.mjs` | Test suite. Runs under plain node. |
| `tools/example.mjs` | Regenerates `docs/example-report.md`. |

`model.js` and `report.js` are deliberately free of browser APIs so the logic that
decides what gets ordered is testable without a browser.

### The frame model

A frame is **columns** (split by mullions), each holding **rows** (split by transoms).
Transoms are per column, not per frame, because a transom over only some lights is the
normal case and is what VS2 makes you draw as separate partial transoms.

```
columns: [ {rows:[fanlight, light]}, {rows:[light]}, {rows:[fanlight, light]} ]
          left: 2 panes             centre: 1        right: 2 panes      = 5 panes
```

That count is what the build steps tell you to verify on the VS2 canvas before
confirming, because bars cannot be added after the green tick.

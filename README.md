# Swift Windows — Quoting

A quoting tool for Swift Windows Limited. You configure a frame, it draws a
proper scaled elevation, and it turns the job into an A4 quotation you can
print or save as a PDF.

No install, no server, no account. Open `index.html` in a browser and it runs.

## Running it

Double-click `index.html`, or drag it into Chrome. Everything is saved in that
browser's local storage, so it stays on the machine you use it on.

**Back it up.** Clearing browsing data wipes it. Quotes → *Export backup*
writes a single JSON file with every quote, your price book and your settings;
*Import backup* puts it all back, on any machine.

## What it draws

Elevations are drawn to scale from the real millimetre sizes — the SVG viewBox
is in mm, so a 1200mm frame is 1200 units wide. Nothing is eyeballed.

| Product | Notes |
|---|---|
| Casement window | Up to 6 lights across × 4 high, any mix of fixed and opening |
| Fixed light | Single unbroken pane |
| Vertical sliding sash | Two sashes, meeting rail, run-through horns, sash lifts |
| Residential door | Six leaf styles, sidelights, fanlight, letterplate, knocker |
| French doors | Matched pair, both opening |
| Patio slider | OX, XO, OXO, OXXO, XX — panes interlock as they really do |
| Bi-fold doors | 2–8 leaves, optional traffic door |
| Bay window | Any number of facets, with a dimensioned plan view |

Drawing conventions, all as used in the trade:

- Every elevation is **viewed from outside**.
- Opening lights carry a dashed **V with its apex on the hinge side**.
  Tilt & turn shows both actions.
- Frames and sashes are drawn as **mitred** members with lit and shaded faces,
  so they read as solid sections rather than flat outlines.
- Sashes sit proud of the frame with a shadow gap and a drop shadow.
- Sliding panes overlap at the interlock; bi-fold leaves hinge alternately.
- Woodgrain finishes get a grain overlay; obscure glass gets a real texture.

### Dimensions add up

This is the part worth knowing about. Light sizes are held as **real sightline
dimensions**, not proportions. Type 700 into the first light of a three-light
frame and the overall width changes to suit; change the overall width and the
light sizes rescale to fill it. Either way, the sub-dimensions on the drawing
plus the frame and mullions always total the overall dimension shown. A window
schedule where those two disagree is worse than no schedule at all.

### Bay geometry

Give it facet widths and corner angles and it walks the plan polyline to work
out the **projection from the wall** and the **structural opening**, then draws
a dimensioned plan under the elevation. A 600/1200/600 bay on 135° corners
projects 424mm into an opening of 2049mm — which is 600·sin45 and
1200 + 2·600·cos45, as it should be. The maths is checked in `test/checks.js`.

## Pricing

Three ways to price a line, mix and match within one quote:

1. **Type the price in** — for when you already know the number.
2. **Supplier cost + margin** — enter the Whiteline (or whoever) cost and a
   margin. Margin is taken **on the selling price**: £500 at 40% sells for
   £833.33, not £700. Getting that backwards is how you lose money on a job.
3. **From the price book** — m² rate, opener charge, glass uplift, finish
   uplift, fitting, minimum charge.

**The price book ships empty on purpose.** Every rate starts at zero. Nothing
in this app invents a price, a size or a specification for you — if a number
appears on a quote, you put it there.

Discount, VAT and deposit are applied at quote level. VAT defaults to the
price book rate and can be overridden per quote.

## The quote itself

A4 pages, laid out on screen exactly as they print. Letterhead with your
details and VAT number, customer and site address, a covering note, one block
per item with its drawing and specification, then a summary page with the
totals, terms and a signature panel. Company name, address, VAT number, sort
code and account number are pre-filled and printed on every page footer.

Print / PDF uses the browser's own print dialogue — choose *Save as PDF*.

## Settings

- **Company details** and your logo (upload the blue swallow JPEG once; it is
  stored in the browser and printed on every quote).
- **Profile sizes** — frame, sash, mullion, transom, bead, bar and cill face
  widths in mm. These change how chunky the drawings look so they match the
  system you quote on most. They do not affect pricing.
- **Standard terms** — one per line. The supplied wording is a starting point;
  check it against your own contracts before you send anything out.

## Checks

```
node test/checks.js
```

Covers the margin formula, quote totals, that light sizes reconcile with the
overall frame size, bay geometry against hand-worked trigonometry, areas and
opener counts, and that every product renders valid SVG with no NaN.

## Layout

```
index.html            app shell
js/draw/core.js       profiles, finishes, mitred members, glazing, hardware
js/draw/symbols.js    opening symbols, dimension lines
js/draw/window.js     grid frame renderer (casements, fixed lights)
js/draw/door.js       doors, sliders, bi-folds
js/draw/special.js    sash windows, bay elevation and plan geometry
js/draw/index.js      renderer dispatch, viewBox, descriptions
js/model.js           data model, pricing, storage
js/quotedoc.js        the A4 quote document
js/ui.js              form and list builders
js/app.js             state, routing, events
styles/app.css        application
styles/quote.css      the quote document and print rules
test/checks.js        numeric checks
```

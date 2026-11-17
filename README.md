# Food Dynasty Supermarket Website

A responsive website for **Food Dynasty Supermarket**, a family-owned grocery store at 1071 Bay St, Staten Island, NY. Built to replace the store's drag-and-drop site with a faster, clearer site that puts the supermarket (departments and weekly sales) first.

**Live site:** https://food-dynasty.github.io/Food-Dynasty-Website/

## Pages

| Page | What it does |
|---|---|
| Home | Hours, directions, tap-to-call, weekly deals and departments at a glance |
| Departments | Produce, meat, prepared foods and grocery, using real store photos |
| Weekly Sales | This week's ad uploaded by staff (falls back to the store's Key Food ad), coupons and app |
| Holiday Menu | Thanksgiving / Christmas / Easter dinner menu with a matching color theme; uploaded by staff, hidden when there isn't one |
| Buffet Menu | The daily hot buffet menu |
| Catering | Full catering menu (90+ items) with sticky jump links by category |
| About Us | Store story, hours and an embedded Google Map |

## Built with

- **HTML5**: semantic tags (`header`, `nav`, `main`, `section`, `article`, `footer`, `address`)
- **CSS3**: custom properties (variables), Flexbox, CSS Grid, media queries (mobile-first), `position: sticky`
- No frameworks or build tools

## Problems solved

- **Wrong and inconsistent info on the old site**: store hours differed across sources, footer social icons linked to the website builder's own accounts, and the catering menu still carried a previous store's name. All fixed.
- **Slow pages**: photos were 2–4 MB each. Resized and compressed them from 14.9 MB to 2.7 MB total (82% smaller).
- **Weekly sales that stay current with no upkeep**: Key Food's weekly ad can't be embedded in another site, so the site links to the store's permanent Key Food ad page, which always shows the current week.
- **Staff update the site without touching code**: the weekly ad and holiday menus are uploaded (PDF or photos) in the staff app; PDFs are turned into page pictures in the browser so they read well on phones, and `js/flyers.js` shows the newest one whose dates include today.
- **CSS specificity and rule-order bugs**, found and fixed while testing on phone and desktop widths.
- **Accessibility**: alt text on every image, one `h1` per page, keyboard-visible focus styles, `aria-current` on the active menu link.

## Run it locally

No install needed: open `index.html` in any browser.

## Credits

Store photos and logo © Food Dynasty Supermarket. Used with permission.

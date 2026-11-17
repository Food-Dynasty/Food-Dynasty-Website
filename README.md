# Food Dynasty Supermarket Website

The website for **Food Dynasty Supermarket**, a family-owned grocery store at 1071 Bay St, Staten Island, NY. I built it to replace the store's Wix site and to give customers a faster, clearer way to see hours, weekly deals and catering, and to order online.

**Live site:** https://fooddynastymarket.com
**Companion staff app:** [Food-Dynasty-orders](https://github.com/Food-Dynasty/Food-Dynasty-orders)

## Why I built it

The old site had problems that cost the store customers:
- the hours didn't match the store's own flyer
- the social icons linked to the website builder instead of the store
- the catering menu still showed the previous store's name
- there was no way to order online

On top of that, the weekly sales changed every week, and nobody at the store could update the site without paying for help.

## What it does

| Page | Purpose |
|---|---|
| Home | Hours, payment options, this week's free deals, the holiday dinner feature, ways to shop from home, store perks |
| Weekly Sales | This week's ad, uploaded by staff (falls back to the store's Key Food ad page) |
| Holiday Menu | Thanksgiving, Christmas or Easter dinner menu, themed per holiday; hidden when there isn't one |
| Order Catering Online | Full catering menu with a tray, live totals with NYC tax, pickup or delivery, and required side and pie choices for holiday dinners |
| Send Us Your Grocery List | Customers type a list and pick a delivery time; staff shop it and call with the total |
| Departments, Buffet, Catering, About | Store info, the daily buffet, the full catering menu, and a map |

Orders from the website go straight into the staff app. Nothing goes through email.

## Decisions I made (and why)

- **No framework, no build step.** It's plain HTML, CSS and JavaScript on GitHub Pages. Hosting is free and the pages load fast. Anyone the store hires later can open the files and understand them.
- **Staff update content from the app, not the code.** The weekly ad and holiday menus are uploaded as a PDF or photos. PDF pages are turned into images in the browser, because phones display images better than embedded PDFs. Every upload has start and end dates, so old deals come down on their own.
- **Orders go into a database, not an inbox.** My first version sent orders by email through a form service, and some of them never arrived. I switched to a Supabase database function that the website can only *add* orders to. It checks every field and limits each phone number to 5 orders a day.
- **Prices live in one place.** The catering menu is a single data file shared with the staff app. The app recalculates every online order's price, so a tampered order gets flagged.
- **Seasonal items run on their own.** Thanksgiving dinners appear on the order page from Nov 1 until 3 days before Thanksgiving. The 4th Thursday is worked out each year.
- **Mobile first.** Most customers visit on a phone, so every layout starts at phone width and grows from there.

## Problems I ran into

- **Slow pages.** The store photos were 2–4 MB each. I resized and compressed them from 14.9 MB down to 2.7 MB in total.
- **Old styles after updates.** Browsers kept serving cached CSS, so customers saw new pages with old styling. Fixed with version numbers on every CSS and JS link.
- **Animations hiding content.** The scroll-in animations sometimes left content invisible. I changed them so only content below the screen starts hidden, and anything still hidden is shown after scrolling stops.
- **A 20 MB weekly ad that wouldn't upload.** It was over the storage limit, and the page was too tall for phone browsers to render. Splitting it into page images fixed both.
- **Small layout bugs**, such as CSS specificity conflicts and date fields overflowing on small phones, found by testing at phone and desktop widths.

## Built with

- HTML5 (semantic markup, accessible forms, `aria` attributes)
- CSS3 (custom properties, Flexbox, Grid, media queries, `@supports`, reduced-motion support)
- JavaScript (no libraries on the public site)
- Supabase (Postgres, row-level security, storage) for orders and uploaded flyers
- GitHub Pages for hosting

## Run it locally

Open `index.html` in a browser, or serve the folder with any static server.

## Credits

Store photos and logo © Food Dynasty Supermarket. Used with permission.

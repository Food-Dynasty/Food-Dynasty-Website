/*
  FLYERS: the weekly sales ad and holiday menus uploaded by staff
  ----------------------------------------------------------------
  Staff upload a PDF or pictures in the FD Orders app (Website tab). This file asks
  the database for the newest one that's showing today and puts it on the page.

  What it does depends on what the page has:
    every page               adds a holiday link to the menu while a holiday menu is up
    #holiday-feature (home)  a big holiday section (if "Feature on homepage" is on)
    #headline-deals (home)   this week's 1-3 best offers, in big letters
    #weekly-flyer (sales)    this week's ad pictures
    #holiday-page (holiday)  the whole holiday page: title, note, pictures, colors

  The database only lets the public READ flyers (see supabase/website-flyers.sql in
  the FD Orders project). The key below is the public "publishable" key.
*/
"use strict";

(function () {
  const DB_URL = "https://hemdteagkpjodrnsiecw.supabase.co";
  const DB_KEY = "sb_publishable_Obe832C66r7F-T-cmZxs7Q_XSJQw9EI";

  // Short names for the menu link, by the look staff picked
  const THEME_NAMES = {
    thanksgiving: "Thanksgiving", christmas: "Christmas", easter: "Easter",
    summer: "Summer Menu", general: "Holiday Menu"
  };

  // Asks the database for the newest flyer of a kind ("weekly" or "holiday").
  // Gives back null if there isn't one (or the internet hiccups): pages then just
  // show their normal content.
  async function currentFlyer(kind) {
    try {
      const response = await fetch(
        DB_URL + "/rest/v1/flyers?kind=eq." + kind + "&order=created_at.desc&limit=1&select=*",
        { headers: { apikey: DB_KEY } }
      );
      if (!response.ok) return null;
      const rows = await response.json();
      return rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  // Makes typed text safe to put inside HTML
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // "2026-11-26" -> "Thursday, Nov 26"
  function niceDate(text) {
    return new Date(text + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  // The flyer's pages as pictures. Each one opens full size in a new tab when tapped,
  // so people can zoom in on small print.
  function pagesHTML(flyer, altText) {
    return (flyer.pages || []).map(function (url, i) {
      return '<a class="flyer-page" href="' + esc(url) + '" target="_blank" rel="noopener">' +
               '<img src="' + esc(url) + '" alt="' + esc(altText + ", page " + (i + 1)) + '"' + (i > 0 ? ' loading="lazy"' : "") + ">" +
             "</a>";
    }).join("");
  }

  function pdfLink(flyer) {
    return flyer.pdf_url
      ? '<a class="button button-dark" href="' + esc(flyer.pdf_url) + '" target="_blank" rel="noopener">Download PDF</a>'
      : "";
  }

  // ---------- Every page: holiday link in the menu ----------
  function addHolidayNavLink(flyer) {
    const list = document.querySelector(".main-nav ul");
    if (!list) return;
    // The holiday page has its own link already: just rename it ("Thanksgiving")
    const existing = list.querySelector('a[href="holiday.html"]');
    if (existing) {
      existing.textContent = THEME_NAMES[flyer.theme] || "Holiday Menu";
      return;
    }
    const item = document.createElement("li");
    item.innerHTML = '<a class="nav-holiday" href="holiday.html">' + esc(THEME_NAMES[flyer.theme] || "Holiday Menu") + "</a>";
    const catering = list.querySelector('a[href="catering.html"]');
    list.insertBefore(item, catering ? catering.parentElement.nextSibling : null);
  }

  // The holiday's specials on the catering menu (js/catering-menu.js), if that file is on
  // this page and the specials can still be ordered online. Otherwise an empty list.
  function holidaySpecials(theme) {
    if (typeof CATERING_MENU === "undefined") return [];
    const category = CATERING_MENU.find(function (c) { return c.season === theme && categoryInSeason(c); });
    return category ? category.items : [];
  }

  // 299 -> "$299", 12.5 -> "$12.50"
  function price(amount) {
    return "$" + (Number.isInteger(amount) ? amount : amount.toFixed(2));
  }

  // ---------- Homepage: the big holiday section ----------
  // Shown only while a holiday menu is up AND its "Feature on homepage" switch is on.
  function fillHolidayFeature(flyer) {
    const box = document.getElementById("holiday-feature");
    if (!box || flyer.featured === false) return;
    const part = function (name) { return box.querySelector("[data-" + name + "]"); };

    box.dataset.theme = flyer.theme;
    part("title").textContent = flyer.title;
    if (flyer.note) {
      part("note").textContent = flyer.note;
      part("note").hidden = false;
    }

    // Prices straight from the catering menu, so they always match the order page.
    // "Thanksgiving Dinner for 8–10" -> "Dinner for 8–10" (the title already says Thanksgiving)
    const specials = holidaySpecials(flyer.theme);
    if (specials.length) {
      const prefix = (THEME_NAMES[flyer.theme] || "") + " ";
      part("prices").innerHTML = specials.map(function (item) {
        const name = item.name.indexOf(prefix) === 0 ? item.name.slice(prefix.length) : item.name;
        const amount = item.unit ? item.price : item.sizes[0][1];
        return "<li><span>" + esc(name) + "</span><strong>" + price(amount) + "</strong></li>";
      }).join("");
      part("prices").hidden = false;
      part("order").hidden = false;   // "Order Online" only while they can be ordered online
    }

    if ((flyer.pages || [])[0]) {
      part("image").src = flyer.pages[0];
      part("image").alt = flyer.title + " menu";
      part("flyer").hidden = false;
    }
    box.hidden = false;
  }

  // ---------- Weekly Sales page ----------
  function fillWeekly(flyer) {
    const box = document.getElementById("weekly-flyer");
    if (!box || !flyer || !(flyer.pages || []).length) return;
    const dates = flyer.starts_on && flyer.ends_on
      ? "Valid " + niceDate(flyer.starts_on) + " – " + niceDate(flyer.ends_on)
      : "";
    box.innerHTML =
      '<div class="container">' +
        "<h2>This Week's Ad</h2>" +
        (dates ? '<p class="flyer-dates">' + esc(dates) + "</p>" : "") +
        '<div class="flyer-pages">' + pagesHTML(flyer, "Weekly sales ad") + "</div>" +
        '<p class="flyer-hint">Tap a page to see it full size.</p>' +
        '<p class="center-button">' + pdfLink(flyer) + "</p>" +
      "</div>";
    box.hidden = false;
  }

  // ---------- Homepage: headline deals in the "This Week's Deals" band ----------
  function fillHeadlineDeals(flyer) {
    const list = document.getElementById("headline-deals");
    if (!list || !flyer) return;
    const lines = (flyer.headline || "").split("\n").filter(function (line) { return line.trim(); });
    const pictures = flyer.deal_images || [];
    if (!lines.length && !pictures.length) return;

    if (pictures.length) {
      // DEAL PICTURES (cut from the ad by staff): shown big, each one a link to the full ad.
      // The deal lines, if any, become each picture's description for screen readers.
      list.classList.add("deal-pictures");
      list.innerHTML = pictures.map(function (url, i) {
        return '<li><a class="deal-picture" href="sales.html">' +
                 '<img src="' + esc(url) + '" alt="' + esc(lines[i] || "This week's deal") + '"' + (i > 1 ? ' loading="lazy"' : "") + ">" +
               "</a></li>";
      }).join("");
    } else {
    // A line starting with FREE becomes a card with a big yellow FREE tag:
    //   "FREE turkey with a $250 purchase" -> [FREE] turkey with a $250 purchase
    // Other lines show as plain deal cards.
    list.innerHTML = lines.map(function (line) {
      const free = line.match(/^\s*free\b[\s:!-]*(.*)$/i);
      return free
        ? '<li class="deal-card deal-card-free"><span class="deal-badge">FREE</span><span class="deal-text">' + esc(free[1]) + "</span></li>"
        : '<li class="deal-card"><span class="deal-text">' + esc(line) + "</span></li>";
    }).join("");
    }
    list.hidden = false;
    const fallback = document.getElementById("deals-default");
    if (fallback && flyer.ends_on) fallback.textContent = "Deals good through " + niceDate(flyer.ends_on) + ".";
  }

  // ---------- Holiday page ----------
  function fillHolidayPage(flyer) {
    const page = document.getElementById("holiday-page");
    if (!page) return;
    document.body.classList.remove("holiday-loading");

    if (!flyer || !(flyer.pages || []).length) {
      document.getElementById("holiday-none").hidden = false;
      document.getElementById("holiday-jump").hidden = true;   // nothing to jump to
      return;
    }
    document.getElementById("holiday-none").hidden = true;
    document.getElementById("holiday-jump").hidden = false;
    document.body.dataset.theme = flyer.theme;
    document.title = flyer.title + " | Food Dynasty Supermarket, Staten Island";
    document.getElementById("holiday-title").textContent = flyer.title;
    const note = document.getElementById("holiday-note");
    if (flyer.note) {
      note.textContent = flyer.note;
      note.hidden = false;
    }
    document.getElementById("holiday-pages").innerHTML = pagesHTML(flyer, flyer.title + " menu");
    const pdf = document.getElementById("holiday-pdf");
    if (flyer.pdf_url) {
      pdf.href = flyer.pdf_url;
      pdf.hidden = false;
    }
    page.hidden = false;
  }

  // ---------- Start ----------
  // Both requests start at the same time; each part fills in when its answer arrives.
  const holiday = currentFlyer("holiday");
  holiday.then(function (flyer) {
    if (flyer && (flyer.pages || []).length) {
      addHolidayNavLink(flyer);
      fillHolidayFeature(flyer);
    }
    fillHolidayPage(flyer);
  });
  if (document.getElementById("weekly-flyer") || document.getElementById("headline-deals")) {
    currentFlyer("weekly").then(function (flyer) {
      fillWeekly(flyer);
      fillHeadlineDeals(flyer);
    });
  }
})();

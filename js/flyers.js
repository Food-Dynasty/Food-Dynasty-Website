/**
 * Loads staff-uploaded flyers from Supabase (public read-only access) and renders
 * the weekly ad, homepage deals, holiday feature section, holiday page and nav link.
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

  // Escape text for safe insertion into HTML
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // "2026-11-26" -> "Thursday, Nov 26"
  function niceDate(text) {
    return new Date(text + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

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

  function holidaySpecials(theme) {
    if (typeof CATERING_MENU === "undefined") return [];
    const category = CATERING_MENU.find(function (c) { return c.season === theme && categoryInSeason(c); });
    return category ? category.items : [];
  }

  // 299 -> "$299", 12.5 -> "$12.50"
  function price(amount) {
    return "$" + (Number.isInteger(amount) ? amount : amount.toFixed(2));
  }

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

    const specials = holidaySpecials(flyer.theme);
    if (specials.length) {
      const prefix = (THEME_NAMES[flyer.theme] || "") + " ";
      part("prices").innerHTML = specials.map(function (item) {
        const name = item.name.indexOf(prefix) === 0 ? item.name.slice(prefix.length) : item.name;
        const amount = item.unit ? item.price : item.sizes[0][1];
        return "<li><span>" + esc(name) + "</span><strong>" + price(amount) + "</strong></li>";
      }).join("");
      part("prices").hidden = false;
      part("order").hidden = false;
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
      list.classList.add("deal-pictures");
      list.innerHTML = pictures.map(function (url, i) {
        return '<li><a class="deal-picture" href="sales.html">' +
                 '<img src="' + esc(url) + '" alt="' + esc(lines[i] || "This week's deal") + '"' + (i > 1 ? ' loading="lazy"' : "") + ">" +
               "</a></li>";
      }).join("");
    } else {
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

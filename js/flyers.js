/*
  FLYERS: the weekly sales ad and holiday menus uploaded by staff
  ----------------------------------------------------------------
  Staff upload a PDF or pictures in the FD Orders app (Website tab). This file asks
  the database for the newest one that's showing today and puts it on the page.

  What it does depends on what the page has:
    every page               adds a holiday link to the menu while a holiday menu is up
    #holiday-banner (home)   a "Thanksgiving Dinner menu is here" banner
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

  // ---------- Homepage: banner ----------
  function fillHolidayBanner(flyer) {
    const banner = document.getElementById("holiday-banner");
    if (!banner) return;
    banner.dataset.theme = flyer.theme;
    banner.querySelector("[data-title]").textContent = flyer.title;
    banner.querySelector("[data-note]").textContent = flyer.note || "Our holiday menu is here. Order early!";
    banner.hidden = false;
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
      fillHolidayBanner(flyer);
    }
    fillHolidayPage(flyer);
  });
  if (document.getElementById("weekly-flyer")) currentFlyer("weekly").then(fillWeekly);
})();

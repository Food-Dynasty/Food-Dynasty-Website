/**
 * Scroll-reveal animations for cards and headings.
 * Only elements below the fold are hidden, so content stays visible if the script
 * fails. Skipped entirely when the visitor prefers reduced motion.
 */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const SELECTOR = ".section h2, .card, .save-card, .dept-card, .dept-card-simple, .menu-card, .package-card, .hours, .split > *";
  let pending = [];

  function show(el) {
    el.classList.add("is-visible");
    setTimeout(function () {
      el.classList.remove("reveal", "is-visible");
      el.style.transitionDelay = "";
    }, 1000);
  }

  // Reveal every hidden element whose top has come within the screen
  function check() {
    const limit = window.innerHeight * 0.92;
    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top < limit) {
        show(el);
        return false;   // remove from the waiting list
      }
      return true;
    });
    if (!pending.length) window.removeEventListener("scroll", onScroll);
  }

  let waiting = false;
  let finalCheck = null;
  function onScroll() {
    clearTimeout(finalCheck);
    finalCheck = setTimeout(check, 150);
    if (waiting) return;
    waiting = true;
    setTimeout(function () {
      waiting = false;
      check();
    }, 60);
  }

  // Step 1: hide only what's below the visible screen
  let rowIndex = 0;
  document.querySelectorAll(SELECTOR).forEach(function (el) {
    if (el.getBoundingClientRect().top < window.innerHeight) return;   // already visible: leave it
    el.classList.add("reveal");
    el.style.transitionDelay = (rowIndex++ % 4) * 80 + "ms";   // a little wave across a row
    pending.push(el);
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // Jump links (like catering.html#pasta) scroll before any scroll event we see
  window.addEventListener("load", check);
  window.addEventListener("hashchange", check);
})();

/*
  SMOOTH SCROLL-IN ANIMATIONS
  ---------------------------
  Cards and headings further down the page gently fade and slide up as you
  scroll to them.

  How it works:
    1. At load, anything BELOW the visible screen gets the "reveal" class
       (CSS makes it invisible and a bit lower). Anything already on screen is
       left alone, so nothing ever "flashes" or stays hidden at the top.
    2. On scroll, we check which hidden elements have reached the screen and
       add "is-visible" (CSS animates them into place).
    3. After the animation, both classes are removed so hover effects work.

  FAIL-SAFE: content must always show. Elements are only hidden by this script
  (if it fails to load, nothing is hidden), only things below the screen are
  hidden, and the checks use plain timers, which keep running even in
  situations where the browser pauses animation frames.

  Skipped completely for people who turned on "Reduce motion" in their settings.
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

  // THROTTLING: scrolling fires dozens of events per second. This runs check()
  // at most once every 60ms, which looks instant but saves a lot of work.
  // Plus one final "catch-up" check 150ms after scrolling STOPS: without it, the
  // last bit of scrolling could happen during the 60ms pause and be missed,
  // leaving items hidden until the next scroll. (A bug found while testing.)
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

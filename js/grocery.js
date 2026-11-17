/**
 * Grocery list request page: delivery slot picker, item counter, validation and
 * submission to the submit_grocery_list RPC.
 */
"use strict";

const ORDERS_DB_URL = "https://hemdteagkpjodrnsiecw.supabase.co";
const ORDERS_DB_KEY = "sb_publishable_Obe832C66r7F-T-cmZxs7Q_XSJQw9EI";

const MAX_ITEMS = 150;
const DAYS_AHEAD = 14;          // how far ahead customers can schedule
const ASAP_HOURS = 2;           // "as soon as possible" = about this many hours
const FIRST_SLOT = 8;           // first delivery time: 8 AM
// Last delivery time each day (the store closes at 9 PM, 8 PM on Sunday)
function lastSlot(date) { return date.getDay() === 0 ? 19 : 20; }   // getDay(): 0 = Sunday

function $(id) { return document.getElementById(id); }

// "2 gal milk\n\n- eggs" -> ["2 gal milk", "eggs"] (same cleanup the database does)
function listItems(text) {
  return text.split("\n")
    .map(function (line) { return line.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim(); })
    .filter(function (line) { return line !== ""; });
}

/* ---------- 1. Delivery day and time ---------- */

// Times for a given day, every 30 minutes. For today, only times at least an hour away.
function timeSlots(day) {
  const slots = [];
  const now = new Date();
  for (let h = FIRST_SLOT; h <= lastSlot(day); h++) {
    for (const m of [0, 30]) {
      if (h === lastSlot(day) && m === 30) continue;
      const t = new Date(day);
      t.setHours(h, m, 0, 0);
      if (t.getTime() - now.getTime() >= 60 * 60 * 1000) slots.push(t);
    }
  }
  return slots;
}

function fillDays() {
  const select = $("g-date");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let html = "";
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    if (!timeSlots(day).length) continue;   // e.g. it's already too late for today
    const label = (i === 0 ? "Today, " : i === 1 ? "Tomorrow, " : "") +
      day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    html += '<option value="' + day.toISOString() + '">' + label + "</option>";
  }
  select.innerHTML = html;
  fillTimes();
}

function fillTimes() {
  const day = new Date($("g-date").value);
  const isToday = day.toDateString() === new Date().toDateString();
  const slots = timeSlots(day);
  let html = "";
  const soon = new Date(Date.now() + ASAP_HOURS * 60 * 60 * 1000);
  const soonHour = soon.getHours() + soon.getMinutes() / 60;
  const asapOk = isToday && soon.toDateString() === day.toDateString() &&
                 soonHour >= FIRST_SLOT && soonHour <= lastSlot(day);
  if (asapOk) {
    html += '<option value="asap">As soon as possible (about ' + ASAP_HOURS + " hours)</option>";
  }
  html += slots.map(function (t) {
    return '<option value="' + t.toISOString() + '">' +
      t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</option>";
  }).join("");
  $("g-time").innerHTML = html;
}

/* ---------- 2. Item counter ---------- */

function updateCount() {
  const n = listItems($("g-list").value).length;
  $("g-count").textContent = n + (n === 1 ? " item" : " items") + (n > MAX_ITEMS ? " (too many: please call us)" : "");
}

/* ---------- 3. Check and send ---------- */

function showError(message, field) {
  const box = $("g-error");
  box.textContent = message;
  box.hidden = false;
  document.querySelectorAll("#grocery-form [aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

function validate() {
  const items = listItems($("g-list").value);
  if (!items.length) return ["Please type your grocery list (one item per line).", $("g-list")];
  if (items.length > MAX_ITEMS) return ["That's a big order! Please call us at 718-816-1100 for lists over " + MAX_ITEMS + " items.", $("g-list")];
  if (!$("g-name").value.trim()) return ["Please enter your name.", $("g-name")];
  if ($("g-phone").value.replace(/\D/g, "").length < 10) return ["Please enter a phone number with area code, so we can call you with the total.", $("g-phone")];
  if (!$("g-address").value.trim()) return ["Please enter your delivery address.", $("g-address")];
  if (!/^\d{5}$/.test($("g-zip").value.trim())) return ["Please enter a 5-digit ZIP code.", $("g-zip")];
  if (!$("g-time").value) return ["Please choose a delivery time.", $("g-time")];
  if (!$("g-agree").checked) return ["Please check the box to confirm you understand how it works.", $("g-agree")];
  return null;
}

function deliveryTime() {
  const value = $("g-time").value;
  if (value === "asap") return new Date(Date.now() + ASAP_HOURS * 60 * 60 * 1000);
  return new Date(value);
}

function buildPayload() {
  const address = $("g-address").value.trim();
  const apt = $("g-apt").value.trim();
  const city = $("g-city").value.trim() || "Staten Island";
  const zip = $("g-zip").value.trim();
  const subs = document.querySelector('input[name="subs"]:checked').value;
  const notes = $("g-notes").value.trim();
  const asap = $("g-time").value === "asap";
  return {
    customer: { name: $("g-name").value.trim(), phone: $("g-phone").value.trim(), address: address, apt: apt, city: city, zip: zip },
    delivery_address: [address, apt, city].filter(Boolean).join(", ") + ", NY " + zip,
    list: $("g-list").value,
    due_at: deliveryTime().toISOString(),
    notes: ["If out of stock: " + subs, asap ? "Customer asked for ASAP delivery" : "", notes].filter(Boolean).join("\n")
  };
}

async function send(payload) {
  try {
    const response = await fetch(ORDERS_DB_URL + "/rest/v1/rpc/submit_grocery_list", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ORDERS_DB_KEY },
      body: JSON.stringify({ payload: payload })
    });
    if (!response.ok) return null;
    return Number(await response.json()) || null;
  } catch (error) {
    return null;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  $("g-error").hidden = true;
  if ($("g-website").value) return;   // honeypot filled = spam bot

  const problem = validate();
  if (problem) {
    showError(problem[0], problem[1]);
    return;
  }

  const button = $("g-submit");
  button.disabled = true;
  button.textContent = "Sending…";
  const when = $("g-time").value === "asap"
    ? "as soon as possible"
    : deliveryTime().toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const listNumber = await send(buildPayload());
  button.disabled = false;
  button.textContent = "Send My List";

  if (!listNumber) {
    showError("Sorry, your list didn't go through. Please try again in a minute, or call us at 718-816-1100 and we'll take it by phone.", null);
    return;
  }

  $("g-done-message").textContent =
    "Thanks, " + $("g-name").value.trim() + "! Your list number is #" + listNumber + ". " +
    "We'll shop it and call you at " + $("g-phone").value.trim() + " with the total before delivering " + when + ".";
  $("grocery-form").hidden = true;
  $("g-done").hidden = false;
  $("g-done").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Start-up ---------- */
fillDays();
updateCount();
$("g-date").addEventListener("change", fillTimes);
$("g-list").addEventListener("input", updateCount);
$("grocery-form").addEventListener("submit", handleSubmit);

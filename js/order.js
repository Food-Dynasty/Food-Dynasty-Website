/**
 * Online catering order page: menu rendering, tray (cart) persisted in localStorage,
 * totals with tax and delivery, validation, and submission to submit_online_order.
 */
"use strict";

/* ============ 0. SETTINGS ============ */

const ORDERS_DB_URL = "https://hemdteagkpjodrnsiecw.supabase.co";
const ORDERS_DB_KEY = "sb_publishable_Obe832C66r7F-T-cmZxs7Q_XSJQw9EI";

const MIN_DAYS_AHEAD = 3;                    // matches the "3 days notice" policy

const TAX_RATE = 0.08875;

const DELIVERY_FEE = 15;
const STORAGE_KEY = "fd-catering-tray";      // name used to save the tray in the browser

/* ============ 1. PREPARE THE MENU DATA ============ */

// "Baked Ziti" -> "baked-ziti". Used to give every item a unique ID.
function slugify(text) {
  return text.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")   // anything that isn't a letter or number -> "-"
    .replace(/^-|-$/g, "");        // trim "-" from the start and end
}

const ITEMS = {};

CATERING_MENU.forEach(function (category) {
  category.items = category.items.map(function (raw) {
    // A plain name like "Baked Ziti" becomes an object: { name: "Baked Ziti" }
    const item = (typeof raw === "string") ? { name: raw } : Object.assign({}, raw);

    // Items without their own sizes (and not priced per unit) use the category's sizes
    if (!item.unit && !item.sizes) {
      item.sizes = category.sizes;
    }
    item.id = category.id + "--" + slugify(item.name);
    ITEMS[item.id] = item;
    return item;
  });
});

/* ============ HELPERS ============ */

// Formats numbers as money: 1234.5 -> "$1,234.50"
const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function money(amount) {
  return moneyFormat.format(amount);
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function unitWord(item, plural) {
  if (item.unit === "person") return plural ? "people" : "person";
  if (item.unit === "foot") return plural ? "feet" : "ft";
  return "";
}

// Shorthand for document.getElementById
function $(id) {
  return document.getElementById(id);
}

const FIELDS = {
  name: $("f-name"),
  phone: $("f-phone"),
  email: $("f-email"),
  date: $("f-date"),
  time: $("f-time"),
  notes: $("f-notes"),
  website: $("f-website"),   // the hidden honeypot
  agree: $("f-agree"),
  delivery: $("f-delivery"), // the "Delivery" radio button
  address: $("f-address"),
  apt: $("f-apt"),
  city: $("f-city"),
  zip: $("f-zip")
};

// true when the customer picked Delivery
function isDelivery() {
  return FIELDS.delivery.checked;
}

// "Pickup" or "Delivery", used in labels, messages and the email subject
function whenWord() {
  return isDelivery() ? "Delivery" : "Pickup";
}

// The address as one line: "123 Main St, Apt 2, Staten Island, NY 10305"
function deliveryAddress() {
  return [FIELDS.address.value.trim(), FIELDS.apt.value.trim(), FIELDS.city.value.trim()]
    .filter(function (part) { return part !== ""; })   // skip the empty apt field
    .join(", ") + ", NY " + FIELDS.zip.value.trim();
}

function updateFulfillment() {
  $("delivery-fields").hidden = !isDelivery();
  document.querySelectorAll(".when-word").forEach(function (span) {
    span.textContent = whenWord();
  });
  renderTray();
}

/* ============ 2. BUILD THE MENU ON THE PAGE ============ */

function renderMenu() {
  const html = CATERING_MENU.filter(function (category) { return categoryInSeason(category); }).map(function (category, index) {
    return (
      '<details class="order-cat"' + (index === 0 ? " open" : "") + ">" +
        "<summary>" + escapeHTML(category.name) +
          ' <span class="order-cat-count">' + category.items.length + " items</span></summary>" +
        (category.note ? '<p class="order-cat-note">' + escapeHTML(category.note) + "</p>" : "") +
        '<ul class="order-items">' + category.items.map(itemRowHTML).join("") + "</ul>" +
      "</details>"
    );
  }).join("");

  $("order-menu").innerHTML = html;
}

function choicePicksHTML(item) {
  const slots = choiceSlots(item);
  if (!slots.length) return "";
  return (
    '<div class="choice-picks">' +
      slots.map(function (slot, i) {
        return '<label class="choice-pick"><span>' + escapeHTML(slot.label) + "</span>" +
          '<select data-slot="' + i + '">' +
            '<option value="">Choose…</option>' +
            slot.options.map(function (option) {
              return '<option value="' + escapeHTML(option) + '">' + escapeHTML(option) + "</option>";
            }).join("") +
          "</select></label>";
      }).join("") +
      '<p class="choice-error" role="alert" hidden>Please pick every option above, then tap Add.</p>' +
    "</div>"
  );
}

// One row in the menu: name (+ hint) on the left, size picker + Add button on the right
function itemRowHTML(item) {
  let chooser;

  if (item.unit) {
    // Priced per person / per foot
    chooser = '<span class="order-price">' + money(item.price) + " / " + unitWord(item, false) + "</span>";
  } else if (item.sizes.length === 1) {
    // Only one size: just show the price
    chooser = '<span class="order-price">' + money(item.sizes[0][1]) + "</span>";
  } else {
    // Several sizes: a dropdown. The option's value is the size's position (0, 1, 2...)
    chooser =
      '<select class="size-select" aria-label="Size for ' + escapeHTML(item.name) + '">' +
        item.sizes.map(function (size, i) {
          return '<option value="' + i + '">' + escapeHTML(size[0]) + " · " + money(size[1]) + "</option>";
        }).join("") +
      "</select>";
  }

  return (
    '<li class="order-item" data-id="' + item.id + '">' +
      '<div class="order-item-info">' +
        '<span class="order-item-name">' + escapeHTML(item.name) + "</span>" +
        (item.unit ? '<span class="order-item-hint">Minimum ' + item.min + " " + unitWord(item, true) + "</span>" : "") +
        (item.hint ? '<span class="order-item-hint">' + escapeHTML(item.hint) + "</span>" : "") +
        choicePicksHTML(item) +
      "</div>" +
      '<div class="order-item-actions">' + chooser +
        '<button type="button" class="add-btn" aria-label="Add ' + escapeHTML(item.name) + ' to tray">Add</button>' +
      "</div>" +
    "</li>"
  );
}

/* ============ 3. THE TRAY (CART) ============ */

let tray = loadTray();

function linePrice(line) {
  const item = ITEMS[line.id];
  const unitPrice = item.unit ? item.price : item.sizes[line.size][1];
  return unitPrice * line.qty;
}

// Price of everything in the tray BEFORE tax
function traySubtotal() {
  return tray.reduce(function (sum, line) { return sum + linePrice(line); }, 0);
}

function roundCents(amount) {
  return Math.round(amount * 100) / 100;
}

function trayTotals() {
  const subtotal = roundCents(traySubtotal());
  // No fee on an empty tray, so an empty order never shows "$15.00"
  const deliveryFee = (isDelivery() && tray.length > 0) ? DELIVERY_FEE : 0;
  const tax = roundCents((subtotal + deliveryFee) * TAX_RATE);
  const total = roundCents(subtotal + deliveryFee + tax);
  const deposit = roundCents(total / 2);
  return { subtotal: subtotal, deliveryFee: deliveryFee, tax: tax, total: total, deposit: deposit };
}

// "8.875%": the rate shown to customers, built from TAX_RATE so it can't get out of sync
function taxRateText() {
  return (TAX_RATE * 100).toFixed(3).replace(/\.?0+$/, "") + "%";
}

function minQty(item) {
  return item.unit ? item.min : 1;
}

function addToTray(id, size, choices) {
  const item = ITEMS[id];
  if (!item) return;

  // The same dinner with DIFFERENT sides is a separate line; same sides -> one more
  const sameChoices = JSON.stringify(choices || null);
  const existing = tray.find(function (line) {
    return line.id === id && line.size === size && JSON.stringify(line.choices || null) === sameChoices;
  });

  if (existing && !item.unit) {
    existing.qty += 1;            // same tray in the same size again -> one more
  } else if (!existing) {
    const line = { id: id, size: size, qty: minQty(item), note: "" };
    if (choices) line.choices = choices;
    tray.push(line);
  }
  saveTray();
  renderTray();
}

function renderTray() {
  const box = $("tray-lines");

  if (tray.length === 0) {
    box.innerHTML = '<p class="tray-empty">Your tray is empty. Add items from the menu.</p>';
  } else {
    box.innerHTML = tray.map(function (line, index) {
      const item = ITEMS[line.id];
      const sizeText = item.unit
        ? money(item.price) + " per " + unitWord(item, false) + " · minimum " + item.min
        : item.sizes[line.size][0] + " · " + money(item.sizes[line.size][1]) + " each";
      const qtyName = item.unit ? unitWord(item, true) : "qty";

      return (
        '<div class="tray-line" data-index="' + index + '">' +
          '<div class="tray-line-top">' +
            '<span class="tray-line-name">' + escapeHTML(item.name) + "</span>" +
            '<span class="tray-line-price">' + money(linePrice(line)) + "</span>" +
          "</div>" +
          '<div class="tray-line-size">' + escapeHTML(sizeText) + "</div>" +
          (line.choices ? '<div class="tray-line-choices">' + escapeHTML(choicesText(item, line.choices)) + "</div>" : "") +
          '<div class="tray-line-controls">' +
            '<button type="button" class="qty-btn" data-action="minus" aria-label="Less ' + escapeHTML(item.name) + '">−</button>' +
            '<input type="number" class="qty-input" value="' + line.qty + '" min="' + minQty(item) + '" max="999" ' +
              'inputmode="numeric" aria-label="' + qtyName + " for " + escapeHTML(item.name) + '">' +
            '<button type="button" class="qty-btn" data-action="plus" aria-label="More ' + escapeHTML(item.name) + '">+</button>' +
            '<span class="qty-label">' + qtyName + "</span>" +
            '<button type="button" class="remove-btn" data-action="remove">Remove</button>' +
          "</div>" +
          '<input type="text" class="line-note" maxlength="200" value="' + escapeHTML(line.note) + '" ' +
            'placeholder="Note for this item (optional)" aria-label="Note for ' + escapeHTML(item.name) + '">' +
        "</div>"
      );
    }).join("");
  }

  // Totals and the phone "View tray" bar
  const totals = trayTotals();
  const itemCount = tray.length;
  $("tray-totals").hidden = itemCount === 0;
  $("tray-subtotal").textContent = money(totals.subtotal);
  $("tray-delivery-row").hidden = totals.deliveryFee === 0;
  $("tray-delivery").textContent = money(totals.deliveryFee);
  $("tray-tax-rate").textContent = taxRateText();
  $("tray-tax").textContent = money(totals.tax);
  $("tray-total").textContent = money(totals.total);
  $("tray-deposit").textContent = money(totals.deposit);
  $("tray-bar").hidden = itemCount === 0;
  $("tray-bar-count").textContent = itemCount + (itemCount === 1 ? " item" : " items");
  $("tray-bar-total").textContent = money(totals.total);
}

// Keeps a typed amount inside the allowed range (e.g. no 3 people for a 20-person buffet)
function clampQty(item, value) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return minQty(item);
  return Math.min(999, Math.max(minQty(item), n));
}

/* ============ 4. REMEMBER THE TRAY (localStorage) ============ */

function saveTray() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tray));
  } catch (error) { /* storage unavailable: ignore */ }
}

function loadTray() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // Drop anything that no longer matches the menu (e.g. an item was removed from the menu)
    return saved.filter(function (line) {
      const item = ITEMS[line.id];
      return item && (item.unit || (item.sizes && item.sizes[line.size])) &&
             (!item.choices || choicesComplete(item, line.choices));   // picks must still be on the menu
    });
  } catch (error) {
    return [];
  }
}

/* ============ 5. THE FORM ============ */

function toDateValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function earliestPickupDate() {
  const date = new Date();
  date.setDate(date.getDate() + MIN_DAYS_AHEAD);
  return toDateValue(date);
}

// "2026-11-20" -> "Fri, Nov 20, 2026"
function prettyDate(value) {
  const parts = value.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// "13:30" -> "1:30 PM"
function prettyTime(value) {
  const parts = value.split(":");
  let hours = Number(parts[0]);
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return hours + ":" + parts[1] + " " + suffix;
}

function showError(message, field) {
  const box = $("form-error");
  box.textContent = message;
  box.hidden = false;
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

function clearErrors() {
  $("form-error").hidden = true;
  document.querySelectorAll("#order-form [aria-invalid]").forEach(function (el) {
    el.removeAttribute("aria-invalid");
  });
}

// Returns an error message, or "" if everything is fine
function validate(form) {
  if (tray.length === 0) return ["Your tray is empty. Add at least one item from the menu.", null];

  if (!FIELDS.name.value.trim()) return ["Please enter your name.", FIELDS.name];

  const digits = FIELDS.phone.value.replace(/\D/g, "");
  if (digits.length < 10) return ["Please enter a phone number with area code, so we can call to confirm.", FIELDS.phone];

  if (FIELDS.email.value.trim() && !FIELDS.email.checkValidity()) return ["That email address doesn't look right.", FIELDS.email];

  // Address checks only matter for delivery
  if (isDelivery()) {
    if (!FIELDS.address.value.trim()) return ["Please enter the delivery address.", FIELDS.address];
    if (!FIELDS.city.value.trim()) return ["Please enter the city for delivery.", FIELDS.city];
    if (!/^\d{5}$/.test(FIELDS.zip.value.trim())) return ["Please enter a 5-digit ZIP code.", FIELDS.zip];
  }

  const word = whenWord().toLowerCase();   // "pickup" or "delivery", used in the messages
  const date = FIELDS.date.value;
  if (!date) return ["Please choose a " + word + " date.", FIELDS.date];
  // Dates in "YYYY-MM-DD" form can be compared as plain text
  if (date < earliestPickupDate()) {
    return ["Catering needs at least " + MIN_DAYS_AHEAD + " days' notice. The earliest " + word + " date is " + prettyDate(earliestPickupDate()) + ".", FIELDS.date];
  }

  const time = FIELDS.time.value;
  if (!time) return ["Please choose a " + word + " time.", FIELDS.time];
  if (time < FIELDS.time.min || time > FIELDS.time.max) {
    return [whenWord() + " times are between " + prettyTime(FIELDS.time.min) + " and " + prettyTime(FIELDS.time.max) + ".", FIELDS.time];
  }

  if (!$("f-agree").checked) return ["Please check the box to confirm you understand how ordering works.", $("f-agree")];

  return ["", null];
}

// The order as plain text: easy to read in an email and easy to print for the kitchen
function buildSummary(form) {
  const lines = tray.map(function (line) {
    const item = ITEMS[line.id];
    const what = item.unit
      ? item.name + ": " + line.qty + " " + unitWord(item, true) + " × " + money(item.price)
      : line.qty + " × " + item.name + " (" + item.sizes[line.size][0] + ")";
    return "• " + what + "  =  " + money(linePrice(line)) +
      (line.choices ? "\n    " + choicesText(item, line.choices) : "") +
      (line.note ? "\n    Note: " + line.note : "");
  });

  const totals = trayTotals();

  // The "how and when" lines differ for pickup and delivery
  const when = prettyDate(FIELDS.date.value) + " at " + prettyTime(FIELDS.time.value);
  const howLines = isDelivery()
    ? [
        "DELIVERY: " + when,
        "Address: " + deliveryAddress()
      ]
    : ["PICKUP:  " + when + " (1071 Bay St)"];

  return [
    "FOOD DYNASTY · CATERING ORDER REQUEST",
    "",
    "Name:    " + FIELDS.name.value.trim(),
    "Phone:   " + FIELDS.phone.value.trim(),
    "Email:   " + (FIELDS.email.value.trim() || "(none)"),
    ""
  ].concat(howLines, [
    "",
    "ITEMS",
    lines.join("\n"),
    "",
    "Subtotal:         " + money(totals.subtotal)
  ], totals.deliveryFee ? ["Delivery fee:     " + money(totals.deliveryFee)] : [], [
    "Sales tax " + taxRateText() + ": " + money(totals.tax),
    "Estimated total:  " + money(totals.total),
    "50% deposit:      " + money(totals.deposit),
    "",
    "Kitchen notes: " + (FIELDS.notes.value.trim() || "(none)"),
    "",
    "Sent " + new Date().toLocaleString("en-US")
  ]).join("\n");
}

/* ---------- Sending to the FD Orders app (the store's database) ---------- */

function buildOrderForApp() {
  const totals = trayTotals();
  const email = FIELDS.email.value.trim();
  const notes = FIELDS.notes.value.trim();
  return {
    customer: {
      name: FIELDS.name.value.trim(),
      phone: FIELDS.phone.value.trim(),
      address: isDelivery() ? FIELDS.address.value.trim() : "",
      apt: isDelivery() ? FIELDS.apt.value.trim() : "",
      city: isDelivery() ? FIELDS.city.value.trim() : "",
      zip: isDelivery() ? FIELDS.zip.value.trim() : ""
    },
    fulfillment: isDelivery() ? "delivery" : "pickup",
    due_at: new Date(FIELDS.date.value + "T" + FIELDS.time.value).toISOString(),
    items: tray.map(function (line) {
      const item = ITEMS[line.id];
      const unitPrice = item.unit ? item.price : item.sizes[line.size][1];
      return {
        id: line.id,
        name: item.name,
        size: line.size,
        size_label: item.unit ? null : item.sizes[line.size][0],
        qty: line.qty,
        unit_price: unitPrice,
        line_total: roundCents(unitPrice * line.qty),
        label: item.unit
          ? item.name + " · " + line.qty + " " + unitWord(item, true)
          : line.qty + " × " + item.name + " (" + item.sizes[line.size][0] + ")",
        // Thanksgiving dinners: the picks, as a list and as readable text for the kitchen
        choices: line.choices || null,
        choices_text: line.choices ? choicesText(item, line.choices) : null,
        note: line.note
      };
    }),
    subtotal: totals.subtotal,
    delivery_fee: totals.deliveryFee,
    tax: totals.tax,
    total: totals.total,
    delivery_address: isDelivery() ? deliveryAddress() : null,
    notes: [notes, email ? "Customer email: " + email : ""].filter(Boolean).join("\n") || null
  };
}

async function sendToOrdersApp() {
  try {
    const response = await fetch(ORDERS_DB_URL + "/rest/v1/rpc/submit_online_order", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ORDERS_DB_KEY },
      body: JSON.stringify({ payload: buildOrderForApp() })
    });
    if (!response.ok) return null;
    const orderNumber = await response.json();
    return Number(orderNumber) || null;
  } catch (error) {
    return null;
  }
}

async function sendOrder(form, summary) {
  if (!ORDERS_DB_URL) {
    return { ok: true, test: true };   // TEST MODE: pretend it worked
  }
  const orderNumber = await sendToOrdersApp();
  return { ok: Boolean(orderNumber), test: false, orderNumber: orderNumber };
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearErrors();

  // Honeypot filled in = a spam bot. Do nothing.
  if (FIELDS.website.value) return;

  const result = validate(form);
  if (result[0]) {
    showError(result[0], result[1]);
    return;
  }

  const button = $("submit-btn");
  button.disabled = true;
  button.textContent = "Sending…";

  const summary = buildSummary(form);
  try {
    const sent = await sendOrder(form, summary);
    if (!sent.ok) throw new Error("The form service said no");
    showConfirmation(form, summary, sent.test, sent.orderNumber);
  } catch (error) {
    showError("Sorry, your order didn't go through. Please try again in a minute, or call us at 718-816-1100 and we'll take it by phone.", null);
  } finally {
    button.disabled = false;
    button.textContent = "Send Order Request";
  }
}

/* ============ 6. CONFIRMATION + PRINT ============ */

function showConfirmation(form, summary, isTest, orderNumber) {
  $("done-message").textContent = isTest
    ? "TEST MODE: this order was NOT sent. This is what the store would receive:"
    : "Thank you, " + FIELDS.name.value.trim() + "!" +
      (orderNumber ? " Your request number is #" + orderNumber + "." : "") +
      " We'll call you at " + FIELDS.phone.value.trim() +
      " within one business day to confirm your order and take the deposit.";
  $("order-summary").textContent = summary;

  document.querySelector(".tray").hidden = true;
  form.hidden = true;
  $("tray-bar").hidden = true;
  $("order-done").hidden = false;
  $("order-done").focus();

  // The order is done: empty the tray
  tray = [];
  saveTray();
}

function startNewOrder() {
  const form = $("order-form");
  form.reset();   // also switches back to "Pickup"
  form.hidden = false;
  document.querySelector(".tray").hidden = false;
  $("order-done").hidden = true;
  updateFulfillment();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============ START-UP: connect everything ============ */

renderMenu();
updateFulfillment();

// Pickup/Delivery: both radio buttons share one handler
document.querySelectorAll('input[name="fulfillment"]').forEach(function (radio) {
  radio.addEventListener("change", updateFulfillment);
});

if (!ORDERS_DB_URL) {
  $("test-banner").hidden = false;
}

// Earliest pickup date the date picker allows
$("f-date").min = earliestPickupDate();

$("order-menu").addEventListener("click", function (event) {
  const button = event.target.closest(".add-btn");
  if (!button) return;

  const row = button.closest(".order-item");
  const select = row.querySelector(".size-select");

  // Items with choices: every dropdown must be picked first
  let choices = null;
  const pickers = row.querySelectorAll(".choice-picks select");
  if (pickers.length) {
    choices = Array.from(pickers).map(function (s) { return s.value; });
    const error = row.querySelector(".choice-error");
    const firstEmpty = Array.from(pickers).find(function (s) { return !s.value; });
    pickers.forEach(function (s) { s.classList.toggle("missing", !s.value); });
    if (firstEmpty) {
      error.hidden = false;
      firstEmpty.focus();
      return;
    }
    error.hidden = true;
  }

  addToTray(row.dataset.id, select ? Number(select.value) : 0, choices);
  // Reset the dropdowns so a second dinner starts fresh
  pickers.forEach(function (s) { s.value = ""; });

  // Quick "Added ✓" feedback on the button
  button.textContent = "Added ✓";
  button.classList.add("added");
  setTimeout(function () {
    button.textContent = "Add";
    button.classList.remove("added");
  }, 1200);
});

$("order-menu").addEventListener("change", function (event) {
  if (!event.target.closest(".choice-picks")) return;
  event.target.classList.remove("missing");
  const box = event.target.closest(".choice-picks");
  if (!box.querySelector("select.missing")) box.querySelector(".choice-error").hidden = true;
});

// Tray: +, − and Remove buttons
$("tray-lines").addEventListener("click", function (event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const index = Number(button.closest(".tray-line").dataset.index);
  const line = tray[index];
  const item = ITEMS[line.id];
  const action = button.dataset.action;

  if (action === "plus") line.qty = clampQty(item, line.qty + 1);
  if (action === "minus") line.qty = clampQty(item, line.qty - 1);
  if (action === "remove") tray.splice(index, 1);

  saveTray();
  renderTray();
});

// Typing an amount directly ("change" fires when the box loses focus or Enter is pressed)
$("tray-lines").addEventListener("change", function (event) {
  if (!event.target.classList.contains("qty-input")) return;
  const index = Number(event.target.closest(".tray-line").dataset.index);
  tray[index].qty = clampQty(ITEMS[tray[index].id], event.target.value);
  saveTray();
  renderTray();
});

$("tray-lines").addEventListener("input", function (event) {
  if (!event.target.classList.contains("line-note")) return;
  const index = Number(event.target.closest(".tray-line").dataset.index);
  tray[index].note = event.target.value;
  saveTray();
});

$("order-form").addEventListener("submit", handleSubmit);
$("print-btn").addEventListener("click", function () { window.print(); });
$("new-order-btn").addEventListener("click", startNewOrder);

// Serves the pairing script creators paste into their existing website.
//
// Two jobs: apply the creator's edits to the live DOM in place (no containers,
// no styling, just text/image/video swaps), and — when the server asks — walk
// the page and report what's editable.
//
// Reporting from the browser rather than fetching the HTML server-side is
// deliberate: it survives bot-protection firewalls, sees JavaScript-rendered
// pages after hydration, and produces selectors that match by construction,
// because the same walker generates and later queries them.
//
// NOTE: keep EMBED-style template rules — no backticks/${} inside CONNECT_JS.

const CONNECT_JS = `(function () {
  "use strict";
  var TAG = "[ensemble]";

  // document.currentScript is null whenever something else executes the tag —
  // Cloudflare Rocket Loader, tag managers, and most "optimize JavaScript"
  // plugins all do. Fall back to finding our own tag by its src.
  var script = document.currentScript;
  if (!script || !script.getAttribute("data-site")) {
    var all = document.getElementsByTagName("script");
    for (var s = 0; s < all.length; s++) {
      var cand = all[s];
      if (cand.getAttribute("data-site") && (cand.src || "").indexOf("/connect.js") !== -1) { script = cand; break; }
    }
  }
  if (!script) { console.warn(TAG, "couldn't find its own <script> tag — is it being rewritten by an optimizer plugin?"); return; }

  var token = script.getAttribute("data-site");
  if (!token) { console.warn(TAG, 'add data-site="your-token" to the connect script tag'); return; }

  var origin;
  try { origin = new URL(script.src, location.href).origin; } catch (e) {
    console.warn(TAG, "couldn't read the snippet's src — copy the line again from your dashboard"); return;
  }
  if (location.protocol === "https:" && origin.indexOf("http://") === 0) {
    console.warn(TAG, "the snippet points at " + origin + " (plain http) but this page is https, so the browser will block it. Copy the https version from your dashboard.");
  }

  var TEXT_TAGS = { h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, p: 1, li: 1, blockquote: 1, figcaption: 1 };
  var SKIP = { script: 1, style: 1, noscript: 1, template: 1, svg: 1, head: 1 };
  var TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption";
  var MAX_ITEMS = 300;

  // Idempotent on purpose: it writes only when the value actually differs, so
  // re-running it from a MutationObserver can't trigger the mutation that
  // would call it again.
  // Last resort when a selector no longer matches: find the element by the
  // text we recorded for it. Also accepts text we've already replaced, so a
  // re-render mid-page doesn't create a duplicate match.
  function findByText(it) {
    if (it.kind !== "text" || !it.original) return null;
    var nodes = document.querySelectorAll(TEXT_SELECTOR);
    var hit = null;
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || "").replace(/\\s+/g, " ").trim();
      if (t !== it.original && t !== it.value) continue;
      if (hit) return null; // ambiguous — refuse rather than edit the wrong one
      hit = nodes[i];
    }
    return hit;
  }

  function apply(items) {
    var changed = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      try {
        var el = null;
        try { el = document.querySelector(it.selector); } catch (eSel) {}
        if (!el) el = findByText(it);
        if (!el) continue;
        if (it.kind === "text") {
          if (el.textContent !== it.value) { el.textContent = it.value; changed++; }
        } else if (it.kind === "image") {
          if (el.getAttribute("src") !== it.value) {
            el.removeAttribute("srcset");
            el.setAttribute("src", it.value);
            changed++;
          }
        } else if (it.kind === "video") {
          if (el.getAttribute("src") !== it.value) {
            var source = el.querySelector && el.querySelector("source");
            if (source) source.setAttribute("src", it.value);
            el.setAttribute("src", it.value);
            if (el.load) try { el.load(); } catch (e2) {}
            changed++;
          }
        }
      } catch (e3) {}
    }
    return changed;
  }

  /**
   * Client-rendered sites (React, Vue, any Vite/CRA SPA) have an empty <body>
   * at DOMContentLoaded — the real page arrives milliseconds to seconds later.
   * Reading it then finds nothing, so wait until the DOM stops changing.
   * The hard cap keeps pages with perpetual animation from waiting forever.
   */
  function whenSettled(cb) {
    var fired = false, quiet = null, cap = null, obs = null;
    function finish() {
      if (fired) return;
      fired = true;
      clearTimeout(quiet); clearTimeout(cap);
      if (obs) obs.disconnect();
      cb();
    }
    // Crucially, an empty shell must NOT count as settled: a quiet period
    // that begins before the app has rendered would expire while the page is
    // still <div id="root"></div>. Only start the countdown once there is
    // something worth reading; the cap covers pages that never render.
    function maybeSettle() {
      clearTimeout(quiet);
      if (!document.querySelector(TEXT_SELECTOR + ",img,iframe,video")) return;
      quiet = setTimeout(finish, 500);
    }
    if (window.MutationObserver) {
      obs = new MutationObserver(maybeSettle);
      try {
        obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      } catch (e) { obs = null; }
    }
    cap = setTimeout(finish, 10000);
    maybeSettle();
  }

  /**
   * An SPA re-renders on navigation and state changes, throwing away our text.
   * Re-apply whenever the DOM changes; apply() is a no-op when nothing differs,
   * so this settles instead of looping.
   */
  function keepApplied(items) {
    if (!items.length || !window.MutationObserver) return;
    var t = null;
    var obs = new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { apply(items); }, 150);
    });
    try {
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }

  // An id is only worth anchoring to if a human wrote it. Framework-generated
  // ones change on every render, and an id that isn't unique isn't an anchor.
  function usableId(el) {
    var id = el.id;
    if (!id || !/^[A-Za-z][\\w-]*$/.test(id)) return null;
    if (/^(radix-|headlessui-|mui-|react-aria|ember|ext-gen)/i.test(id)) return null;
    if (/\\d{4,}/.test(id)) return null;
    try { if (document.querySelectorAll("#" + id).length !== 1) return null; } catch (e) { return null; }
    return id;
  }

  /**
   * Shortest durable path to an element.
   *
   * A purely positional path ("body > div:nth-of-type(1) > …") breaks the
   * moment anyone reorders a section, silently orphaning every edit below it.
   * So we stop at the nearest ancestor carrying a real id and anchor there —
   * changes outside that subtree then can't reach us.
   */
  function cssPath(el) {
    var segments = [];
    var node = el;
    while (node && node.tagName) {
      var tag = node.tagName.toLowerCase();
      if (tag === "body" || tag === "html") break;
      var id = usableId(node);
      if (id) {
        segments.unshift("#" + id);
        return segments.join(" > ");
      }
      var parent = node.parentNode;
      var nth = 1;
      if (parent && parent.children) {
        for (var i = 0; i < parent.children.length; i++) {
          var sib = parent.children[i];
          if (sib === node) break;
          if (sib.tagName && sib.tagName.toLowerCase() === tag) nth++;
        }
      }
      segments.unshift(tag + ":nth-of-type(" + nth + ")");
      node = parent;
    }
    return "body > " + segments.join(" > ");
  }

  function absolutize(src) {
    try { return new URL(src, document.baseURI).href; } catch (e) { return src; }
  }

  function collect() {
    var items = [];
    var seen = {};

    function push(el, kind, original) {
      if (items.length >= MAX_ITEMS || !original) return;
      var selector = cssPath(el);
      if (seen[selector]) return;
      seen[selector] = 1;
      items.push({ selector: selector, kind: kind, original: original });
    }

    function walk(el) {
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (SKIP[tag]) return;

      if (tag === "img") {
        var isrc = el.getAttribute("src");
        if (isrc && isrc.indexOf("data:") !== 0) push(el, "image", absolutize(isrc));
        return;
      }
      if (tag === "iframe") {
        var fsrc = el.getAttribute("src");
        if (fsrc) push(el, "video", absolutize(fsrc));
        return;
      }
      if (tag === "video") {
        var inner = el.querySelector("source");
        var vsrc = el.getAttribute("src") || (inner && inner.getAttribute("src"));
        if (vsrc) push(el, "video", absolutize(vsrc));
        return;
      }

      if (TEXT_TAGS[tag] && el.querySelector(TEXT_SELECTOR) === null) {
        // Innermost editable block only (li > p edits the p, not the li).
        var text = (el.textContent || "").replace(/\\s+/g, " ").trim();
        if (text) push(el, "text", text);
        var imgs = el.querySelectorAll("img");
        for (var k = 0; k < imgs.length; k++) {
          var csrc = imgs[k].getAttribute("src");
          if (csrc && csrc.indexOf("data:") !== 0) push(imgs[k], "image", absolutize(csrc));
        }
        return;
      }

      var kids = el.children;
      for (var j = 0; j < kids.length; j++) walk(kids[j]);
    }

    if (document.body) walk(document.body);
    return items;
  }

  function send(items) {
    if (!items || !items.length) {
      console.warn(TAG, "found no headings, paragraphs or images on this page. If your site renders with JavaScript, the snippet may be loading before the content does — tell us at your dashboard and we'll look.");
      return;
    }
    try {
      fetch(origin + "/api/content/" + encodeURIComponent(token) + "/report", {
        method: "POST",
        // text/plain keeps this a "simple" request, so there's no CORS preflight.
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ url: location.href, items: items })
      })
        .then(function (r) {
          if (r.ok) console.log(TAG, "connected — sent " + items.length + " editable items to your dashboard");
          else console.warn(TAG, "the dashboard rejected this page's contents (HTTP " + r.status + ")");
        })
        .catch(function (e) { console.warn(TAG, "couldn't reach " + origin, e); });
    } catch (e) { console.warn(TAG, e); }
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  fetch(origin + "/api/overrides/" + encodeURIComponent(token))
    .then(function (r) {
      if (r.status === 404) {
        throw new Error("this pairing key isn't recognised — it was probably reset. Copy the snippet again from your dashboard.");
      }
      if (!r.ok) throw new Error("the dashboard answered HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      onReady(function () {
        var edits = data.items || [];
        // Nothing to read? Apply straight away so there's no flash of old text.
        // When a read IS pending we must not write first — the "original" we
        // record is the key that carries existing edits across on the server.
        if (!data.report) apply(edits);

        whenSettled(function () {
          if (data.report) send(collect());
          apply(edits);
          keepApplied(edits);
          if (!data.report) {
            console.log(TAG, "connected — applied " + edits.length + " edit" + (edits.length === 1 ? "" : "s"));
          }
        });
      });
    })
    .catch(function (err) { console.warn(TAG, err && err.message ? err.message : err); });
})();
`;

export function GET(): Response {
  return new Response(CONNECT_JS, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

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

  function apply(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      try {
        var el = document.querySelector(it.selector);
        if (!el) continue;
        if (it.kind === "text") {
          el.textContent = it.value;
        } else if (it.kind === "image") {
          el.removeAttribute("srcset");
          el.setAttribute("src", it.value);
        } else if (it.kind === "video") {
          var source = el.querySelector && el.querySelector("source");
          if (source) source.setAttribute("src", it.value);
          el.setAttribute("src", it.value);
          if (el.load) try { el.load(); } catch (e2) {}
        }
      } catch (e3) {}
    }
  }

  // "body > div:nth-of-type(2) > p:nth-of-type(3)" — same shape the dashboard
  // stores, so a reported selector is always queryable by apply() above.
  function cssPath(el) {
    var segments = [];
    var node = el;
    while (node && node.tagName) {
      var tag = node.tagName.toLowerCase();
      if (tag === "body" || tag === "html") break;
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
      console.warn(TAG, "found nothing editable on this page — is the snippet on a page with real content?");
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
        // Read the page BEFORE applying edits, so a re-sync records the site's
        // own text as "original" rather than the previous edit — that key is
        // what carries existing edits across on the server.
        var pending = data.report ? collect() : null;
        var edits = data.items || [];
        apply(edits);
        if (pending) setTimeout(function () { send(pending); }, 0);
        else console.log(TAG, "connected — applied " + edits.length + " edit" + (edits.length === 1 ? "" : "s"));
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

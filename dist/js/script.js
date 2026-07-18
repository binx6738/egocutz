/* EGO CUTZ — interactions
   GSAP entrance + scroll reveals (transform/opacity only),
   lazy Instagram embeds, live open-now status. */
(function () {
  "use strict";

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- First-visit launch cleanup ---------- */
  var launchRoot = document.documentElement;
  if (launchRoot.classList.contains("is-launching")) {
    var launchTail = document.querySelector(".page-enter--7");
    var finishLaunch = function () {
      launchRoot.classList.remove("is-launching");
      launchRoot.classList.add("is-ready");
    };
    if (launchTail) launchTail.addEventListener("animationend", finishLaunch, { once: true });
    window.setTimeout(finishLaunch, 1600);
  }

  /* ---------- Header state ---------- */
  var head = document.getElementById("siteHead");
  var hero = document.getElementById("top");
  var onScroll = function () {
    var pastHero = hero
      ? hero.getBoundingClientRect().bottom <= head.offsetHeight
      : window.scrollY > 12;
    head.classList.toggle("is-scrolled", pastHero);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- Open-now status (America/New_York) ---------- */
  // [open, close] in minutes from midnight; JS day index (0 = Sunday)
  var HOURS = { 2: [960, 1200], 3: [960, 1200], 4: [960, 1200], 5: [960, 1200], 6: [600, 1020] };
  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function nyNow() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).formatToParts(new Date());
    var get = function (t) {
      var p = parts.find(function (x) { return x.type === t; });
      return p ? p.value : "";
    };
    return {
      day: DAY_NAMES.indexOf(get("weekday")),
      mins: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10)
    };
  }

  function fmt(mins) {
    var h = Math.floor(mins / 60);
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    var m = mins % 60;
    return h12 + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ampm;
  }

  function updateStatus() {
    var chip = document.getElementById("openStatus");
    if (!chip) return;
    var now = nyNow();
    if (now.day < 0) return; // Intl fallback — keep static text
    var today = HOURS[now.day];
    var label, cls;
    if (today && now.mins >= today[0] && now.mins < today[1]) {
      label = "Open now · closes " + fmt(today[1]);
      cls = "is-open";
    } else if (today && now.mins < today[0]) {
      label = "Closed · opens today " + fmt(today[0]);
      cls = "is-closed";
    } else {
      var d = now.day;
      for (var i = 1; i <= 7; i++) {
        var next = (d + i) % 7;
        if (HOURS[next]) {
          label = "Closed · opens " + DAY_NAMES[next] + " " + fmt(HOURS[next][0]);
          break;
        }
      }
      cls = "is-closed";
    }
    var dot = chip.querySelector(".status-chip__dot");
    chip.textContent = label;
    if (dot) chip.prepend(dot);
    chip.classList.remove("is-open", "is-closed");
    chip.classList.add(cls);

    // highlight today's row in the hours table
    var rows = document.querySelectorAll("#hoursTable tr");
    rows.forEach(function (r) {
      r.classList.toggle("is-today", parseInt(r.getAttribute("data-day"), 10) === now.day);
    });
  }
  try { updateStatus(); } catch (e) { /* keep static hours text */ }

  /* ---------- Lazy Instagram embeds ---------- */
  var embedLoaded = false;
  function loadEmbeds() {
    if (embedLoaded) return;
    embedLoaded = true;
    var s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.onload = function () {
      if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
      markLoadedShells();
    };
    document.body.appendChild(s);
  }

  // remove shimmer once Instagram swaps the blockquote for its iframe
  function markLoadedShells() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var pending = false;
      document.querySelectorAll(".ig-shell").forEach(function (shell) {
        if (shell.classList.contains("is-loaded")) return;
        if (shell.querySelector("iframe")) shell.classList.add("is-loaded");
        else pending = true;
      });
      if (!pending || tries > 40) clearInterval(timer);
    }, 500);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            loadEmbeds();
            io.disconnect();
          }
        });
      },
      { rootMargin: "900px 0px" }
    );
    document.querySelectorAll(".ig-shell").forEach(function (el) { io.observe(el); });
  } else {
    loadEmbeds();
  }

  /* ---------- GSAP ---------- */
  if (typeof gsap === "undefined") return;
  if (/[?&]noanim/.test(location.search)) return; // audit/debug escape hatch
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", function () {
    var EASE = "power4.out";

    /* Photo parallax — each print drifts at its own depth */
    gsap.utils.toArray('[data-hero="photo"]').forEach(function (card) {
      gsap.to(card, {
        yPercent: parseFloat(card.getAttribute("data-depth")) || -8,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 0.6
        }
      });
    });

    /* Watermark drift — scrubbed to scroll */
    gsap.to("#watermark", {
      xPercent: -14,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.6
      }
    });

    /* Section titles — same line reveal as hero */
    document.querySelectorAll(".section-head").forEach(function (headEl) {
      var lines = headEl.querySelectorAll("[data-title]");
      if (!lines.length) return;
      gsap.from(lines, {
        yPercent: 112,
        duration: 0.9,
        stagger: 0.09,
        ease: EASE,
        scrollTrigger: { trigger: headEl, start: "top 82%", once: true }
      });
    });

    /* Generic reveals */
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.from(el, {
        y: 26,
        autoAlpha: 0,
        duration: 0.75,
        ease: EASE,
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    /* Menu price rows — cascade per group */
    gsap.utils.toArray(".menu-group").forEach(function (group) {
      gsap.from(group.querySelectorAll(".price-row"), {
        y: 16,
        autoAlpha: 0,
        duration: 0.5,
        stagger: 0.05,
        ease: "power3.out",
        scrollTrigger: { trigger: group, start: "top 80%", once: true }
      });
    });

    return function () {}; // cleanup handled by matchMedia
  });
})();

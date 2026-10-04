/* =============================================================================
   BarberHood — scroll animations (GSAP 3 + ScrollTrigger + Lenis)
   -----------------------------------------------------------------------------
   Rules respected here:
   - Only `transform` and `opacity` are animated (no layout props).
   - Every animation plays ONCE (`once: true`), starting around "top 80%".
   - `.icon-svg-service` is NEVER animated and its transform is NEVER cleared
     (it relies on `transform: translate(-50%)` for centering).
   - CSS `transition: all ease .3s` is temporarily disabled on animated elements
     (class `.is-animating`) so it cannot fight GSAP, then re-enabled and the
     inline transform/opacity are cleared so hover effects keep working.
   - `prefers-reduced-motion: reduce` => no animation at all, everything visible.
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger);

/* -----------------------------------------------------------------------------
   1. Tunables
   -------------------------------------------------------------------------- */

const CONFIG = {
  // Common ScrollTrigger start point
  START: "top 80%",

  // Easing
  EASE_SLIDE: "power3.out",
  EASE_FADE: "power2.out",

  // Durations (seconds)
  DUR_HERO_IMG: 1.2, // .clipper-img fade
  DUR_HERO_SLIDE: 0.9, // hero text / buttons / social slide-in
  DUR_SERVICE: 1.0, // services slide-in
  DUR_ABOUT: 1.0, // about-us fade

  // Staggers (seconds)
  STAGGER_HERO: 0.15,
  STAGGER_ABOUT: 0.15,

  // Offsets (px)
  X_HERO: -80, // hero elements come from the left
  X_SERVICE: 200, // services come from the page edges (±)

  // Utility class that kills CSS transitions while GSAP animates
  LOCK_CLASS: "is-animating",

  // Class set on <html> before first paint to avoid a flash of content
  PREHIDE_CLASS: "anim-prehide",
};

/* -----------------------------------------------------------------------------
   2. Lenis <-> ScrollTrigger integration
   -----------------------------------------------------------------------------
   The Lenis instance is created in the inline <script> in <head>
   (global `const lenis`). Its own requestAnimationFrame loop has been REMOVED
   from that script: Lenis is now driven exclusively by GSAP's ticker, so it is
   never updated twice per frame and stays in sync with ScrollTrigger.
   -------------------------------------------------------------------------- */

const lenisInstance = typeof lenis !== "undefined" ? lenis : window.lenis;

if (lenisInstance) {
  // Keep ScrollTrigger in sync with Lenis' virtual scroll position
  lenisInstance.on("scroll", ScrollTrigger.update);

  // Drive Lenis from GSAP's ticker (GSAP ticker time is in seconds, Lenis in ms)
  gsap.ticker.add((time) => lenisInstance.raf(time * 1000));

  // Avoid GSAP's lag smoothing fighting the smooth-scroll interpolation
  gsap.ticker.lagSmoothing(0);
}

/* -----------------------------------------------------------------------------
   3. Helpers
   -------------------------------------------------------------------------- */

/** Resolve a selector / array of selectors to a flat array of real elements. */
function els(...selectors) {
  return selectors.flatMap((sel) => gsap.utils.toArray(sel));
}

/** Disable CSS transitions on the given elements while GSAP animates them. */
function lockTransitions(targets) {
  targets.forEach((el) => el.classList.add(CONFIG.LOCK_CLASS));
}

/**
 * Clean-up after an animation:
 *  - remove the inline transform/opacity GSAP wrote, so CSS :hover rules
 *    (box-shadow, scale, background…) behave exactly as before;
 *  - re-enable the CSS transitions.
 * NOTE: clearProps is limited to "transform,opacity" on purpose — it is only
 * applied to the elements we animated, never to `.icon-svg-service`.
 */
function releaseTargets(targets) {
  gsap.set(targets, { clearProps: "transform,opacity" });
  targets.forEach((el) => el.classList.remove(CONFIG.LOCK_CLASS));
}

/** Reveal the document once the initial (hidden) state is in place. */
function revealDocument() {
  document.documentElement.classList.remove(CONFIG.PREHIDE_CLASS);
}

/* -----------------------------------------------------------------------------
   4. Animations — only when motion is allowed
   -----------------------------------------------------------------------------
   gsap.matchMedia() runs the callback immediately if the query matches and
   automatically reverts every tween/ScrollTrigger created inside it if the user
   switches to "reduce" at runtime (OS-level change), leaving content visible.
   -------------------------------------------------------------------------- */

const mm = gsap.matchMedia();

mm.add("(prefers-reduced-motion: no-preference)", () => {
  /* ---------------------------------------------------------------------------
     4.1 HERO
     - .clipper-img: fade only, no movement.
     - everything else: slide in from the left (x: -80 -> 0) + fade, staggered.
     The hero is above the fold, so the "top 80%" condition is already satisfied
     on load and ScrollTrigger fires the timeline immediately after refresh.
     ------------------------------------------------------------------------ */
  const heroImg = els(".hero-section .clipper-img");
  const heroSlide = els(
    ".hero-section .hero-left-info",
    ".hero-section .hero-title h1",
    ".hero-section .hero-buttons",
    ".hero-section .hero-social"
  );
  const heroAll = [...heroImg, ...heroSlide];

  if (heroAll.length) {
    lockTransitions(heroAll);

    const heroTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero-section",
        start: CONFIG.START,
        once: true,
      },
      onComplete: () => releaseTargets(heroAll),
    });

    // Fade-only for the clipper image (no transform at all)
    heroTl.from(
      heroImg,
      {
        opacity: 0,
        duration: CONFIG.DUR_HERO_IMG,
        ease: CONFIG.EASE_FADE,
        immediateRender: true, // initial state applied at creation => no flash
      },
      0
    );

    // Slide-in from the left for the rest of the hero
    heroTl.from(
      heroSlide,
      {
        x: CONFIG.X_HERO,
        opacity: 0,
        duration: CONFIG.DUR_HERO_SLIDE,
        ease: CONFIG.EASE_SLIDE,
        stagger: CONFIG.STAGGER_HERO,
        immediateRender: true,
      },
      0
    );
  }

  /* ---------------------------------------------------------------------------
     4.2 SERVICES
     One independent ScrollTrigger per .services-wrapper (3 of them):
     .svg-service comes from the left edge, .service from the right edge,
     both at the same time. The section title is not animated.
     ------------------------------------------------------------------------ */
  gsap.utils.toArray(".services-section .services-wrapper").forEach((wrapper) => {
    const svg = wrapper.querySelector(".svg-service");
    const card = wrapper.querySelector(".service");
    const pair = [svg, card].filter(Boolean);

    if (!pair.length) return;

    lockTransitions(pair);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrapper,
        start: CONFIG.START,
        once: true,
      },
      // `.service` has `transition: all ease .3s` + a :hover box-shadow —
      // clearing transform/opacity keeps that hover intact.
      onComplete: () => releaseTargets(pair),
    });

    if (svg) {
      tl.from(
        svg,
        {
          x: -CONFIG.X_SERVICE,
          opacity: 0,
          duration: CONFIG.DUR_SERVICE,
          ease: CONFIG.EASE_SLIDE,
          immediateRender: true,
        },
        0
      );
    }

    if (card) {
      tl.from(
        card,
        {
          x: CONFIG.X_SERVICE,
          opacity: 0,
          duration: CONFIG.DUR_SERVICE,
          ease: CONFIG.EASE_SLIDE,
          immediateRender: true,
        },
        0
      );
    }
  });

  /* ---------------------------------------------------------------------------
     4.3 ABOUT US
     Pure fade (no movement) for every element, one timeline, light stagger.
     ------------------------------------------------------------------------ */
  const aboutTargets = els(
    ".about-us-section .title-about-us",
    ".about-us-section .description-about-us",
    ".about-us-section .social-about-us",
    ".about-us-section .t-1",
    ".about-us-section .t-2",
    ".about-us-section .t-3"
  );

  if (aboutTargets.length) {
    lockTransitions(aboutTargets);

    gsap.from(aboutTargets, {
      opacity: 0,
      duration: CONFIG.DUR_ABOUT,
      ease: CONFIG.EASE_FADE,
      stagger: CONFIG.STAGGER_ABOUT,
      immediateRender: true,
      scrollTrigger: {
        trigger: ".about-us-section",
        start: CONFIG.START,
        once: true,
      },
      onComplete: () => releaseTargets(aboutTargets),
    });
  }

  // Initial hidden state is now in the DOM -> safe to show the page.
  revealDocument();

  // Cleanup when the media query stops matching (user enables reduced motion)
  return () => {
    [...heroAll, ...aboutTargets].forEach((el) =>
      el.classList.remove(CONFIG.LOCK_CLASS)
    );
    gsap.utils
      .toArray(".services-section .svg-service, .services-section .service")
      .forEach((el) => el.classList.remove(CONFIG.LOCK_CLASS));
  };
});

// Reduced motion (or no animation built for any other reason):
// make absolutely sure nothing stays hidden.
revealDocument();

/* -----------------------------------------------------------------------------
   5. Layout corrections
   -------------------------------------------------------------------------- */

// Gallery + about-us images are lazy-loaded: their height is only known once
// they are decoded, which shifts every trigger position. Recalculate on load.
window.addEventListener("load", () => {
  ScrollTrigger.refresh();
});

// Web fonts (Julee / Inter) also change text metrics after first paint.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

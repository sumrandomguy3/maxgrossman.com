/* Photo viewer.
 *
 * Click any gallery photo and it opens full-size in the middle of the screen.
 * The arrows (or the ← → keys, or a swipe on a phone) step through every photo
 * on that page; the X, the Esc key, or a click on the backdrop closes it.
 *
 * Photos that are already inside a link — the work cards and shop cards, which
 * are meant to take you to another page — are deliberately left alone.
 *
 * Nothing to configure: this file is pulled into every page by the shared
 * footer (partials/footer.html), so new pages get it automatically.
 */
(() => {
  const photos = [...document.querySelectorAll("figure img")].filter(
    (img) => !img.closest("a")
  );
  if (!photos.length) return;

  let index = 0;
  let lastFocused = null;

  const overlay = document.createElement("div");
  overlay.className = "mg-lb";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Photo viewer");
  overlay.innerHTML =
    '<button class="mg-lb-btn mg-lb-close" aria-label="Close photo viewer">&times;</button>' +
    '<button class="mg-lb-btn mg-lb-prev" aria-label="Previous photo">&#8249;</button>' +
    '<figure class="mg-lb-stage">' +
    '<img class="mg-lb-img" alt="">' +
    '<figcaption class="mg-lb-cap"><span class="mg-lb-text"></span><span class="mg-lb-count"></span></figcaption>' +
    "</figure>" +
    '<button class="mg-lb-btn mg-lb-next" aria-label="Next photo">&#8250;</button>';
  document.body.append(overlay);

  const stageImg = overlay.querySelector(".mg-lb-img");
  const caption = overlay.querySelector(".mg-lb-text");
  const counter = overlay.querySelector(".mg-lb-count");
  const closeBtn = overlay.querySelector(".mg-lb-close");
  const prevBtn = overlay.querySelector(".mg-lb-prev");
  const nextBtn = overlay.querySelector(".mg-lb-next");

  // A lone photo has nothing to page through.
  if (photos.length < 2) {
    prevBtn.hidden = true;
    nextBtn.hidden = true;
  }

  const show = (i) => {
    index = (i + photos.length) % photos.length;
    const source = photos[index];
    stageImg.src = source.currentSrc || source.src;
    stageImg.alt = source.alt || "";
    caption.textContent = source.alt || "";
    counter.textContent = photos.length > 1 ? index + 1 + " / " + photos.length : "";
  };

  const open = (i) => {
    lastFocused = document.activeElement;
    show(i);
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };

  const close = () => {
    overlay.hidden = true;
    document.body.style.overflow = "";
    stageImg.removeAttribute("src");
    if (lastFocused) lastFocused.focus();
  };

  photos.forEach((photo, i) => {
    photo.classList.add("mg-zoomable");
    photo.tabIndex = 0;
    photo.setAttribute("role", "button");
    photo.addEventListener("click", () => open(i));
    photo.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(i);
      }
    });
  });

  prevBtn.addEventListener("click", () => show(index - 1));
  nextBtn.addEventListener("click", () => show(index + 1));
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    // only a click on the backdrop itself, not on the photo or the buttons
    if (e.target === overlay || e.target.classList.contains("mg-lb-stage")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  });

  // swipe left/right on a touch screen
  let startX = null;
  overlay.addEventListener(
    "touchstart",
    (e) => {
      startX = e.changedTouches[0].clientX;
    },
    { passive: true }
  );
  overlay.addEventListener(
    "touchend",
    (e) => {
      if (startX === null || photos.length < 2) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    },
    { passive: true }
  );
})();

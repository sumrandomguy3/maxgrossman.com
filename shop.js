/* Store checkout wiring.
 *
 * ── To turn on PayPal checkout ──────────────────────────────────────────────
 * Put your PayPal account email (or PayPal merchant ID) between the quotes
 * below and save. Every "Add to cart" button then sends the order to your
 * PayPal cart, with the size/color/wood choice attached. Nothing else to change.
 *
 *   const PAYPAL_MERCHANT = "you@example.com";
 *
 * Until this is filled in, the buttons fall back to opening a pre-filled order
 * email to maxgrossman@outlook.com, so the shop still works today.
 */
const PAYPAL_MERCHANT = "maxgrossman@outlook.com"; // ← your PayPal email; enables PayPal checkout
const ORDER_EMAIL = "maxgrossman@outlook.com";

document.querySelectorAll("form.pp-form").forEach((form) => {
  if (PAYPAL_MERCHANT) {
    // PayPal mode: point the cart at your account.
    form.querySelector('input[name="business"]').value = PAYPAL_MERCHANT;
    return;
  }
  // Fallback mode: no PayPal yet → email-to-order.
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = form.dataset.item;
    const price = form.dataset.price;
    const opts = [...form.querySelectorAll("select")]
      .map((s) => `${s.closest(".mg-variant").querySelector("label").textContent.trim()}: ${s.value}`)
      .join(", ");
    const subject = `Order: ${item}`;
    const body =
      `Hi Max,\n\nI'd like to order:\n\n` +
      `• ${item} — $${price}\n` +
      (opts ? `• ${opts}\n` : "") +
      `\nThanks!`;
    window.location.href =
      `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
});

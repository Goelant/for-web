// Access shared Solid.js — never bundle your own copy!
const { createSignal, createEffect } = window.__STOAT__["solid-js"];
const { render } = window.__STOAT__["solid-js/web"];

// ---------------------------------------------------------------------------
// Modal component (vanilla DOM + Solid reactivity)
// ---------------------------------------------------------------------------

/**
 * Mount a simple modal into the document body.
 *
 * @param {() => boolean} visible  Solid signal — true when the modal is open
 * @param {() => void}    close    Callback to close the modal
 */
function mountModal(visible, close) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  render(() => {
    // Style objects use MD3 CSS custom properties so the modal
    // automatically follows the app's current theme.

    const overlayStyle = () => ({
      display: visible() ? "flex" : "none",
      position: "fixed",
      inset: "0",
      "z-index": "9999",
      "align-items": "center",
      "justify-content": "center",
      background: "rgba(0, 0, 0, 0.5)",
    });

    const cardStyle = () => ({
      background: "var(--md-sys-color-surface-container-high, #2b2d31)",
      color: "var(--md-sys-color-on-surface, #fff)",
      "border-radius": "16px",
      padding: "32px",
      "min-width": "280px",
      "text-align": "center",
      "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
    });

    const buttonStyle = () => ({
      "margin-top": "20px",
      padding: "8px 24px",
      border: "none",
      "border-radius": "20px",
      background: "var(--md-sys-color-primary, #5865f2)",
      color: "var(--md-sys-color-on-primary, #fff)",
      cursor: "pointer",
      "font-size": "14px",
    });

    // Build the DOM tree imperatively.
    // createEffect re-runs whenever `visible()` changes.
    const el = document.createElement("div");

    createEffect(() => {
      Object.assign(el.style, overlayStyle());
      el.innerHTML = "";

      if (visible()) {
        const card = document.createElement("div");
        Object.assign(card.style, cardStyle());

        card.innerHTML =
          '<h2 style="margin:0 0 8px">Hello World</h2>' +
          '<p style="margin:0;opacity:0.8">This modal was created by a plugin!</p>';

        const btn = document.createElement("button");
        Object.assign(btn.style, buttonStyle());
        btn.textContent = "Close";
        btn.onclick = close;

        card.appendChild(btn);
        el.appendChild(card);
      }
    });

    return el;
  }, container);
}

// ---------------------------------------------------------------------------
// SVG icon for the sidebar button
// ---------------------------------------------------------------------------

function WaveIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "currentColor");
  svg.innerHTML =
    '<path d="M7 22V11l-2-2 1.4-1.4L8 9.2V6l2-2v7l5.15-5.15' +
    "a1.5 1.5 0 0 1 2.12 2.12L14 11.24l3.57-3.57a1.5 1.5 0 0 1 2.12" +
    " 2.12L15 14.36l2.69-2.69a1.5 1.5 0 0 1 2.12 2.12L14.5 19.1A6.5" +
    ' 6.5 0 0 1 10 22H7z"/>';
  return svg;
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export default {
  name: "hello-world",
  version: "1.0.0",

  setup(api) {
    // Create a signal that controls modal visibility
    const [showModal, setShowModal] = createSignal(false);

    // Mount the modal into the DOM (hidden by default)
    mountModal(showModal, () => setShowModal(false));

    // Add a button to the sidebar server list
    api.registerSidebarAction({
      icon: () => WaveIcon(),
      tooltip: "Say Hello",
      onClick: () => setShowModal(true),
    });

    console.log("[hello-world] Plugin loaded!");
  },
};
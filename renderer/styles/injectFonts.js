/**
 * CSS-in-JS solution for font loading in web mode
 * This approach bypasses Next.js CSS loader issues
 */
export function injectFontStyles() {
  if (typeof document !== "undefined") {
    // Check if styles are already injected
    if (document.getElementById("pacifico-font-styles")) return;

    // Create style element
    const style = document.createElement("style");
    style.id = "pacifico-font-styles";

    // Add font-face declaration
    style.textContent = `
      @font-face {
        font-family: 'Pacifico';
        src: url('/fonts/Pacifico.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    `;

    // Append to head
    document.head.appendChild(style);
    console.log("Pacifico font styles injected via JS");
  }
}

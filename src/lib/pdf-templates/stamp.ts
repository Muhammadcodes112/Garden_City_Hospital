// Shared "official" circular hospital stamp — rendered as plain HTML/CSS (no
// SVG textPath) so it renders identically and reliably across the headless
// PDF renderer and every letterhead template that includes this CSS block.
export const HOSPITAL_STAMP_CSS = `
  .hospital-stamp { position: absolute; width: 84px; height: 84px; pointer-events: none; }
  .hospital-stamp .stamp-ring {
    width: 100%; height: 100%; border-radius: 50%;
    border: 2px solid rgba(8,104,56,0.6);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    transform: rotate(-12deg);
    color: rgba(8,104,56,0.65);
    font-family: Arial, sans-serif;
    text-align: center;
    position: relative;
  }
  .hospital-stamp .stamp-ring::before {
    content: ""; position: absolute; inset: 5px;
    border: 1px solid rgba(8,104,56,0.6); border-radius: 50%;
  }
  .hospital-stamp .stamp-line1 { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.06em; }
  .hospital-stamp .stamp-line2 { font-size: 5.5pt; font-weight: 700; margin-top: 1px; line-height: 1.1; padding: 0 6px; }
  .hospital-stamp .stamp-line3 { font-size: 5.5pt; margin-top: 2px; letter-spacing: 0.08em; }
`;

export function hospitalStampHtml(style = ""): string {
  return `<div class="hospital-stamp" style="${style}"><div class="stamp-ring"><span class="stamp-line1">GARDEN CITY</span><span class="stamp-line2">SPECIALIST HOSPITAL</span><span class="stamp-line3">&#9733; OFFICIAL &#9733;</span></div></div>`;
}

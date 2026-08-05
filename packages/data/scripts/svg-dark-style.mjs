// Dark neutral restyle injected into every downloaded map SVG so the offline
// fallback maps match the app's near-black register instead of tarkov.dev's
// bright schematic palette. Appended as the last <style> so it wins the
// cascade over style_common and the per-map style blocks.
export const SVG_DARK_STYLE = `  <style id="style_dark">
    /* Dark neutral restyle so SVG fallback maps match the app register.
       Appended last so it wins the cascade over style_common and per-map styles. */
    .land { fill:#161615 }
    .trees { fill:#151a16 }
    .rock { fill:#1d1d1b }
    .water { fill:#16202c }
    .cement { fill:#262624 }
    .wood { fill:#221c15 }
    .tarmac { fill:#1e1e1d }
    .gravel { fill:#201d18 }
    .building { fill:#2e2e2c }
    .floor { fill:#1b1b1a }
    .locked { fill:#141413 }
    .structure { fill:#2a2a28 }
    .misc { fill:#232321 }
    .chopper { fill:#2e2e2c }
    .plane { fill:#3a3a38 }
    .stairs { fill:#6b5d2e }
    .task { fill:#8a8a88 }
    .map_border { stroke:#3f3f3d }
    .wall { stroke:#4a4a47 }
    .fence { stroke:#33402f }
    .road_tarmac { stroke:#343432 }
    .road_gravel { stroke:#3f382e }
    .railroad { stroke:#4a332b }
    .powerline { stroke:#57502a }
    .danger, .danger_small { fill:#7f1d1d;fill-opacity:.35;stroke:#991b1b }
  </style>
</svg>`;

/** Append the dark style block to raw SVG markup (idempotent). */
export function applyDarkStyle(svgSource) {
  if (svgSource.includes('style_dark')) return svgSource;
  return svgSource.replace(/<\/svg>\s*$/, SVG_DARK_STYLE);
}

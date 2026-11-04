/* Studygram's original pixel drawings. Each path is drawn on an integer grid. */
const IndiePixel = (() => {
  const ink = '#22221f';
  const ivory = '#f8f5eb';
  const blue = '#afc9ed';
  const yellow = '#f7df81';
  const pink = '#ecabc7';
  const lavender = '#d9cdf1';
  const mint = '#cce6cf';
  const stroke = (path, color = ink) => `<path fill="${color}" d="${path}"/>`;
  const rect = (x, y, width, height, color = ink) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`;

  const drawings = {
    book: stroke('M3 5h7v1h4V5h7v1h1v13h-8v1h-4v-1H2V6h1z') +
      stroke('M4 7h6v1h1v10h-1v-1H4zM14 8h1V7h5v10h-5v1h-1z', ivory) +
      stroke('M5 9h4v1H5zM5 12h4v1H5zM16 9h3v1h-3zM16 12h3v1h-3z', '#6b6b66') + rect(17, 7, 2, 7, pink),
    heart: stroke('M4 4h6v2h4V4h6v2h2v7h-2v2h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4v-2H2V6h2z') +
      stroke('M5 6h4v2h6V6h4v2h1v4h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4V8h1z', pink) + rect(6, 8, 3, 2, ivory),
    sprout: stroke('M2 5h7v1h2v3h2V6h2V4h7v6h-2v2h-3v1h-4v3h5v2h-2v4H8v-4H6v-2h5v-3H7v-1H4v-2H2z') +
      stroke('M4 7h5v2h2v2H7v-1H5V9H4zM16 6h4v3h-2v2h-5v-1h2V8h1z', mint) + rect(9, 18, 6, 3, pink),
    shield: stroke('M3 3h18v13h-2v2h-2v2h-3v2h-4v-2H7v-2H5v-2H3z') +
      stroke('M5 5h14v10h-2v2h-2v2h-2v1h-2v-1H9v-2H7v-2H5z', blue) +
      stroke('M11 7h2v3h3v2h-3v4h-2v-4H8v-2h3z', ink),
    palette: stroke('M6 3h12v2h3v3h2v6h-5v2h3v3h-3v2H8v-2H4v-2H2V8h2V5h2z') +
      stroke('M7 5h10v2h3v2h1v3h-4v2h-2v3h3v2H8v-2H5v-2H4V9h2V7h1z', pink) +
      rect(6, 9, 3, 3, ink) + rect(10, 6, 3, 3, ivory) + rect(15, 7, 3, 3, blue) + rect(8, 14, 4, 3, yellow),
    music: stroke('M8 5h5V3h7v14h-2v2h-5v-2h-1v-3h2v-1h4V7h-5v2h-3v11H8v2H3v-2H2v-3h2v-1h4z') +
      stroke('M10 6h4V5h4v1h-5v2h-3zM4 18h4v2H4zM14 15h4v2h-4z', lavender),
    pen: stroke('M16 2h5v2h2v5h-2v2h-2v2h-2v2h-2v2h-2v2h-2v2H7v1H2v-5h1v-4h2v-2h2V9h2V7h2V5h3V3h2z') +
      stroke('M16 4h4v2h1v2h-2v2l-5-5h2z', pink) + stroke('M12 6l5 5-6 6-5-5z', yellow) +
      stroke('M5 14l4 4H7v1H5v1H4v-3h1z', ivory),
    flask: stroke('M7 2h10v4h-2v6h2v2h2v3h2v4h-2v1H5v-1H3v-4h2v-3h2v-2h2V6H7z') +
      stroke('M9 4h6v1h-2v8h2v2h2v2h2v3H5v-3h2v-2h2v-2h2V5H9z', ivory) +
      stroke('M7 16h3v1h4v-2h2v2h2v2H6v-2h1z', mint) + rect(12, 13, 2, 2, '#518465'),
    computer: stroke('M5 2h13v1h2v15h-2v1h-2v2h5v2H3v-2h5v-2H6v-1H4V3h1z') +
      stroke('M6 4h12v13H6zM10 19h4v2h-4z', ivory) + rect(7, 5, 10, 8) + rect(8, 6, 8, 6, blue) +
      rect(9, 8, 2, 2) + rect(13, 8, 2, 2) + rect(13, 15, 4, 1) + rect(7, 15, 2, 1, pink),
    bulb: stroke('M8 3h8v2h3v3h2v5h-2v3h-2v3h-2v3H9v-3H7v-3H5v-3H3V8h2V5h3z') +
      stroke('M8 5h8v2h2v2h1v3h-2v3h-2v2H9v-2H7v-3H5V9h2V7h1z', yellow) +
      stroke('M9 10h2v3h2v-3h2v4h-2v3h-2v-3H9z', '#956f28') + rect(10, 19, 4, 1, ivory),
    football: stroke('M8 2h8v2h4v4h2v8h-2v4h-4v2H8v-2H4v-4H2V8h2V4h4z') +
      stroke('M8 4h8v2h2v2h2v8h-2v2h-2v2H8v-2H6v-2H4V8h2V6h2z', ivory) +
      stroke('M10 8h4v2h2v4h-2v2h-4v-2H8v-4h2zM7 5h3v2H7zM14 5h3v2h-3zM5 11h2v4H5zM17 11h2v4h-2zM7 17h3v2H7zM14 17h3v2h-3z'),
    camera: stroke('M2 7h5V4h9v3h5v1h2v12H1V8h1z') +
      stroke('M3 9h18v9H3zM9 6h5v2H9z', lavender) +
      stroke('M10 9h5v2h2v5h-2v2h-5v-2H8v-5h2z') + rect(10, 11, 5, 5, blue) + rect(11, 12, 2, 2, ivory) + rect(17, 10, 3, 2, pink),
    eye: stroke('M7 5h10v2h3v2h2v2h1v2h-1v2h-2v2h-3v2H7v-2H4v-2H2v-2H1v-2h1V9h2V7h3z') +
      stroke('M7 7h10v2h3v2h1v2h-1v2h-3v2H7v-2H4v-2H3v-2h1V9h3z', ivory) +
      stroke('M10 7h4v2h2v6h-2v2h-4v-2H8V9h2z', blue) + rect(10, 10, 4, 4) + rect(10, 9, 2, 2, ivory),
    coffee: stroke('M3 8h14v2h5v7h-5v2h-2v2H5v-2H3zM8 2h2v4H8zM13 1h2v5h-2z') +
      stroke('M5 10h10v8h-2v1H7v-1H5zM17 12h3v3h-3z', pink) +
      stroke('M7 12h2v1h2v-1h2v3h-1v1H8v-1H7z', ink),
    cat: stroke('M4 3h3v2h2v2h6V5h2V3h3v8h2v8h-2v2H4v-2H2v-8h2z') +
      stroke('M6 5h1v2h2v2h6V7h2V5h1v7h2v6h-2v1H6v-1H4v-6h2z', lavender) +
      rect(7, 12, 3, 2) + rect(14, 12, 3, 2) + rect(11, 14, 2, 2, pink) +
      stroke('M9 16h2v1h2v-1h2v2H9z'),
    game: stroke('M5 6h14v2h3v3h1v8h-2v2h-5v-2h-2v-2h-4v2H8v2H3v-2H1v-8h1V8h3z') +
      stroke('M5 8h14v2h2v8h-4v-2h-2v-1H9v1H7v2H3v-8h2z', blue) +
      stroke('M6 10h2v2h2v2H8v2H6v-2H4v-2h2z') + rect(15, 10, 2, 2, '#943768') + rect(18, 13, 2, 2, '#943768'),
    brain: stroke('M6 4h5v2h2V4h5v2h3v4h2v7h-2v3h-5v2H8v-2H3v-3H1v-7h2V6h3z') +
      stroke('M6 6h4v2h4V6h4v2h2v3h1v5h-2v2h-4v2H9v-2H5v-2H3v-5h1V8h2z', pink) +
      stroke('M11 8h2v12h-2zM5 10h4v2H7v3H5zM15 10h4v5h-2v-3h-2z'),
    star: stroke('M10 2h4v5h2v2h6v4h-3v2h-2v2h2v5h-4v-2h-2v-2h-2v2H9v2H5v-5h2v-2H5v-2H2V9h6V7h2z') +
      stroke('M11 5h2v4h2v2h4v1h-2v2h-2v4h-1v-1h-4v1H9v-4H7v-2H5v-1h4V9h2z', yellow),
    lily: stroke('M10 2h4v3h3v2h3v3h2v9h-2v2H4v-2H2v-9h2V7h3V5h3z') +
      stroke('M11 4h2v3h4v2h2v3h1v6H4v-6h1V9h2V7h4z', lavender) +
      stroke('M6 11h12v6H6z', ivory) + rect(7, 12, 2, 2) + rect(15, 12, 2, 2) +
      stroke('M10 15h4v1h-4z', ink) + rect(6, 15, 2, 1, pink) + rect(16, 15, 2, 1, pink),
  };

  const hero = [
    // Desk and ambient pixel grid behind the terminal.
    stroke('M0 115h224v31H0z', '#8ca8d3'),
    stroke('M0 117h224v4H0zM0 141h224v1H0z', '#99b5df'),
    stroke('M15 128h192v4H15zM37 132h165v2H37z', '#7895c4'),
    Array.from({ length: 10 }, (_, x) => Array.from({ length: 5 }, (_, y) =>
      rect(13 + x * 22, 11 + y * 21, 1, 1, '#7c9bc9')).join('')).join(''),

    // Floating thought bubbles and wayfinding marks.
    `<g class="indie-art-spark" transform="translate(28 27)">${drawings.star}</g>`,
    `<g class="indie-art-heart" transform="translate(161 19)">${drawings.heart}</g>`,
    stroke('M195 43h2v4h4v2h-4v4h-2v-4h-4v-2h4zM16 65h2v3h3v2h-3v3h-2v-3h-3v-2h3zM181 70h2v4h4v2h-4v4h-2v-4h-4v-2h4z', ivory),
    stroke('M24 83h3v2h-3zM189 61h2v2h-2zM153 10h3v2h-3zM51 16h2v2h-2z', ink),

    // Chunky computer silhouette and its beveled case.
    stroke('M76 24h70v2h7v4h5v11h2v64h-2v9h-4v5H69v-3h-6v-6h-3V38h3v-9h5v-3h8z'),
    stroke('M146 28h6v4h4v10h2v62h-3v8h-4v4h-10V31h5z', '#aaa08e'),
    stroke('M75 27h68v2h5v5h3v73h-3v6H70v-3h-5v-4h-2V39h3v-8h4v-2h5z', '#e8d8b5'),
    stroke('M73 30h69v3h5v72h-4v4H69v-3h-3V40h3v-7h4z', ivory),
    stroke('M67 99h79v6h-4v4H69v-3h-2zM146 35h3v68h-3z', '#d3c19e'),

    // Recessed CRT, reflection, expressive eyes, and small drive slot.
    stroke('M76 38h60v3h4v4h2v37h-2v5h-4v3H76v-3h-4v-4h-2V45h2v-4h4z'),
    stroke('M77 41h58v3h4v4h1v33h-3v5H76v-4h-3V47h2v-4h2z', '#6778ad'),
    stroke('M81 44h50v3h4v3h2v29h-3v4H79v-4h-3V50h2v-3h3z', 'var(--indie-screen, #b7c9ec)'),
    stroke('M78 70h57v9h-3v3H80v-3h-2z', 'var(--indie-screen-shadow, #a4b8df)'),
    stroke('M78 49h4v-3h10v2h-8v3h-4v11h-2z', '#e0e9f7'),
    stroke('M85 57h13v2h2v10h-2v2H85v-2h-2V59h2zM113 57h13v2h2v10h-2v2h-13v-2h-2V59h2z'),
    stroke('M85 60h13v8H85zM113 60h13v8h-13z', ivory),
    rect(91, 61, 5, 6) + rect(119, 61, 5, 6),
    stroke('M101 72h2v2h6v-2h2v3h-2v2h-6v-2h-2z'),
    rect(82, 72, 7, 2, pink) + rect(125, 72, 7, 2, pink),
    rect(111, 95, 26, 6, '#9d9382') + rect(113, 96, 22, 2),
    rect(73, 96, 5, 5, '#796991') + rect(74, 97, 3, 3, mint),
    stroke('M149 63h7v1h-7zM149 66h7v1h-7zM149 69h7v1h-7zM149 72h7v1h-7z', '#69615a'),

    // Foreground books and small coffee cup.
    stroke('M24 104h29v2h5v8h4v14H23v-4h-4v-9h5z'),
    stroke('M22 116h35v4H22zM25 123h34v3H25z', lavender),
    stroke('M26 106h26v2h3v5H26z', yellow),
    stroke('M27 108h24v3H27zM24 117h31v2H24zM27 124h28v1H27z', ivory),
    rect(41, 109, 3, 5, pink),
    stroke('M174 105h22v3h8v10h-8v4h-3v3h-17v-3h-3v-4h-2v-10h3z'),
    stroke('M174 109h20v10h-3v4h-13v-3h-3v-4h-1zM196 110h6v6h-6v-2h4v-2h-4z', pink),
    rect(176, 108, 16, 2, '#7c5065'),
    stroke('M180 113h3v2h2v-2h3v4h-2v2h-4v-2h-2z', ivory),
    stroke('M179 101h2v-4h2v-3h-2v-2h-2v3h2v2h-2zM187 101h2v-4h2v-3h-2v-3h-2v4h2v2h-2z', ivory),

    // Keyboard, keycaps, cable, and mouse establish the physical desk.
    stroke('M149 111h8v6h-7v4h-4v-5h8v-2h-5z'),
    stroke('M73 117h67v2h4v3h3v3h2v6H65v-6h3v-3h2v-3h3z'),
    stroke('M73 119h67v2h3v3h2v3H68v-2h3v-3h2z', '#ecdec1'),
    stroke('M68 127h78v2H68z', '#b5a585'),
    Array.from({ length: 13 }, (_, x) => rect(76 + x * 5, 122, 3, 1, '#656057')).join(''),
    stroke('M74 124h9v1h-9zM85 124h5v1h-5zM93 124h28v1H93zM123 124h6v1h-6zM132 124h7v1h-7z', '#656057'),
    stroke('M155 123h10v2h2v6h-2v2h-12v-2h-2v-6h4z'),
    stroke('M154 126h10v5h-10z', ivory) + rect(158, 126, 3, 1, '#756a60'),
  ].join('');

  return (name, className = '') => {
    const drawing = name === 'hero' ? hero : Object.hasOwn(drawings, name) ? drawings[name] : '';
    const classes = String(className).split(/\s+/).filter(part => /^[a-zA-Z0-9_-]+$/.test(part)).join(' ');
    const viewBox = name === 'hero' ? '0 0 224 146' : '0 0 24 24';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="indie-pixel${classes ? ` ${classes}` : ''}" viewBox="${viewBox}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${drawing}</svg>`;
  };
})();

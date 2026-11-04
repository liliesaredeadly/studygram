const IndieAtlasArt = (() => {
  const range = length => Array.from({ length }, (_, index) => index);
  const plate = contents => `<svg viewBox="0 0 560 220" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${contents}</svg>`;
  const label = (x, y, text, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}" stroke="none" fill="currentColor" font-family="Georgia, serif" font-size="11" font-style="italic">${text}</text>`;
  const point = (x, y) => `<circle cx="${x}" cy="${y}" r="2" fill="currentColor" stroke="none"/>`;

  const leaf = `
    <circle cx="109" cy="103" r="65" opacity=".45"/>
    <circle cx="109" cy="103" r="58" stroke-dasharray="1 4" opacity=".38"/>
    <path d="M75 134C63 112 79 92 98 78c19-13 40-14 56-24-3 19-1 40-12 58-13 22-43 37-67 22Z" fill="currentColor" fill-opacity=".09"/>
    <path d="M65 151c17-24 37-46 73-80m-57 61c14-4 23-5 33-5m-25-5c17-5 29-7 42-10m-33 0c14-3 27-9 41-18m-32 8c14-2 22-8 37-18m-29 9c11-3 20-9 30-18m-23 11 24-16m-64 59c-6-9-6-17-4-25m13 14c-3-11-4-19-2-28m12 17c-1-9-1-19 2-27m9 16c-1-9 1-15 4-22m7 13 7-18" stroke-width=".85"/>
    <path d="M82 138q10-8 15-7m-7 10 21-10m-35-1 2-17m6 15-2-12m5 9 15-8m-10 5-2-13m7 6 14-5m-9-6-1-12m9 7 16-8m-7 0 2-11m5 4 11-7m-6 34 4-13m-14 27 13-8m-48 7q0-8 6-17m39 15 4-9m-13-7 10-6" opacity=".65" stroke-width=".65"/>
    <path d="M151 94l32-9 14-9m-43 35 29-8 15-13" stroke-dasharray="2 3" opacity=".65"/>
    ${label(109, 187, "I. Leaf", "middle")}
  `;

  const upperCells = range(14).map(i => {
    const x = 203 + i * 17;
    const y = 61 + [3, 1, -1, -2, -3, -2, -1, 0, 2, 3, 4, 5, 6, 6][i];
    return `<path d="M${x} ${y}q7-4 15 0l-1 9q-6 4-13 0z"/>`;
  }).join("");

  const palisadeCells = range(23).map(i => {
    const x = 204 + i * 10;
    const y = 77 + Math.floor(i / 7);
    const length = 26 + (i * 7) % 10;
    return `<path d="M${x} ${y}q4-3 7 1l-1 ${length - 3}q-3 6-6 1z" fill="currentColor" fill-opacity=".035"/><path d="M${x + 3} ${y + 7}v${length - 11}" opacity=".45"/>`;
  }).join("");

  const spongyCells = range(25).map(i => {
    const x = 208 + (i % 9) * 25 + (i * 7) % 6;
    const y = 120 + Math.floor(i / 9) * 14 + (i * 3) % 4;
    return `<path d="M${x} ${y}q5-5 12-3l6 5-3 5-11 1-6-3z" fill="currentColor" fill-opacity=".045"/>`;
  }).join("");

  const science = plate(`
    <g opacity=".85">${leaf}</g>
    <path d="M200 67q37-18 102-11 87 7 141 11l-5 85q-48 15-101 7-80-12-137-1Z" fill="currentColor" fill-opacity=".04"/>
    <path d="M201 64q39-16 101-10 88 6 142 11m-242 93q56-10 135 1 50 8 102-7m-235 4q54-8 133 2 52 7 100-8" stroke-width="1.3"/>
    <g stroke-width=".72">${upperCells}${palisadeCells}${spongyCells}</g>
    <path d="M293 132c9-12 31-13 48-3 15 9 20 16 29 24-19 8-37 9-58 2-19-6-27-14-19-23Z" fill="currentColor" fill-opacity=".12"/>
    <path d="M304 134q10-9 27-4 14 6 26 19-19 5-35-1-18-6-18-14Z"/>
    <path d="M310 135l12 13m-5-16 13 16m-5-16 14 17m-6-15 14 16" opacity=".55" stroke-width=".7"/>
    <g opacity=".8"><path d="M422 65l26-24h17m-49 50 35-12h14m-46 42 31-4h15m-102 34 76 15h26"/>${point(422, 65)}${point(416, 91)}${point(419, 121)}${point(363, 151)}</g>
    ${label(469, 44, "Epidermis")}${label(469, 82, "Palisade cells")}${label(469, 120, "Spongy cells")}${label(469, 169, "Leaf vein")}
    ${label(324, 187, "II. Leaf tissue · schematic", "middle")}
  `);

  const academy = plate(`
    <path d="M124 173h310m-291 9h290" opacity=".35"/>
    <path d="M187 39h171q8 0 8 8v111H177V50q0-11 10-11Zm170 0 14 9 2 110h-7m-153 0-10 15h143l-10-15" fill="currentColor" fill-opacity=".06"/>
    <rect x="193" y="52" width="156" height="79" rx="8"/><rect x="200" y="59" width="142" height="65" rx="3" opacity=".55"/>
    <path d="M232 75h79v37h-79zM232 83h79m-74-4h5m5 0h5m5 0h5M244 96l6 5-6 5m12 0h14"/>
    <path d="M314 143h28m-153 0h3M218 180h110l19 15H199zm-7 7h121" stroke-width="1.4"/>
    <path d="M144 65h15m-7-8v16m246 38h21m-11-10v20M134 133h18" opacity=".55"/>
  `);

  const mindset = plate(`
    <circle cx="300" cy="89" r="47" fill="currentColor" fill-opacity=".14"/>
    <path d="M80 156q50-55 101-29l30 18q37-57 64-22l19 27q31-37 57-27l32 22q37-23 99 6v24H80Z" fill="currentColor" fill-opacity=".13"/>
    <path d="M75 160q80-9 132 0t108 0q59-11 164 0m-377 16h96m157 0h93m-206-5h101m-123 12h133m-110 9h80" opacity=".65"/>
    <path d="M118 81v14m-7-7h14m68-30v10m-5-5h10m224 28v12m-6-6h12m27-35v9m-4-5h8" opacity=".75"/>
    ${point(151, 102)}${point(230, 52)}${point(369, 53)}${point(381, 103)}
  `);

  const growth = plate(`
    <path d="M113 72q85-19 167 24 82-43 167-24l-13 96q-78-13-154 27-76-40-154-27Z" fill="currentColor" fill-opacity=".09"/>
    <path d="M120 62q85-16 160 27 75-43 160-27l-14 98q-82-8-146 30-64-38-146-30Z"/>
    <path d="M280 89v99m-140-99q66-7 124 25m-122-9q64-7 122 25m-119-7q64-6 119 24m-117-8q62-4 117 25m32-49q51-26 119-25m-119 42q51-26 115-25m-115 42q45-23 108-26m-108 42q44-23 104-26" opacity=".68"/>
    <path d="M280 87q8-39 27-58m-12 23q-25-1-29-20 26 1 29 20Zm4-7q4-23 27-24-2 19-27 24Z" fill="currentColor" fill-opacity=".13"/>
  `);

  const defence = plate(`
    <rect x="119" y="36" width="322" height="147"/>
    <path d="M119 73h322m-322 37h322m-322 37h322M172 36v147m54-147v147m54-147v147m54-147v147m54-147v147" opacity=".28"/>
    <path d="M120 151q44-10 55-42 8-24 52-34 24-6 26-39m-119 131q51-16 64-49 8-22 42-32 31-8 35-50m-121 143q53-18 66-51 7-19 37-29 38-11 46-63m13 145q-15-32 14-52 37-24 93-5m-80 57q-13-17 6-35 31-22 79-8m-60 43q-9-10 7-21 15-11 46-6" opacity=".55"/>
    <path d="M169 132l91-43 60 22 64-46" stroke-dasharray="5 5" stroke-width="2"/>
    <circle cx="169" cy="132" r="6"/><circle cx="260" cy="89" r="6"/><circle cx="320" cy="111" r="6"/>
    <circle cx="384" cy="65" r="13"/>${point(384, 65)}
    <path d="M467 63v40m-7-28 7-14 7 14" stroke-width="1.3"/>
    ${label(467, 53, "N", "middle")}${label(119, 199, "Search grid")}
  `);

  const arts = plate(`
    <path d="m155 45 145-13 13 145-145 13z" fill="currentColor" fill-opacity=".12"/>
    <path d="m244 50 164 18-14 122-164-18z" fill="currentColor" fill-opacity=".075"/>
    <circle cx="283" cy="99" r="45" fill="currentColor" fill-opacity=".13"/>
    <path d="M236 147q39-77 62-54 30 29 57-14 15 17-2 43-24 37-117 25Z" fill="currentColor" fill-opacity=".27"/>
    <path d="m161 154 39-79 41 90m-68-37 43-4m94 35q32 2 79-27m-64 36q28 0 57-19M124 51v20m-10-10h20m285 94v28m-14-14h28" opacity=".7"/>
    <path d="M182 58l106-10m-103 17 72-7m79 19 55 6m-44 2 39 4" opacity=".5"/>
  `);

  const wave = range(68).map(i => {
    const x = 91 + i * 5.6;
    const height = 5 + Math.round(Math.abs(Math.sin(i * .82) * Math.cos(i * .19)) * (31 + 19 * Math.sin(i * .11) ** 2));
    return `M${x.toFixed(1)} ${105 - height}v${height * 2}`;
  }).join("");
  const music = plate(`
    <path d="M82 60h396M82 105h396M82 150h396" opacity=".27"/>
    <path d="${wave}" stroke-width="1.8"/>
    <path d="M94 173v9m53-9v9m53-9v9m53-9v9m53-9v9m53-9v9m53-9v9m53-9v9" opacity=".7"/>
    ${range(8).map(i => label(94 + 53 * i, 196, i + 1, "middle")).join("")}
    <circle cx="280" cy="105" r="65" stroke-dasharray="1 6" opacity=".25"/>
  `);

  const literature = plate(`
    <path d="M143 56h205v120H143Zm10-9h205v120" opacity=".45"/>
    <path d="M165 36h169v132H165Z" fill="currentColor" fill-opacity=".07"/>
    <path d="M183 64q0-12 13-12 11 0 11 11 0 8-9 9h-13m13 0q11 1 11 12 0 9-10 9h-13m3-37v34m28-35h89m-90 11h94m-94 11h80m-80 11h88m-121 17h125m-125 11h113m-113 11h125m-125 11h91m-91 11h105" opacity=".65"/>
    <path d="M341 164q39-46 71-103m-53 75q-2-32 43-65 14-9 33-12-9 25-30 48-24 25-46 29Zm15-18 28-11m-23 2 20-8m-14-3 27-13m-20 4 27-16" fill="currentColor" fill-opacity=".06"/>
    <path d="M375 170q19-10 30 0 7 6 18 3" opacity=".48"/>
  `);

  const technology = plate(`
    <rect x="224" y="55" width="112" height="112" rx="8" fill="currentColor" fill-opacity=".13"/>
    <rect x="239" y="70" width="82" height="82" rx="3"/>
    <path d="M254 109l14-12v9l12-9v24h-26zM291 100h16m-16 9h16m-16 9h16"/>
    <path d="M243 55V35h-56l-15 15h-30m120 5V23m20 32V37l16-14h49m-45 32V41h74l16 17h30m-198 22h-55l-23 23h-34m112-3h-41l-23 24h-28m92-4h-27l-30 33h-43m100-13h-22l-24 34h-32m192-94h50l23 23h36m-109-3h38l23 24h26m-87-4h24l31 33h41m-96-13h17l25 34h34m-169-7v22h-76m95-22v27m20-27v18l16 11h72m-69-29v12h65" opacity=".75"/>
    ${[ [142,50],[262,23],[347,23],[422,58],[112,103],[132,124],[124,153],[146,174],[445,103],[423,124],[432,153],[412,174],[167,189],[262,194],[370,196],[367,179] ].map(([x,y]) => point(x,y)).join("")}
  `);

  const research = plate(`
    <path d="m139 63 166-19 14 125-166 19z" fill="currentColor" fill-opacity=".06"/>
    <path d="M173 38h186v137H173Z" fill="currentColor" fill-opacity=".08"/>
    <path d="M188 54h119m-119 10h85m-85 17h155m-155 72h155m-155 9h111" opacity=".65"/>
    <path d="M191 139V92m0 47h145m-137-11 22-7 22 4 22-17 22 4 20-16 18 3m-127 12h138m-138 14h138" opacity=".65"/>
    ${point(221, 121)}${point(265, 108)}${point(307, 96)}
    <path d="M384 59h48m-48 10h39m-39 10h47m-47 22h53m-53 10h39m-39 10h48m-48 22h46m-46 10h32m-32 10h49" opacity=".55"/>
  `);

  const football = plate(`
    <rect x="126" y="37" width="308" height="145" rx="2"/>
    <path d="M280 37v145M126 74h61v72h-61m308-72h-61v72h61m-308-48h26v24h-26m308-24h-26v24h26m-308-32h-10v40h10m308-40h10v40h-10"/>
    <circle cx="280" cy="110" r="28"/>${point(280, 110)}
    <path d="M188 97q18 13 0 26m184-26q-18 13 0 26M182 64l49 18 45-21 52 21 50-20m-149 82 46-22 53 22" stroke-dasharray="4 5" opacity=".65"/>
    ${[[182,64],[231,82],[276,61],[328,82],[378,62],[229,144],[275,122],[328,144]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="currentColor" fill-opacity=".2"/>`).join("")}
  `);

  const careers = plate(`
    <path d="m126 56 129-23 22 129-129 22Z" fill="currentColor" fill-opacity=".08"/>
    <path d="M146 76l80-14m-76 27 58-10m-56 21 72-12m-64 52 31-35 35 26" opacity=".55"/>
    <path d="M225 81h51l13-23h47l13 23h51q11 0 11 11v70q0 11-11 11H225q-11 0-11-11V92q0-11 11-11Z" fill="currentColor" fill-opacity=".12"/>
    <circle cx="312" cy="125" r="35"/><circle cx="312" cy="125" r="27"/><circle cx="312" cy="125" r="18" fill="currentColor" fill-opacity=".11"/>
    <path d="M300 115q6-7 14-6m60-13h20v13h-20zm-140 6h25m-25 6h15M429 57v22m-11-11h22m-11 77v16m-8-8h16" opacity=".7"/>
  `);

  return Object.freeze({ academy, mindset, growth, defence, arts, music, literature, science, technology, research, football, careers });
})();

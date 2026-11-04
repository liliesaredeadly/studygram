(() => {
  "use strict";

  const scenes = {
    chariot: id => `
      <defs>
        <linearGradient id="${id}-sky" x2="0" y2="1">
          <stop stop-color="#181428"/><stop offset=".55" stop-color="#664353"/><stop offset="1" stop-color="#ba7653"/>
        </linearGradient>
        <radialGradient id="${id}-sun" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="translate(449 256) scale(235 192)">
          <stop offset="0" stop-color="#ffd3a1" stop-opacity=".75"/><stop offset="1" stop-color="#eb9d76" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${id}-earth" x2="0" y2="1">
          <stop stop-color="#8d5550"/><stop offset="1" stop-color="#2a2031"/>
        </linearGradient>
        <linearGradient id="${id}-gold" x2=".5" y2="1">
          <stop stop-color="#f9cd83"/><stop offset=".48" stop-color="#b67948"/><stop offset="1" stop-color="#5b3742"/>
        </linearGradient>
      </defs>
      <rect width="800" height="560" fill="url(#${id}-sky)"/>
      <g class="wisdom-scene-light">
        <ellipse cx="449" cy="256" rx="235" ry="192" fill="url(#${id}-sun)"/>
        <circle cx="447" cy="247" r="61" fill="#ffd19c" opacity=".74"/>
      </g>
      <g class="wisdom-scene-far">
        <path d="M0 175Q81 161 177 174t159 0q45-6 89-4-67 20-119 21-151-5-306 12Z" fill="#b68178" opacity=".24"/>
        <path d="M446 201q122-14 244-11l110 12v12q-165-8-354 5Z" fill="#e7a78b" opacity=".2"/>
        <path d="M0 310l64-32 58-4 84-33 62 23 65 16 72-2 71 23 60-6 76-24 67-8 72 12 49-8v135H0Z" fill="#754d60"/>
        <path d="M0 342l94-29 51-2 70 18 77-19 77 9 66-23 66 2 87 23 64-8 148 18v97H0Z" fill="#935c62"/>
        <path d="M0 347q87-23 190-10t178-1q136-18 255 0l177 8v216H0Z" fill="url(#${id}-earth)"/>
        <path d="M0 374q220-26 390-12t410-10M27 407q129-16 264-9m278-6q104-2 231-12" fill="none" stroke="#e5a886" opacity=".22" stroke-width="2"/>
      </g>
      <g class="wisdom-scene-near">
        <ellipse cx="416" cy="427" rx="212" ry="16" fill="#342337" opacity=".7"/>
        <!-- The horse team and leather harness -->
        <g fill="#a37c72" stroke="#573c45" stroke-width="3" stroke-linejoin="round">
          <path d="M461 353q21-15 45-1l11-8 10-26 12-11 9-2 4-10 6 12 12 9 8 12-6 10-19-5-14 15-3 26-14 13-5 27-7 2-1-32-20-7-17 30-9 2 5-18-7-20-10-6Z"/>
          <path d="M523 331q2-21 16-27l7 4m-53 69 15 3" fill="none"/>
        </g>
        <path d="M471 365q25-17 47-11l17-4 7-26q8-15 19-19l10-3 3-13 8 12 11 4 9 9 17 10-3 10-18 4-18-8-10 17-4 29-12 11-3 34-10 3-1-34-26-2-15 19-9 15-10-1 7-20 5-26-15-4-15 12-7-4Z"
          fill="#e1bc9c" stroke="#694857" stroke-width="3" stroke-linejoin="round"/>
        <path d="M551 342q0-17 16-31l12-7m-46 78 15 8m-44-9 10 7m-45-21-16 18-10 21"
          fill="none" stroke="#a77874" stroke-width="3" stroke-linecap="round"/>
        <path d="M575 309l20 12 3 16m-21-25-8 22-11 15-15 22m-73 3 68 2m-178-57q96 10 180 47m-172-43q111-8 223 3"
          fill="none" stroke="#513b47" stroke-width="2" stroke-linecap="round"/>
        <path d="M569 310l16 1m-24 34 12 6m-40 24 12 1" fill="none" stroke="#f3bd75" stroke-width="3" stroke-linecap="round"/>
        <circle cx="589" cy="314" r="2" fill="#382835"/>
        <!-- Arjuna at the rear, with his bow lowered -->
        <path d="M247 275q-25 17-14 43 7 19 31 29m-17-72 17 72" fill="none" stroke="#e8bc7b" stroke-width="2" stroke-linecap="round"/>
        <path d="M257 311q8-17 20-21l21 3q16 9 21 24l5 28-68 4 4-22-11-6Z" fill="#653e53" stroke="#b78366" stroke-width="2"/>
        <path d="M264 300l14 1 17 13 15 29m-45-23 9-12 9 9 15 13" fill="none" stroke="#e9b56e" stroke-width="3"/>
        <path d="M278 269q-3-14 9-17 17-4 23 13l1 6 6 5-5 4-3 8-8 3-1 8-14-5-1-10q-9-5-7-15Z" fill="#ba805e"/>
        <path d="M276 270l-3-14 10-3 6-13 7 10 12 3 4 12-15-2-12 5-3 12-5-1Z" fill="url(#${id}-gold)"/>
        <path d="M276 260q17-4 31 0m-7 12 6-1" fill="none" stroke="#5a3842" stroke-width="1.6" stroke-linecap="round"/>
        <!-- Krishna at the reins, with a peacock feather in the crown -->
        <path d="M330 302q7-16 18-21l23 3 15 11 8 25-10 28-66-3 4-22Z" fill="#375b74" stroke="#b5896f" stroke-width="2"/>
        <path d="M337 282q10 23 40 49l-8 18-17-1-21-25-6-14Z" fill="#d59551"/>
        <path d="M341 257q0-15 14-18 16-4 23 11l2 10 7 5-6 5-4 10-10 3v8l-15-5 1-10q-11-4-12-19Z" fill="#7494a3"/>
        <path d="M340 260l-5-13 9-4 7-14 11 7 13-5 8 17-11 4-14-2-11 13-5 8-4-3Z" fill="url(#${id}-gold)"/>
        <path d="M355 239q1-20 12-26 6 0 3 7-4 9-15 19Z" fill="#508373" stroke="#c69c66" stroke-width="1.3"/>
        <ellipse cx="366" cy="218" rx="3" ry="4" fill="#50769a" transform="rotate(32 366 218)"/>
        <path d="M366 260l8-2m-17 16q-5 3-7-3m-5 22q10 11 24 12" fill="none" stroke="#f3bf75" stroke-width="2" stroke-linecap="round"/>
        <path d="M378 295l18 18 22 3 12-2 8 4-6 6-37 1-23-12" fill="#7494a3" stroke="#4f5970" stroke-width="2" stroke-linejoin="round"/>
        <path d="M421 320q80 10 140 48m-131-48q76-4 149 7" fill="none" stroke="#d2a471" stroke-width="1.6"/>
        <!-- Carved chariot, wheel, and standard -->
        <path d="M244 358l-8-144 5-1 9 145" fill="#a37153"/>
        <path d="M236 220q-26-19-54-4 29 2 21 16 17-5 34 2Z" fill="#a36457" stroke="#c88f6e" stroke-width="1.2"/>
        <path d="M238 337q33 5 81 1l65-7 24 6 39-5 5 8-44 14-30 31-113 7-19-19Z"
          fill="url(#${id}-gold)" stroke="#573b46" stroke-width="4" stroke-linejoin="round"/>
        <path d="M247 353q80 5 155-11m-139 31 122-8m-124-3 10-6 12 6 11-7 12 6 11-7 13 5 12-7 11 5 13-7 13 4"
          fill="none" stroke="#f0bd76" stroke-width="2" stroke-linecap="round"/>
        <circle cx="321" cy="390" r="41" fill="#472f42" stroke="#d49e62" stroke-width="6"/>
        <circle cx="321" cy="390" r="32" fill="#79504e" stroke="#b58458" stroke-width="2"/>
        <path d="M321 355v70m-35-35h70m-60-25 50 50m-50 0 50-50" stroke="#d9a063" stroke-width="3"/>
        <circle cx="321" cy="390" r="8" fill="#edbd77" stroke="#684249" stroke-width="2"/>
        <path d="M408 360l109 12" stroke="#62474c" stroke-width="7" stroke-linecap="round"/>
        <path d="M37 455q180-31 292-18t261 8q117-14 210-9v124H0V464Z" fill="#392b39"/>
        <path d="M117 452q84-15 147-12m211 12q119 5 245-9" fill="none" stroke="#af745e" opacity=".42" stroke-width="2"/>
      </g>`,

    lantern: id => `
      <defs>
        <linearGradient id="${id}-sky" x2="0" y2="1">
          <stop stop-color="#101f2c"/><stop offset=".57" stop-color="#374753"/><stop offset="1" stop-color="#8d655b"/>
        </linearGradient>
        <linearGradient id="${id}-stone" x2=".8" y2="1">
          <stop stop-color="#232733"/><stop offset=".58" stop-color="#574342"/><stop offset="1" stop-color="#292932"/>
        </linearGradient>
        <linearGradient id="${id}-ground" x2="0" y2="1">
          <stop stop-color="#483942"/><stop offset="1" stop-color="#171e29"/>
        </linearGradient>
        <radialGradient id="${id}-glow" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="translate(412 307) scale(226 183)">
          <stop offset="0" stop-color="#ffc483" stop-opacity=".72"/><stop offset=".4" stop-color="#de8b55" stop-opacity=".33"/>
          <stop offset="1" stop-color="#bf7657" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}-reflection" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="translate(410 406) scale(150 28)">
          <stop offset="0" stop-color="#ffc483" stop-opacity=".32"/><stop offset="1" stop-color="#bf7657" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="560" fill="url(#${id}-sky)"/>
      <g class="wisdom-scene-far">
        <path d="M0 325l116-47 62 7 63 19 50-11 56 17 44-18 35 10 51-16 77 10 101-43 145 46v86H0Z" fill="#4b4850"/>
        <path d="M0 348h301v-28h23v-11h52v12h14v-23h44v17h42v-8h22v26h79v56H0Z" fill="#3e3c46"/>
        <path d="M289 353h220m-206-9h45m104 0h32" fill="none" stroke="#756468" stroke-width="2" opacity=".45"/>
        <path d="M0 368h800v192H0Z" fill="url(#${id}-ground)"/>
        <path d="M0 10h800v414l-258-15V238c0-83-63-153-142-181-79 28-142 98-142 181v171L0 424Z" fill="url(#${id}-stone)"/>
        <path d="M233 409V237c0-101 83-181 167-210 84 29 167 109 167 210v172M258 409V238c0-83 63-153 142-181 79 28 142 98 142 181v171"
          fill="none" stroke="#937169" stroke-width="2" opacity=".62"/>
        <path d="M0 94h311m176 0h313M0 152h250m301 0h249M0 207h234m332 0h234M0 254h233m334 0h233M0 306h233m334 0h233M0 360h233m334 0h233
          M123 94v58m65 0v55m-69 0v47m60 0v52m-57 0v54m64 0v48m446-314v58m-43 0v55m62 0v47m-51 0v52m55 0v54m-55 0v48"
          fill="none" stroke="#242632" stroke-width="3" opacity=".66"/>
        <path d="M313 75l13 20m24-46 9 22m41-44v30m41-8-9 22m55 4-13 20m48 15-18 15m45 20-20 11m37 28-23 7m-265-81 18 15m-45 20 20 11m-37 28 23 7"
          fill="none" stroke="#372e37" stroke-width="2" opacity=".8"/>
        <path d="M13 442l327-69m463 74-354-74m-62 0-71 187m105-187 73 187M0 461h800M0 507h800"
          fill="none" stroke="#816260" stroke-width="2" opacity=".28"/>
      </g>
      <g class="wisdom-scene-light">
        <ellipse cx="412" cy="307" rx="226" ry="183" fill="url(#${id}-glow)"/>
        <ellipse cx="410" cy="406" rx="150" ry="28" fill="url(#${id}-reflection)"/>
      </g>
      <g class="wisdom-scene-near">
        <ellipse cx="403" cy="423" rx="164" ry="15" fill="#28232d" opacity=".67"/>
        <!-- Two travelers, with an open hand in the pool of light -->
        <path d="M299 401q5-47 9-81l-6-19 10-28 25-6 24 15 8 38-9 20 8 70q-40 10-84 1Z"
          fill="#655669" stroke="#3b3443" stroke-width="3" stroke-linejoin="round"/>
        <path d="M307 305q13 3 20-6l10-27 16 6q-2 19-17 35l-7 86m-13-60-14 64m43-65 9 62" fill="none" stroke="#a5857d" stroke-width="2.4" opacity=".76"/>
        <path d="M314 247q1-16 15-19 17-3 23 16l2 8 5 5-6 4-3 12-12 2-3 10-13-8-1-11q-8-6-7-19Z" fill="#be8667"/>
        <path d="M309 248q-1-22 18-24 20-1 29 22l-11-2-12-6-6 9-5 19 6 14-13-5-9-12Z"
          fill="#5a4b61" stroke="#a18180" stroke-width="1.5"/>
        <path d="M344 252l5 1m-4 13 4 1" fill="none" stroke="#644a4b" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M347 299l24 20 22-5 8-5 12 1-8 4 10 1-9 6-15 2-23 11-27-16"
          fill="#c38b6d" stroke="#735251" stroke-width="2" stroke-linejoin="round"/>
        <path d="M343 293l28 24-9 12-30-13" fill="#766579" stroke="#a18782" stroke-width="2"/>
        <path d="M475 270l26 9 17 31-5 27 16 73q-31 12-83 2l10-66-4-34 8-34Z"
          fill="#825349" stroke="#413440" stroke-width="3" stroke-linejoin="round"/>
        <path d="M475 275l-9 40 17 13-5 77m20-108 12 28m-14 23 17 56" fill="none" stroke="#c58967" stroke-width="2.3" opacity=".71"/>
        <path d="M490 245q-1-17-15-19-16-2-21 15l-2 8-6 6 5 3 4 11 13 4 1 9 14-6 1-10q7-7 6-21Z" fill="#a66f58"/>
        <path d="M448 249q-2-22 17-28 24-5 33 21l-2 19-14 16-4-9 5-18-6-13-13-4-9 14Z" fill="#62463f" stroke="#b47b5d" stroke-width="1.5"/>
        <path d="M457 251l5-1m-6 12 5 1m21 35-18 19-18 5"
          fill="none" stroke="#d79870" stroke-width="2" stroke-linecap="round"/>
        <path d="M447 320l-17-4-7 1 7 4-10 1 7 5 18 2 12-8" fill="#ad765e" stroke="#785654" stroke-width="1.6"/>
        <path d="M462 306l-17 12 6 13 21-8" fill="#976253" stroke="#c28969" stroke-width="1.7"/>
        <!-- Lantern on a low stone ledge -->
        <path d="M369 386l11-16 74-1 13 14-12 41-85 1Z" fill="#59454b" stroke="#342c39" stroke-width="3"/>
        <path d="M369 386l98-3m-84 12 56-2m-47 21 55-3" fill="none" stroke="#9b7666" stroke-width="2" opacity=".7"/>
        <path d="M405 338q6-13 12-1m-19 9 13-12 15 11-3 25h-21Z" fill="#563c3c" stroke="#edb477" stroke-width="2" stroke-linejoin="round"/>
        <path d="M404 348h16l-2 18h-12Z" fill="#edb471"/>
        <path d="M410 365q-4-5 1-9l2-4q5 8 1 13Z" fill="#fff0b1"/>
        <path d="M412 346v21m-13 3h25" stroke="#694745" stroke-width="1.5"/>
      </g>`,

    shore: id => `
      <defs>
        <linearGradient id="${id}-sky" x2="0" y2="1">
          <stop stop-color="#182939"/><stop offset=".56" stop-color="#657986"/><stop offset="1" stop-color="#dfaa8a"/>
        </linearGradient>
        <linearGradient id="${id}-sea" x2=".2" y2="1">
          <stop stop-color="#9e9696"/><stop offset=".58" stop-color="#4b6d76"/><stop offset="1" stop-color="#283e50"/>
        </linearGradient>
        <linearGradient id="${id}-sand" x2=".2" y2="1">
          <stop stop-color="#89777b"/><stop offset="1" stop-color="#293645"/>
        </linearGradient>
        <radialGradient id="${id}-light" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="translate(492 245) scale(265 166)">
          <stop offset="0" stop-color="#ffdec0" stop-opacity=".82"/><stop offset="1" stop-color="#eeb492" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="560" fill="url(#${id}-sky)"/>
      <g class="wisdom-scene-light">
        <ellipse cx="492" cy="245" rx="265" ry="166" fill="url(#${id}-light)"/>
        <circle cx="483" cy="256" r="43" fill="#fbd7b9" opacity=".77"/>
      </g>
      <g class="wisdom-scene-far">
        <path d="M0 161q128-23 285-6t215-7q-102 32-209 23T0 187Z" fill="#b1a2a1" opacity=".26"/>
        <path d="M326 210q99-5 167-17t234 6q-127-2-202 6t-199 5Z" fill="#e2bba9" opacity=".35"/>
        <path d="M0 287l44-42 54-2 42-26 34 13 31-8 45 32 47 5 52 26v31H0Z" fill="#5a6474"/>
        <path d="M0 283l64-27 42 7 48-21 53 15 26 22 58-3 44 15v22H0Z" fill="#4e5d6e"/>
        <path d="M0 285q139 9 273-1 261-9 527-2v278H0Z" fill="url(#${id}-sea)"/>
        <path d="M313 298q179-6 331-3m-276 13q124-4 229-2m-192 9q82-4 155-1m-187 14q107-3 215-2m-157 16q71-5 149-2m-133 17q97-5 158-1"
          fill="none" stroke="#f4cfb7" stroke-width="2" opacity=".42" stroke-linecap="round"/>
        <path d="M0 326q157 14 264 2m-238 27q123 3 197-7m376 25q94-4 201-1M0 381q144 13 273-10"
          fill="none" stroke="#abc1c0" stroke-width="1.4" opacity=".38"/>
        <path d="M635 193q6-5 12 1 6-6 12-3m-63 18q5-5 10 0 5-5 9-2" fill="none" stroke="#5f6575" stroke-width="1.6" stroke-linecap="round"/>
      </g>
      <g class="wisdom-scene-near">
        <path d="M0 455q109-17 194-5 79 11 172-23 153-56 277-20 74 23 157 13v140H0Z" fill="url(#${id}-sand)"/>
        <path d="M0 456q108-17 194-5 78 11 173-24 153-56 277-20 72 23 156 13" fill="none" stroke="#c0b8b1" stroke-width="3" opacity=".71"/>
        <path d="M0 444q108-16 192-6 74 10 166-23 155-56 282-21 75 22 160 13" fill="none" stroke="#c9c4ba" stroke-width="1.4" opacity=".45"/>
        <path d="M0 478q105-15 183-4t167-13m229-38q96 1 173 20" fill="none" stroke="#b09790" opacity=".5" stroke-width="2"/>
        <path d="M350 422q20-6 40-6 11 4-11 8l-31 3Z" fill="#524a58"/>
        <path d="M367 409l-4 10h8l4-10 4 10 8-1-5-11" fill="#2c3441"/>
        <path d="M367 374q-3 18-8 35 13 8 28-1l-5-22 1-9-7-7Z" fill="#414555" stroke="#263543" stroke-width="1.7"/>
        <path d="M365 387q-4 11-6 14m25-20 4 13m-13-14-2 28" fill="none" stroke="#81908d" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M367 363q1-8 8-7 8 1 7 8l-1 5-6 4-6-4Z" fill="#a28378"/>
        <path d="M367 367q-4-9 5-12 8-2 11 6l-5-1-7 2-1 6Z" fill="#373745"/>
        <path d="M0 522l52-18 64 8 28 14 70 7 65 27H0Zm591 38 78-30 52 1 79-18v47Z" fill="#303643"/>
        <path d="M53 504l20-17 16 17m610 24 13-23 23 19" fill="#454753"/>
      </g>`,
  };

  let nextId = 0;

  window.renderWisdomScene = (container, sceneId) => {
    const scene = Object.hasOwn(scenes, sceneId) ? scenes[sceneId] : scenes.shore;
    const id = `wisdom-art-${++nextId}`;
    container.innerHTML = `<svg class="wisdom-scene-art" viewBox="0 0 800 560"
      preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      ${scene(id)}
    </svg>`;
  };
})();

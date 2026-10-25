// Avatar ilustrado provisório (SVG). Pisca, "respira" e mexe a boca
// enquanto a assistente fala. NÃO é um avatar humano realista: este fica
// para a Fase 2, com um serviço externo (ver docs/DECISOES.md, D-004).

const PALETTE = {
  skin: '#C98F69',
  skinShade: '#B27655',
  lips: '#9E4F45',
  blush: '#E07A6E',
  iris: '#4A3326',
  female: { hair: '#3B2A21', clothes: '#1F7A72', clothesShade: '#17635C' },
  male: { hair: '#2A2420', clothes: '#2E4A6B', clothesShade: '#243C58' },
};

function svgMarkup(gender) {
  const c = PALETTE[gender] || PALETTE.female;
  const female = gender !== 'male';
  const hairBack = female
    ? `<path d="M112 205 C98 112 150 70 204 72 C262 74 306 116 294 208 C297 262 304 300 322 334 C292 350 254 336 246 322 L154 322 C146 336 108 350 78 334 C96 300 104 262 112 205 Z" fill="${c.hair}"/>`
    : '';
  const hairFront = female
    ? `<path d="M117 196 C114 122 158 90 206 90 C254 90 290 124 285 190 C276 156 246 128 206 128 C190 150 150 168 117 196 Z" fill="${c.hair}"/>`
    : `<path d="M118 190 C110 118 152 84 203 84 C258 84 294 120 284 190 C280 162 268 144 254 136 C228 120 176 120 150 134 C134 144 124 164 118 190 Z" fill="${c.hair}"/>`;
  const collar = female
    ? `<path d="M168 342 Q200 376 232 342" fill="none" stroke="${c.clothesShade}" stroke-width="6" stroke-linecap="round"/>
       <circle cx="122" cy="236" r="4.5" fill="#E9C46A"/><circle cx="278" cy="236" r="4.5" fill="#E9C46A"/>`
    : `<path d="M166 338 L200 382 L234 338 L222 332 L200 356 L178 332 Z" fill="#EEF2F4"/>`;
  const browWidth = female ? 4.5 : 7;
  return `
<svg class="avatar-svg" viewBox="0 0 400 460" role="img" aria-label="Ilustração ${female ? 'da assistente' : 'do assistente'}">
  <g class="avatar-body">
    ${hairBack}
    <path d="M58 460 C66 372 128 338 200 338 C272 338 334 372 342 460 Z" fill="${c.clothes}"/>
    <path d="M170 286 L170 344 Q200 364 230 344 L230 286 Z" fill="${PALETTE.skinShade}"/>
    ${collar}
    <g class="avatar-head">
      <ellipse cx="121" cy="212" rx="13" ry="22" fill="${PALETTE.skinShade}"/>
      <ellipse cx="279" cy="212" rx="13" ry="22" fill="${PALETTE.skinShade}"/>
      <ellipse cx="200" cy="200" rx="82" ry="98" fill="${PALETTE.skin}"/>
      ${hairFront}
      <path d="M150 174 Q168 ${female ? 163 : 165} 186 172" fill="none" stroke="${c.hair}" stroke-width="${browWidth}" stroke-linecap="round"/>
      <path d="M214 172 Q232 ${female ? 163 : 165} 250 174" fill="none" stroke="${c.hair}" stroke-width="${browWidth}" stroke-linecap="round"/>
      <g class="avatar-eyes">
        <ellipse cx="168" cy="199" rx="13" ry="9" fill="#FBF7F3"/>
        <circle cx="168" cy="200" r="7" fill="${PALETTE.iris}"/>
        <circle cx="168" cy="200" r="3.2" fill="#15100D"/>
        <circle cx="171" cy="197" r="1.9" fill="#FFFFFF"/>
        <ellipse cx="232" cy="199" rx="13" ry="9" fill="#FBF7F3"/>
        <circle cx="232" cy="200" r="7" fill="${PALETTE.iris}"/>
        <circle cx="232" cy="200" r="3.2" fill="#15100D"/>
        <circle cx="235" cy="197" r="1.9" fill="#FFFFFF"/>
      </g>
      <path d="M200 206 Q196 228 190 236 Q200 242 210 236" fill="none" stroke="${PALETTE.skinShade}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="156" cy="242" r="15" fill="${PALETTE.blush}" opacity="0.22"/>
      <circle cx="244" cy="242" r="15" fill="${PALETTE.blush}" opacity="0.22"/>
      <path class="avatar-mouth-closed" d="M179 262 Q200 276 221 262" fill="none" stroke="${PALETTE.lips}" stroke-width="${female ? 5 : 4}" stroke-linecap="round"/>
      <g class="avatar-mouth-open">
        <ellipse cx="200" cy="266" rx="17" ry="11" fill="#5B2220"/>
        <path d="M186 259 Q200 255 214 259 L213 263 Q200 260 187 263 Z" fill="#F4EFEA"/>
        <ellipse cx="200" cy="272" rx="9" ry="3.5" fill="#C2555A"/>
      </g>
    </g>
  </g>
</svg>`;
}

export function createAvatar({ gender = 'female', size = 'lg', label } = {}) {
  const stage = document.createElement('div');
  stage.className = `avatar-stage avatar-${size}`;
  stage.dataset.state = 'idle';
  if (label) stage.setAttribute('aria-label', label);

  let current = null;
  let raf = 0;
  let openness = 0;
  let target = 0;
  let lastSwitch = 0;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function render(g) {
    current = g;
    stage.dataset.gender = g;
    stage.innerHTML = `<div class="avatar-ring" aria-hidden="true"></div>${svgMarkup(g)}`;
    setMouth(0);
  }

  function setMouth(v) {
    const open = stage.querySelector('.avatar-mouth-open');
    const closed = stage.querySelector('.avatar-mouth-closed');
    if (!open || !closed) return;
    open.style.transform = `scaleY(${Math.max(0.05, v)})`;
    open.style.opacity = v > 0.08 ? '1' : '0';
    closed.style.opacity = v > 0.08 ? '0' : '1';
  }

  function loop(t) {
    if (t - lastSwitch > 90 + Math.random() * 80) {
      lastSwitch = t;
      target = Math.random() < 0.18 ? 0.1 : 0.35 + Math.random() * 0.65;
    }
    openness += (target - openness) * 0.35;
    setMouth(openness);
    raf = requestAnimationFrame(loop);
  }

  function setState(state) {
    stage.dataset.state = state;
    cancelAnimationFrame(raf);
    if (state === 'speaking' && !reduced) {
      raf = requestAnimationFrame(loop);
    } else {
      openness = 0;
      setMouth(state === 'speaking' ? 0.4 : 0);
    }
  }

  render(gender);
  return {
    el: stage,
    setGender: (g) => { if (g !== current) render(g); },
    setState,
    destroy: () => cancelAnimationFrame(raf),
  };
}

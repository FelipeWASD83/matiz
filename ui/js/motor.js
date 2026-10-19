// A conta do filtro. Daqui sai exatamente o que vai para a tela:
//  - uma matriz de cor 5x5 (vai para o compositor do Windows, vale em todas as telas)
//  - três curvas de 256 pontos (vão para a rampa de gama da placa de vídeo)
//  - o nível da vibração digital da NVIDIA (opcional)
// A prévia usa as mesmas saídas, na mesma ordem: primeiro a matriz, depois as curvas.

import { PARAMETROS, PARAM, ESTILO, contribuicaoDoPad, padraoDe } from './parametros.js';

const LUMA = [0.2126, 0.7152, 0.0722];

export function estadoInicial() {
  return {
    estilo: 'original',
    paleta: 70,
    intensidade: 100,
    pad: { x: 0, y: 0 },
    ajustes: {},
    meus: [],
  };
}

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function lookDe(estado) {
  if (estado.estilo?.startsWith('u:')) {
    const meu = (estado.meus || []).find((m) => 'u:' + m.id === estado.estilo);
    return meu ? meu.look : {};
  }
  return ESTILO[estado.estilo]?.look ?? {};
}

function hueParaVetor(graus) {
  // cor pura do círculo cromático, sem a luminância dela (o tom não clareia nem escurece)
  const h = (((graus % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  const l = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
  return [r - l, g - l, b - l];
}

/**
 * Junta ajustes manuais, estilo (pela paleta), pad e intensidade num conjunto só de valores normalizados.
 * Escalares saem em -1..1 (positivos em 0..1, matiz em -1..1 = -180..180 graus).
 * Os tons saem como vetores RGB já multiplicados pela força.
 */
export function combinar(estado) {
  const look = lookDe(estado);
  const paleta = limitar((estado.paleta ?? 100) / 100, 0, 1);
  const intensidade = limitar((estado.intensidade ?? 100) / 100, 0, 1);
  const pad = contribuicaoDoPad(limitar(estado.pad?.x ?? 0, -1, 1), limitar(estado.pad?.y ?? 0, -1, 1));
  const aj = estado.ajustes || {};
  const P = {};

  for (const p of PARAMETROS) {
    if (p.tipo === 'matiz') continue;
    const v = (aj[p.id] ?? padraoDe(p)) + paleta * (look[p.id] ?? 0) + (pad[p.id] ?? 0);
    const escala = p.tipo === 'graus' ? 180 : 100;
    const min = p.tipo === 'positivo' ? 0 : -1.5;
    P[p.id] = limitar((v / escala) * intensidade, min, 1.5);
  }

  const tom = (forca, matiz) => hueParaVetor(matiz).map((c) => c * forca);
  const soma = (a, b) => a.map((v, i) => v + b[i]);
  const tomDe = (prefixo) => {
    const meu = tom((aj[prefixo + 'Forca'] ?? 0) / 100, aj[prefixo + 'Matiz'] ?? PARAM[prefixo + 'Matiz'].padrao);
    const doLook = tom((paleta * (look[prefixo + 'Forca'] ?? 0)) / 100, look[prefixo + 'Matiz'] ?? PARAM[prefixo + 'Matiz'].padrao);
    return soma(meu, doLook).map((c) => c * intensidade);
  };
  P.tomSombra = tomDe('sombra');
  P.tomRealce = tomDe('realce');
  delete P.sombraForca;
  delete P.realceForca;
  return P;
}

// ---------- matriz ----------

function multiplicar(a, b) {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r;
}

export function matriz3(P) {
  const c = P.calor || 0;
  const t = P.tint || 0;
  const ganho = [[1 + 0.16 * c + 0.04 * t, 0, 0], [0, 1 + 0.02 * c - 0.14 * t, 0], [0, 0, 1 - 0.16 * c + 0.04 * t]];

  const s = limitar(1 + (P.saturacao || 0), 0, 2.2);
  const sat = [
    [0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s],
    [0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s],
    [0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s],
  ];

  const ang = (P.matiz || 0) * Math.PI;
  const a = Math.cos(ang);
  const b = Math.sin(ang);
  const hue = [
    [0.213 + a * 0.787 - b * 0.213, 0.715 - a * 0.715 - b * 0.715, 0.072 - a * 0.072 + b * 0.928],
    [0.213 - a * 0.213 + b * 0.143, 0.715 + a * 0.285 + b * 0.14, 0.072 - a * 0.072 - b * 0.283],
    [0.213 - a * 0.213 - b * 0.787, 0.715 - a * 0.715 + b * 0.715, 0.072 + a * 0.928 + b * 0.072],
  ];
  return multiplicar(hue, multiplicar(sat, ganho));
}

/** Matriz no formato da API de Ampliação do Windows: linha = canal de entrada, coluna = canal de saída. */
export function matrizWindows(m3) {
  const m = new Array(25).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[j * 5 + i] = m3[i][j];
  m[18] = 1;
  m[24] = 1;
  return m;
}

// ---------- curvas ----------

const paraLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const paraSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

function ombro(l) {
  // acima de 0.8 a luz é comprimida em vez de estourar de vez
  const k = 0.8;
  return l <= k ? l : k + (1 - k) * (1 - Math.exp(-(l - k) / (1 - k)));
}

const pesoSombra = (y) => 6.75 * y * (1 - y) * (1 - y);
const pesoRealce = (y) => 6.75 * y * y * (1 - y);

export function curvaDoCanal(x, P, canal) {
  let y = x;

  const pp = P.pontoPreto || 0;
  if (pp > 0) y = Math.max(0, (y - 0.12 * pp) / (1 - 0.12 * pp));
  else if (pp < 0) y = -0.1 * pp + y * (1 + 0.1 * pp);

  const e = P.exposicao || 0;
  if (e) y = paraSrgb(ombro(paraLinear(limitar(y, 0, 1)) * Math.pow(2, 1.6 * e)));

  const br = P.brilho || 0;
  if (br) y = Math.pow(limitar(y, 0, 1), Math.pow(2, -0.75 * br));

  y += 0.3 * (P.sombras || 0) * pesoSombra(limitar(y, 0, 1));
  y += 0.3 * (P.realces || 0) * pesoRealce(limitar(y, 0, 1));

  const k = P.contraste || 0;
  y = limitar(y, 0, 1);
  if (k > 0) y = lerp(y, y * y * (3 - 2 * y), Math.min(1, 0.85 * k));
  else if (k < 0) y = lerp(y, 0.5 + (y - 0.5) * 0.55, Math.min(1, -k));

  const ch = [P.vermelho, P.verde, P.azul][canal] || 0;
  if (ch) y = Math.pow(limitar(y, 0, 1), Math.pow(2, -0.45 * ch));

  const eq = limitar(P.equilibrio || 0, -1, 1);
  const yc = limitar(y, 0, 1);
  y += 0.35 * (P.tomSombra?.[canal] || 0) * (1 - yc) * (1 - yc) * (1 - 0.5 * eq);
  y += 0.35 * (P.tomRealce?.[canal] || 0) * yc * yc * (1 + 0.5 * eq);

  const f = P.desbotar || 0;
  if (f) y = 0.1 * f + y * (1 - 0.16 * f);

  return limitar(y, 0, 1);
}

/** As três curvas (R, G, B) com 256 pontos cada, sempre crescentes (a placa recusa curva que desce). */
export function rampa(P) {
  const r = new Array(768);
  for (let c = 0; c < 3; c++) {
    let maior = 0;
    for (let i = 0; i < 256; i++) {
      const v = Math.max(maior, curvaDoCanal(i / 255, P, c));
      maior = v;
      r[c * 256 + i] = Math.round(v * 100000) / 100000;
    }
  }
  return r;
}

// ---------- saída ----------

export function calcularSaida(estado, { nvidia = false } = {}) {
  const P = combinar(estado);
  const v = P.vibracaoNv || 0;
  return {
    matriz: matrizWindows(matriz3(P)).map((n) => Math.round(n * 1e6) / 1e6),
    rampa: rampa(P),
    vibracao: nvidia && v > 0.005 ? Math.round(limitar(v, 0, 1) * 100) : null,
    vibracaoPrevia: limitar(v, 0, 1),
  };
}

/** Aplica a saída num pixel (0..1), igual ao que a tela vai fazer. Usado pelos testes. */
export function aplicarNoPixel(saida, rgb) {
  const m = saida.matriz;
  const out = [0, 1, 2].map((i) => limitar(rgb[0] * m[i] + rgb[1] * m[5 + i] + rgb[2] * m[10 + i] + m[20 + i], 0, 1));
  return out.map((v, c) => {
    const x = v * 255;
    const a = Math.floor(x);
    const b = Math.min(255, a + 1);
    return lerp(saida.rampa[c * 256 + a], saida.rampa[c * 256 + b], x - a);
  });
}

export function ehNeutro(saida) {
  const id = matrizWindows([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  if (saida.matriz.some((v, i) => Math.abs(v - id[i]) > 1e-4)) return false;
  for (let c = 0; c < 3; c++) for (let i = 0; i < 256; i++) if (Math.abs(saida.rampa[c * 256 + i] - i / 255) > 1e-3) return false;
  return saida.vibracao == null;
}

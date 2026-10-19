// Os três controles do jeito do iPhone: a régua que desliza, os discos com anel de valor e o pad de tom e cor.

import { FAIXAS, padraoDe } from './parametros.js';

// ---------- ícones (traço de 1.6 num quadro de 24) ----------

const T = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
export const ICONES = {
  exposicao: `<circle cx="12" cy="12" r="8" ${T}/><path d="M8.5 9.5h4M10.5 7.5v4M11.5 15.5h4" ${T}/>`,
  brilho: `<circle cx="12" cy="12" r="3.6" ${T}/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" ${T}/>`,
  realces: `<circle cx="12" cy="12" r="8" ${T}/><path d="M4 12a8 8 0 0 1 16 0z" fill="currentColor"/>`,
  sombras: `<circle cx="12" cy="12" r="8" ${T}/><path d="M4 12a8 8 0 0 0 16 0z" fill="currentColor" opacity=".9"/>`,
  contraste: `<circle cx="12" cy="12" r="8" ${T}/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>`,
  pontoPreto: `<circle cx="12" cy="12" r="8" ${T}/><circle cx="12" cy="12" r="3.4" fill="currentColor"/>`,
  desbotar: `<circle cx="12" cy="12" r="8" ${T} stroke-dasharray="2.2 2.6"/><circle cx="12" cy="12" r="3.4" fill="currentColor" opacity=".35"/>`,
  saturacao: `<path d="M12 3.8c3.2 4.1 5.6 7.1 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-3 2.4-6 5.6-10.1z" ${T}/><path d="M9 15a3 3 0 0 0 3 3" ${T}/>`,
  vibracaoNv: `<path d="M13 3.5L6.5 13.2h5L10.8 20.5l6.7-9.9h-5z" ${T}/>`,
  calor: `<path d="M10 14.2V5.8a2 2 0 0 1 4 0v8.4a3.8 3.8 0 1 1-4 0z" ${T}/><circle cx="12" cy="17.2" r="1.6" fill="currentColor"/>`,
  tint: `<path d="M12 3.8c3.2 4.1 5.6 7.1 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-3 2.4-6 5.6-10.1z" ${T}/><path d="M12 3.8v15.7a5.6 5.6 0 0 0 5.6-5.6c0-3-2.4-6-5.6-10.1z" fill="currentColor" opacity=".5"/>`,
  matiz: `<circle cx="12" cy="12" r="8" ${T}/><path d="M12 12V4M12 12l6.9 4M12 12l-6.9 4" ${T}/>`,
  vermelho: `<circle cx="12" cy="12" r="7" fill="#ff5f57"/>`,
  verde: `<circle cx="12" cy="12" r="7" fill="#4cd964"/>`,
  azul: `<circle cx="12" cy="12" r="7" fill="#4a90ff"/>`,
  sombraForca: `<circle cx="12" cy="12" r="8" ${T}/><path d="M4 12a8 8 0 0 0 16 0z" fill="currentColor" opacity=".45"/><circle cx="12" cy="15.5" r="1.8" fill="currentColor"/>`,
  sombraMatiz: `<circle cx="12" cy="12" r="8" ${T}/><path d="M4 12a8 8 0 0 0 16 0z" fill="#46b7c9"/>`,
  realceForca: `<circle cx="12" cy="12" r="8" ${T}/><path d="M4 12a8 8 0 0 1 16 0z" fill="currentColor" opacity=".45"/><circle cx="12" cy="8.5" r="1.8" fill="currentColor"/>`,
  realceMatiz: `<circle cx="12" cy="12" r="8" ${T}/><path d="M4 12a8 8 0 0 1 16 0z" fill="#ffad5c"/>`,
  equilibrio: `<path d="M12 4.5v15M7 19.5h10M5 8.5h14M5 8.5l-2.4 5.2a2.6 2.6 0 0 0 4.8 0zM19 8.5l-2.4 5.2a2.6 2.6 0 0 0 4.8 0z" ${T}/>`,
};

export const svg = (id, tam = 24) => `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" aria-hidden="true">${ICONES[id] ?? ''}</svg>`;

export function textoValor(p, v) {
  if (p.tipo === 'matiz') return `${Math.round(v)}°`;
  if (p.tipo === 'graus') return `${v > 0 ? '+' : ''}${Math.round(v)}°`;
  if (p.id === 'vibracaoNv') return `${Math.round(50 + v / 2)}%`;
  const n = Math.round(v);
  return n > 0 && p.tipo === 'normal' ? `+${n}` : `${n}`;
}

// ---------- disco (botão redondo com anel) ----------

export function disco(p, v, ativo) {
  const faixa = FAIXAS[p.tipo];
  const r = 26;
  const circ = 2 * Math.PI * r;
  let arco = '';
  if (p.tipo === 'matiz') {
    arco = `<circle cx="32" cy="32" r="${r}" fill="none" stroke="hsl(${v} 85% 62%)" stroke-width="3"/>`;
  } else {
    const fr = Math.abs(v - padraoDe(p)) / Math.max(Math.abs(faixa.max), Math.abs(faixa.min));
    if (fr > 0.001) {
      const len = circ * Math.min(1, fr);
      const sentido = v < 0 ? `transform="scale(-1 1) translate(-64 0)"` : '';
      arco = `<g ${sentido}><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--acao)" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="${len} ${circ}" transform="rotate(-90 32 32)"/></g>`;
    }
  }
  const mexido = p.tipo === 'matiz' ? false : Math.abs(v - padraoDe(p)) > 0.5;
  return `<button class="disco${ativo ? ' ativo' : ''}${mexido ? ' mexido' : ''}" data-param="${p.id}" title="${p.nome} (duplo clique zera)">
    <span class="disco-anel">
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--trilho)" stroke-width="3"/>${arco}
      </svg>
      <span class="disco-icone">${svg(p.id, 22)}</span>
    </span>
    <span class="disco-nome">${p.nome}</span>
  </button>`;
}

// ---------- régua ----------

export class Regua {
  constructor(el, { aoMudar }) {
    this.el = el;
    this.aoMudar = aoMudar;
    this.el.innerHTML = `<div class="regua-faixa"></div><div class="regua-marca"></div>`;
    this.faixa = el.querySelector('.regua-faixa');
    this.p = null;
    this.valor = 0;
    this.#ligar();
  }

  definir(p, valor) {
    const mudouParam = this.p?.id !== p.id;
    this.p = p;
    this.valor = valor;
    const f = FAIXAS[p.tipo];
    this.px = p.tipo === 'matiz' ? 3 : p.tipo === 'graus' ? 3.4 : p.tipo === 'positivo' ? 7 : 6;
    if (mudouParam) {
      this.faixa.style.width = `${(f.max - f.min) * this.px}px`;
      this.faixa.classList.toggle('matiz', p.tipo === 'matiz');
      this.faixa.style.setProperty('--passo', `${this.px * 5}px`);
      this.faixa.style.setProperty('--passo-grande', `${this.px * 25}px`);
      const zero = (padraoDe(p) - f.min) * this.px;
      this.faixa.style.setProperty('--zero', `${zero}px`);
      this.faixa.classList.toggle('com-zero', p.tipo !== 'matiz');
    }
    this.#posicionar();
    this.el.setAttribute('aria-label', p.nome);
    this.el.setAttribute('aria-valuenow', String(Math.round(valor)));
  }

  #posicionar() {
    const f = FAIXAS[this.p.tipo];
    this.faixa.style.transform = `translateX(${-(this.valor - f.min) * this.px}px)`;
  }

  #mudar(v, forcar = false) {
    const f = FAIXAS[this.p.tipo];
    let novo = Math.round(Math.min(f.max, Math.max(f.min, v)));
    if (novo === this.valor && !forcar) return;
    this.valor = novo;
    this.#posicionar();
    this.aoMudar(this.p.id, novo);
  }

  #ligar() {
    let inicioX = 0;
    let inicioV = 0;
    let preso = 0; // segura um pouco no zero, como o "clique" do iPhone
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'slider');
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.p) return;
      this.el.setPointerCapture(e.pointerId);
      inicioX = e.clientX;
      inicioV = this.valor;
      preso = 0;
      this.el.classList.add('arrastando');
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!this.el.hasPointerCapture(e.pointerId)) return;
      const bruto = inicioV - (e.clientX - inicioX) / this.px;
      if (this.p.tipo !== 'matiz') {
        const zero = padraoDe(this.p);
        if ((this.valor - zero) * (bruto - zero) < 0) {
          preso = 1;
          this.#mudar(zero);
          return;
        }
        if (preso && Math.abs(bruto - zero) < 2.5) return;
        preso = 0;
      }
      this.#mudar(bruto);
    });
    const soltar = (e) => {
      if (this.el.hasPointerCapture?.(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
      this.el.classList.remove('arrastando');
    };
    this.el.addEventListener('pointerup', soltar);
    this.el.addEventListener('pointercancel', soltar);
    this.el.addEventListener('dblclick', () => this.p && this.#mudar(padraoDe(this.p), true));
    this.el.addEventListener('wheel', (e) => {
      if (!this.p) return;
      e.preventDefault();
      const passo = e.shiftKey ? 5 : 1;
      this.#mudar(this.valor + (e.deltaY > 0 || e.deltaX > 0 ? -passo : passo));
    }, { passive: false });
    this.el.addEventListener('keydown', (e) => {
      if (!this.p) return;
      const passo = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') this.#mudar(this.valor - passo);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') this.#mudar(this.valor + passo);
      else if (e.key === 'Home' || e.key === '0') this.#mudar(padraoDe(this.p), true);
      else return;
      e.preventDefault();
    });
  }
}

// ---------- pad de tom e cor ----------

export class Pad {
  constructor(canvas, { aoMudar }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.aoMudar = aoMudar;
    this.x = 0;
    this.y = 0;
    this.cor = '#9a9aa2';
    this.#ligar();
    new ResizeObserver(() => this.desenhar()).observe(canvas);
  }

  definir(x, y, cor) {
    this.x = x;
    this.y = y;
    this.cor = cor;
    this.desenhar();
  }

  #pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const m = 22;
    const x = ((e.clientX - r.left - m) / (r.width - 2 * m)) * 2 - 1;
    const y = -(((e.clientY - r.top - m) / (r.height - 2 * m)) * 2 - 1);
    return [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
  }

  #ligar() {
    const c = this.canvas;
    c.tabIndex = 0;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const [x, y] = this.#pos(e);
      this.#mudar(x, y);
    });
    c.addEventListener('pointermove', (e) => {
      if (!c.hasPointerCapture(e.pointerId)) return;
      const [x, y] = this.#pos(e);
      this.#mudar(x, y);
    });
    c.addEventListener('pointerup', (e) => c.hasPointerCapture(e.pointerId) && c.releasePointerCapture(e.pointerId));
    c.addEventListener('dblclick', () => this.#mudar(0, 0));
    c.addEventListener('keydown', (e) => {
      const p = e.shiftKey ? 0.1 : 0.02;
      const mov = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, p], ArrowDown: [0, -p] }[e.key];
      if (!mov) return;
      e.preventDefault();
      this.#mudar(Math.max(-1, Math.min(1, this.x + mov[0])), Math.max(-1, Math.min(1, this.y + mov[1])));
    });
  }

  #mudar(x, y) {
    // ímã no centro: perto do meio, volta ao neutro
    if (Math.hypot(x, y) < 0.05) { x = 0; y = 0; }
    this.x = Math.round(x * 100) / 100;
    this.y = Math.round(y * 100) / 100;
    this.desenhar();
    this.aoMudar(this.x, this.y);
  }

  desenhar() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const lado = c.clientWidth;
    if (!lado) return;
    const px = Math.round(lado * dpr);
    if (c.width !== px || c.height !== px) {
      c.width = px;
      c.height = px;
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, lado, lado);
    const m = 22;
    const util = lado - 2 * m;
    const hx = m + ((this.x + 1) / 2) * util;
    const hy = m + ((1 - this.y) / 2) * util;
    const N = 9;
    // a grade de pontos: quanto mais perto do ponto de controle, maior e mais acesa
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const px = m + (i / (N - 1)) * util;
        const py = m + (j / (N - 1)) * util;
        const d = Math.hypot(px - hx, py - hy) / util;
        const perto = Math.exp(-d * d * 14);
        // eixo x: menos cor à esquerda (cinza), mais cor à direita (cor do estilo)
        const fx = i / (N - 1);
        const fy = 1 - j / (N - 1);
        g.globalAlpha = 0.28 + 0.6 * perto;
        g.fillStyle = misturar('#8d8d94', this.cor, fx * 0.9);
        const r = 1.6 + 2.6 * perto + 0.8 * fy;
        g.beginPath();
        g.arc(px, py, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    // cruz do centro
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(lado / 2, m - 6); g.lineTo(lado / 2, lado - m + 6);
    g.moveTo(m - 6, lado / 2); g.lineTo(lado - m + 6, lado / 2);
    g.stroke();
    // ponto de controle
    g.beginPath();
    g.arc(hx, hy, 13, 0, Math.PI * 2);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.arc(hx, hy, 6, 0, Math.PI * 2);
    g.fillStyle = '#ffffff';
    g.fill();
  }
}

export function misturar(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function hex(h) {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

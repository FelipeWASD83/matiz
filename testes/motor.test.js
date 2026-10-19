import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, calcularSaida, aplicarNoPixel, ehNeutro, combinar } from '../ui/js/motor.js';
import { ESTILOS, PARAMETROS, FAIXAS } from '../ui/js/parametros.js';

const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const com = (mudancas) => ({ ...estadoInicial(), ...mudancas });

test('estado inicial não mexe em nada', () => {
  const s = calcularSaida(estadoInicial(), { nvidia: true });
  assert.ok(ehNeutro(s));
  for (const px of [[0, 0, 0], [1, 1, 1], [0.3, 0.6, 0.9]]) {
    aplicarNoPixel(s, px).forEach((v, i) => perto(v, px[i], 0.004));
  }
});

test('formato que o Windows espera', () => {
  const s = calcularSaida(com({ estilo: 'cinema' }));
  assert.equal(s.matriz.length, 25);
  assert.equal(s.rampa.length, 768);
  assert.equal(s.matriz[18], 1);
  assert.equal(s.matriz[24], 1);
  assert.ok(s.rampa.every((v) => v >= 0 && v <= 1));
});

test('toda curva de todo estilo é crescente', () => {
  for (const e of ESTILOS) {
    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 0, 1]) {
        const s = calcularSaida(com({ estilo: e.id, paleta: 100, pad: { x, y } }));
        for (let c = 0; c < 3; c++) {
          for (let i = 1; i < 256; i++) assert.ok(s.rampa[c * 256 + i] >= s.rampa[c * 256 + i - 1], `${e.id} canal ${c} ponto ${i}`);
        }
      }
    }
  }
});

test('todo controle no extremo continua dando curva válida', () => {
  for (const p of PARAMETROS) {
    for (const v of [FAIXAS[p.tipo].min, FAIXAS[p.tipo].max]) {
      const s = calcularSaida(com({ ajustes: { [p.id]: v, sombraForca: 100, realceForca: 100 } }));
      assert.ok(s.rampa.every((x) => Number.isFinite(x) && x >= 0 && x <= 1), p.id);
      assert.ok(s.matriz.every(Number.isFinite), p.id);
    }
  }
});

test('saturação -100 vira preto e branco', () => {
  const s = calcularSaida(com({ ajustes: { saturacao: -100 } }));
  const [r, g, b] = aplicarNoPixel(s, [0.9, 0.2, 0.1]);
  perto(r, g, 0.002);
  perto(g, b, 0.002);
});

test('saturação positiva afasta os canais', () => {
  const s = calcularSaida(com({ ajustes: { saturacao: 60 } }));
  const [r, , b] = aplicarNoPixel(s, [0.7, 0.5, 0.3]);
  assert.ok(r - b > 0.4);
});

test('exposição e brilho clareiam o meio-tom', () => {
  for (const id of ['exposicao', 'brilho', 'sombras']) {
    const s = calcularSaida(com({ ajustes: { [id]: 50 } }));
    assert.ok(luma(aplicarNoPixel(s, [0.3, 0.3, 0.3])) > 0.33, id);
  }
});

test('contraste escurece sombra e clareia realce sem mexer no meio', () => {
  const s = calcularSaida(com({ ajustes: { contraste: 60 } }));
  assert.ok(aplicarNoPixel(s, [0.2, 0.2, 0.2])[0] < 0.2);
  assert.ok(aplicarNoPixel(s, [0.8, 0.8, 0.8])[0] > 0.8);
  perto(aplicarNoPixel(s, [0.5, 0.5, 0.5])[0], 0.5, 0.01);
});

test('calor esquenta (mais vermelho que azul)', () => {
  const s = calcularSaida(com({ ajustes: { calor: 60 } }));
  const [r, , b] = aplicarNoPixel(s, [0.5, 0.5, 0.5]);
  assert.ok(r > 0.53 && b < 0.47);
});

test('preto e branco puros continuam puros sem desbotar nem ponto preto', () => {
  const s = calcularSaida(com({ ajustes: { contraste: 40, saturacao: 30, calor: 20 } }));
  aplicarNoPixel(s, [0, 0, 0]).forEach((v) => perto(v, 0, 0.002));
});

test('paleta 0 desliga o estilo e intensidade 0 desliga tudo', () => {
  assert.ok(ehNeutro(calcularSaida(com({ estilo: 'dramatico', paleta: 0 }))));
  assert.ok(ehNeutro(calcularSaida(com({ estilo: 'vivido', ajustes: { exposicao: 40 }, pad: { x: 1, y: 1 }, intensidade: 0 }))));
});

test('pad mexe em cor no eixo x e em tom no eixo y', () => {
  const mais = combinar(com({ pad: { x: 1, y: 0 } }));
  assert.ok(mais.saturacao > 0.5);
  const aberto = combinar(com({ pad: { x: 0, y: 1 } }));
  assert.ok(aberto.sombras > 0.4 && aberto.contraste < 0);
});

test('vibração NVIDIA só vai quando tem NVIDIA e valor', () => {
  assert.equal(calcularSaida(com({ ajustes: { vibracaoNv: 40 } }), { nvidia: false }).vibracao, null);
  assert.equal(calcularSaida(com({ ajustes: { vibracaoNv: 40 } }), { nvidia: true }).vibracao, 40);
  assert.equal(calcularSaida(com({}), { nvidia: true }).vibracao, null);
});

test('estilo salvo pelo usuário funciona igual a um pronto', () => {
  const meu = { id: 'x1', nome: 'Meu', look: { contraste: 30, calor: -20 } };
  const s = calcularSaida(com({ estilo: 'u:x1', meus: [meu], paleta: 100 }));
  const [r, , b] = aplicarNoPixel(s, [0.5, 0.5, 0.5]);
  assert.ok(b > r);
});

test('tom nas sombras puxa a sombra para a cor escolhida', () => {
  const s = calcularSaida(com({ ajustes: { sombraForca: 80, sombraMatiz: 210 } }));
  const [r, , b] = aplicarNoPixel(s, [0.15, 0.15, 0.15]);
  assert.ok(b > r + 0.03);
});

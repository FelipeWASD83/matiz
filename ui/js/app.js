import { GRUPOS, PARAMETROS, PARAM, ESTILOS, ESTILO, FAIXAS, padraoDe } from './parametros.js';
import { estadoInicial, calcularSaida } from './motor.js';
import { Previa } from './previa.js';
import { Regua, Pad, disco, textoValor } from './controles.js';
import { enviar, aoReceber } from './ponte.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const DICAS = {
  exposicao: 'Quanta luz entra na imagem inteira, como abrir o diafragma.',
  brilho: 'Clareia ou escurece os meios-tons sem estourar o branco.',
  realces: 'Mexe só nas partes claras: céu, luzes, reflexos.',
  sombras: 'Abre ou fecha as partes escuras. Subir ajuda a ver inimigo no escuro.',
  contraste: 'Separa claro de escuro. Positivo dá peso, negativo deixa lavado.',
  pontoPreto: 'Onde o preto começa. Positivo deixa o preto mais fundo, negativo levanta o preto.',
  desbotar: 'Tira o preto absoluto e o branco absoluto, efeito de filme velho.',
  saturacao: 'Quanta cor a imagem tem. -100 é preto e branco.',
  vibracaoNv: 'A vibração digital do Painel de Controle da NVIDIA, aplicada pelo driver. Na prévia é só uma aproximação.',
  calor: 'Positivo puxa para o laranja, negativo para o azul.',
  tint: 'Positivo puxa para o magenta, negativo para o verde.',
  matiz: 'Gira todas as cores no círculo cromático. Para efeito, não para correção.',
  vermelho: 'Curva só do vermelho: positivo clareia o vermelho nos meios-tons.',
  verde: 'Curva só do verde.',
  azul: 'Curva só do azul.',
  sombraForca: 'Quanto da cor escolhida entra nas sombras.',
  sombraMatiz: 'A cor que tinge as sombras (azul-petróleo é o clássico de cinema).',
  realceForca: 'Quanto da cor escolhida entra nos realces.',
  realceMatiz: 'A cor que tinge os realces (laranja é o par clássico do azul-petróleo).',
  equilibrio: 'Positivo favorece o tom dos realces, negativo o das sombras.',
};

// ---------- estado ----------

const est = {
  ...estadoInicial(),
  imagem: 0,
  grupo: 'estilos',
  disco: { luz: 'exposicao', cor: 'saturacao', canais: 'vermelho', tons: 'sombraForca' },
};
let sis = null;
let saida = calcularSaida(est);
let imagens = [];
let segurandoOriginal = false;

function nvidia() {
  return !!sis?.nvidia?.disponivel;
}

function valorDe(id) {
  return est.ajustes[id] ?? padraoDe(PARAM[id]);
}

function paraSalvar() {
  const { estilo, paleta, intensidade, pad, ajustes, meus, imagem, grupo, disco: d } = est;
  return { estilo, paleta, intensidade, pad, ajustes, meus, imagem, grupo, disco: d };
}

function carregar(salvo) {
  if (!salvo || typeof salvo !== 'object') return;
  for (const k of ['estilo', 'paleta', 'intensidade', 'pad', 'ajustes', 'meus', 'imagem', 'grupo', 'disco']) {
    if (salvo[k] !== undefined && salvo[k] !== null) est[k] = salvo[k];
  }
  est.ajustes = { ...est.ajustes };
  est.meus = Array.isArray(est.meus) ? est.meus : [];
  est.disco = { luz: 'exposicao', cor: 'saturacao', canais: 'vermelho', tons: 'sombraForca', ...est.disco };
  if (!GRUPOS.some((g) => g.id === est.grupo)) est.grupo = 'estilos';
  if (!estiloExiste(est.estilo)) est.estilo = 'original';
}

function estiloExiste(id) {
  return !!ESTILO[id] || est.meus.some((m) => 'u:' + m.id === id);
}

function estiloAtual() {
  if (est.estilo.startsWith('u:')) {
    const m = est.meus.find((x) => 'u:' + x.id === est.estilo);
    if (m) return { id: est.estilo, nome: m.nome, cor: m.cor || '#c9c9cf', look: m.look };
  }
  return ESTILO[est.estilo] ?? ESTILO.original;
}

// ---------- mudança e envio ----------

let envioPendente = null;
let ultimoEnvio = 0;

function enviarAplicar() {
  const agora = performance.now();
  const mandar = () => {
    envioPendente = null;
    ultimoEnvio = performance.now();
    enviar({
      tipo: 'aplicar',
      saida: { matriz: saida.matriz, rampa: saida.rampa, vibracao: saida.vibracao },
      interface: paraSalvar(),
    });
  };
  if (agora - ultimoEnvio > 45) mandar();
  else if (!envioPendente) envioPendente = setTimeout(mandar, 45);
}

function mudou({ painel = false, miniaturas = true } = {}) {
  saida = calcularSaida(est, { nvidia: nvidia() });
  pedirDesenho();
  enviarAplicar();
  if (miniaturas) agendarMiniaturas();
  if (painel) montarPainel();
  else atualizarPainel();
  montarGrupos();
}

// ---------- prévia ----------

let previa = null;
let mini = null;
const miniCanvas = document.createElement('canvas');
try {
  previa = new Previa($('#previa'));
  mini = new Previa(miniCanvas);
} catch {
  $('#sem-webgl').hidden = false;
  $('#previa').hidden = true;
}

let desenhoPedido = false;
function pedirDesenho() {
  if (desenhoPedido) return;
  desenhoPedido = true;
  requestAnimationFrame(() => {
    desenhoPedido = false;
    desenhar();
  });
}

function desenhar() {
  if (!previa?.temImagem) return;
  const moldura = $('#moldura');
  const caixa = moldura.getBoundingClientRect();
  const proporcao = previa.largura / previa.altura;
  let w = caixa.width;
  let h = w / proporcao;
  if (h > caixa.height) {
    h = caixa.height;
    w = h * proporcao;
  }
  w = Math.max(1, Math.floor(w));
  h = Math.max(1, Math.floor(h));
  const canvas = $('#previa');
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const dpr = window.devicePixelRatio || 1;
  previa.desenhar(saida, { largura: Math.round(w * dpr), altura: Math.round(h * dpr), original: segurandoOriginal });
  $('#selo-original').hidden = !segurandoOriginal;
}

new ResizeObserver(pedirDesenho).observe($('#moldura'));

let timerMini = null;
function agendarMiniaturas() {
  clearTimeout(timerMini);
  timerMini = setTimeout(desenharMiniaturas, 180);
}

function desenharMiniaturas() {
  if (!mini?.temImagem) return;
  const W = 240;
  const H = 150;
  for (const c of $$('.estilo canvas')) {
    const id = c.closest('.estilo').dataset.estilo;
    const s = calcularSaida({ ...est, estilo: id, paleta: id === est.estilo ? est.paleta : 100 }, { nvidia: nvidia() });
    // a miniatura recorta o meio da imagem no formato 16:10
    const prop = mini.largura / mini.altura;
    mini.desenhar(s, { largura: Math.round(H * prop), altura: H });
    if (c.width !== W) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    const sw = Math.round(H * prop);
    g.drawImage(miniCanvas, (sw - W) / 2, 0, W, H, 0, 0, W, H);
  }
}

async function carregarImagens() {
  try {
    const r = await fetch('imagens/lista.json', { cache: 'no-store' });
    imagens = await r.json();
  } catch {
    imagens = [];
  }
  if (!imagens.length) imagens = [{ arquivo: 'porsche-sakura.jpg', nome: 'Porsche nas cerejeiras' }];
  const caixa = $('#imagens');
  caixa.innerHTML = imagens.length > 1
    ? imagens.map((im, i) => `<button class="imagem-escolha" data-i="${i}" title="${im.nome}" style="background-image:url('imagens/${encodeURI(im.arquivo)}')"></button>`).join('')
    : '';
  caixa.onclick = (e) => {
    const b = e.target.closest('.imagem-escolha');
    if (!b) return;
    est.imagem = Number(b.dataset.i);
    usarImagem();
    enviarAplicar();
  };
  usarImagem();
}

function usarImagem() {
  if (est.imagem >= imagens.length) est.imagem = 0;
  $$('.imagem-escolha').forEach((b) => b.classList.toggle('ativa', Number(b.dataset.i) === est.imagem));
  const img = new Image();
  img.onload = () => {
    previa?.definirImagem(img);
    mini?.definirImagem(img);
    pedirDesenho();
    desenharMiniaturas();
  };
  img.src = `imagens/${encodeURI(imagens[est.imagem].arquivo)}`;
}

// ---------- topo ----------

function montarTopo() {
  if (!sis) return;
  $('#versao').textContent = sis.versao ? `v${sis.versao}` : '';
  $('#ligado').checked = !!sis.ligado;
  $('#atalho-dica').textContent = sis.atalho?.tecla ? `${sis.atalho.nome} liga e desliga` : '';
  const el = $('#situacao');
  let tipo = sis.situacao;
  let texto;
  const telas = sis.telas || [];
  const alvo = telas.filter((t) => t.alvo);
  if (sis.situacao === 'desligado') texto = 'Desligado: cores originais';
  else if (sis.situacao === 'pausado') texto = 'Pausado com esta janela na frente';
  else {
    texto = `Ligado na tela inteira · curvas em ${alvo.length} de ${telas.length} ${telas.length === 1 ? 'tela' : 'telas'}`;
    const limitadas = alvo.filter((t) => t.limite < 0.999);
    const erro = alvo.filter((t) => t.erro);
    if (!sis.mag) { texto += ' · a matriz de cor não iniciou'; tipo = 'aviso'; }
    if (erro.length) { texto += ` · a placa recusou a curva em ${erro.map((t) => t.nome).join(', ')}`; tipo = 'aviso'; }
    else if (limitadas.length) { texto += ` · o Windows limitou a curva a ${Math.round(limitadas[0].limite * 100)}%`; tipo = 'aviso'; }
  }
  el.dataset.tipo = tipo;
  $('#situacao-texto').textContent = texto;
  $('#situacao-texto').title = texto;
  $('#b-testar').hidden = !(sis.pausarComJanela && sis.ligado);
}

// ---------- grupos ----------

function contaMexidos(grupo) {
  return PARAMETROS.filter((p) => p.grupo === grupo && p.tipo !== 'matiz' && Math.abs(valorDe(p.id) - padraoDe(p)) > 0.5).length;
}

function montarGrupos() {
  $('#grupos').innerHTML = GRUPOS.map((g) => {
    let conta = '';
    if (['luz', 'cor', 'canais', 'tons'].includes(g.id)) {
      const n = contaMexidos(g.id);
      if (n) conta = `<span class="grupo-conta">${n}</span>`;
    } else if (g.id === 'estilos' && est.estilo !== 'original') {
      conta = '<span class="grupo-conta">1</span>';
    }
    return `<button class="grupo${est.grupo === g.id ? ' ativo' : ''}" data-grupo="${g.id}">${g.nome}${conta}</button>`;
  }).join('');
}

$('#grupos').addEventListener('click', (e) => {
  const b = e.target.closest('.grupo');
  if (!b || b.dataset.grupo === est.grupo) return;
  est.grupo = b.dataset.grupo;
  montarGrupos();
  montarPainel();
  enviarAplicar();
});

// ---------- painel ----------

let regua = null;
let pad = null;

function montarPainel() {
  const painel = $('#painel');
  regua = null;
  pad = null;
  if (est.grupo === 'estilos') painel.innerHTML = htmlEstilos();
  else if (est.grupo === 'opcoes') painel.innerHTML = htmlOpcoes();
  else painel.innerHTML = htmlGrupo(est.grupo);
  ligarPainel();
  atualizarPainel();
}

function htmlEstilos() {
  return `
  <div class="secao">
    <div class="cabeca"><h2>Estilo</h2><span class="detalhe" id="estilo-nome"></span></div>
    <div class="pad-area">
      <canvas class="pad" id="pad" aria-label="Pad de tom e cor: arraste; duplo clique volta ao centro"></canvas>
      <span class="eixo eixo-y">Tom</span>
      <span class="eixo eixo-x">Cor</span>
    </div>
    <div class="leituras mono"><span>Tom <b id="leitura-tom">0</b></span><span>Cor <b id="leitura-cor">0</b></span></div>
    <label class="fio">
      <span class="fio-nome">Paleta</span><span class="fio-valor mono" id="paleta-valor"></span>
      <input type="range" id="paleta" min="0" max="100" step="1">
    </label>
    <label class="fio">
      <span class="fio-nome">Intensidade geral</span><span class="fio-valor mono" id="intensidade-valor"></span>
      <input type="range" id="intensidade" min="0" max="100" step="1">
    </label>
    <p class="nota fraca">Arraste o ponto: para cima abre as sombras, para baixo aprofunda; para a direita mais cor, para a esquerda menos. A paleta dosa o estilo escolhido; a intensidade dosa tudo, inclusive os ajustes finos.</p>
  </div>`;
}

// ---------- faixa de estilos (embaixo da prévia, como no iOS) ----------

function montarFaixa() {
  const todos = [
    ...ESTILOS.map((e) => ({ ...e, meu: false })),
    ...est.meus.map((m) => ({ id: 'u:' + m.id, nome: m.nome, meu: true })),
  ];
  $('#faixa').innerHTML = `
    <div class="faixa-rolagem" id="faixa-rolagem">
      ${todos.map((e) => `
        <button class="estilo${est.estilo === e.id ? ' ativo' : ''}" data-estilo="${e.id}" title="${escapar(e.nome)}">
          <canvas width="240" height="150"></canvas>
          <span class="estilo-nome">${escapar(e.nome)}</span>
          ${e.meu ? `<span class="estilo-apagar" role="button" tabindex="0" data-apagar="${e.id}" title="Apagar este estilo">×</span>` : ''}
        </button>`).join('')}
      <button class="estilo novo" id="salvar-abrir" title="Guarda tudo o que está na tela como um estilo seu">
        <span class="estilo-mais">+</span>
        <span class="estilo-nome">Salvar o atual</span>
      </button>
    </div>
    <form class="salvar" id="salvar-form" hidden>
      <input class="campo" id="salvar-nome" maxlength="24" placeholder="Nome do estilo" autocomplete="off">
      <button class="botao" type="submit">Salvar</button>
      <button class="botao secundario" type="button" id="salvar-cancelar">Cancelar</button>
    </form>`;
  const ativo = $('#faixa .estilo.ativo');
  ativo?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  desenharMiniaturas();
}

function marcarEstiloAtivo() {
  $$('#faixa .estilo[data-estilo]').forEach((x) => x.classList.toggle('ativo', x.dataset.estilo === est.estilo));
}

function ligarFaixa() {
  const faixa = $('#faixa');
  faixa.addEventListener('click', (e) => {
    const apagar = e.target.closest('[data-apagar]');
    if (apagar) {
      e.stopPropagation();
      const id = apagar.dataset.apagar;
      est.meus = est.meus.filter((m) => 'u:' + m.id !== id);
      if (est.estilo === id) est.estilo = 'original';
      montarFaixa();
      mudou();
      return;
    }
    if (e.target.closest('#salvar-abrir')) {
      $('#salvar-form').hidden = false;
      $('#salvar-nome').value = '';
      $('#salvar-nome').focus();
      return;
    }
    if (e.target.closest('#salvar-cancelar')) {
      $('#salvar-form').hidden = true;
      return;
    }
    const b = e.target.closest('.estilo[data-estilo]');
    if (!b) return;
    est.estilo = b.dataset.estilo;
    marcarEstiloAtivo();
    mudou();
  });
  faixa.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = $('#salvar-nome').value.trim() || `Meu estilo ${est.meus.length + 1}`;
    salvarEstiloAtual(nome);
  });
  // roda do mouse rola a faixa para o lado
  faixa.addEventListener('wheel', (e) => {
    const r = $('#faixa-rolagem');
    if (!r || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    r.scrollLeft += e.deltaY;
  }, { passive: false });
}

function htmlGrupo(grupo) {
  const nome = GRUPOS.find((g) => g.id === grupo).nome;
  return `
  <div class="secao">
    <div class="cabeca"><h2>${nome}</h2><button class="link" id="zerar-grupo">Zerar ${nome.toLowerCase()}</button></div>
    <div class="discos" id="discos"></div>
    <div class="ajuste-atual">
      <span class="ajuste-nome" id="ajuste-nome"></span>
      <span class="ajuste-valor" id="ajuste-valor"></span>
    </div>
    <div class="regua" id="regua"></div>
    <p class="nota" id="ajuste-dica"></p>
    <p class="nota fraca">Arraste a régua, use a roda do mouse (Shift vai de 5 em 5) ou as setas. Duplo clique na régua ou no disco zera.</p>
  </div>`;
}

function htmlOpcoes() {
  if (!sis) return '<div class="secao"><p class="nota">Conectando ao Matiz…</p></div>';
  const telas = sis.telas || [];
  const atalho = sis.atalho || {};
  return `
  <div class="secao">
    <div class="cabeca"><h2>Comportamento</h2></div>
    <div class="opcao">
      <span class="opcao-texto"><span class="opcao-nome">Pausar com esta janela na frente</span>
      <span class="opcao-dica">Assim a prévia não leva o filtro duas vezes. Ao clicar no jogo ou em outra janela, o filtro volta.</span></span>
      ${chave('op-pausar', sis.pausarComJanela)}
    </div>
    <div class="opcao">
      <span class="opcao-texto"><span class="opcao-nome">Iniciar com o Windows</span>
      <span class="opcao-dica">${!sis.instalado ? 'Só vale na cópia instalada (a que o instalar.ps1 põe no PC); esta roda de outra pasta.' : 'Abre direto na bandeja, perto do relógio, já com o filtro.'}</span></span>
      ${chave('op-iniciar', sis.iniciarComWindows, !sis.instalado)}
    </div>
    <div class="opcao">
      <span class="opcao-texto"><span class="opcao-nome">Atalho para ligar e desligar</span>
      <span class="opcao-dica">Funciona com o jogo na frente. Clique e aperte a combinação nova.</span></span>
      <button class="botao secundario atalho-botao" id="op-atalho">${escapar(atalho.nome || 'nenhum')}</button>
    </div>
  </div>
  <div class="secao">
    <div class="cabeca"><h2>Telas</h2><span class="detalhe">curvas de luz</span></div>
    <div class="lista">
      ${telas.map((t) => `
        <label class="tela">
          <input type="checkbox" data-tela="${escapar(t.dispositivo)}" ${t.alvo ? 'checked' : ''}>
          <span class="tela-nome">${escapar(t.nome)}${t.principal ? ' · principal' : ''}</span>
          <span class="tela-info${t.erro || t.limite < 0.999 ? ' ruim' : ''}">${t.erro ? 'a placa recusou' : t.limite < 0.999 ? `limitada a ${Math.round(t.limite * 100)}%` : escapar(t.dispositivo.replace('\\\\.\\', ''))}</span>
        </label>`).join('')}
    </div>
    <p class="nota fraca">Luz, contraste, canais e tons vão por tela. A cor (saturação, calor, matiz) vale sempre em todas, porque o Windows só oferece a matriz de cor para a área de trabalho inteira.</p>
  </div>
  <div class="secao">
    <div class="cabeca"><h2>NVIDIA</h2></div>
    <p class="nota">${nvidia() ? '<b>Vibração digital disponível.</b> Ela aparece em Cor e é aplicada pelo driver, como no Painel de Controle da NVIDIA. Ao sair do Matiz ela volta ao valor que estava.' : `Vibração digital indisponível: ${escapar(sis.nvidia?.motivo || 'motivo desconhecido')}`}</p>
  </div>
  <div class="secao">
    <div class="cabeca"><h2>Atualização</h2><span class="detalhe mono">v${escapar(sis.versao || '?')}</span></div>
    <div id="atualizacao"><p class="nota fraca">${sis.dev ? 'Esta é a cópia de desenvolvimento: ela se atualiza pelo git, não por aqui.' : 'Procura a versão nova nas releases do GitHub.'}</p></div>
    <button class="botao secundario" id="op-procurar">Procurar atualização</button>
  </div>
  <div class="secao">
    <div class="cabeca"><h2>Limites</h2></div>
    <ul class="limites">
      <li>Só cor e luz. Nitidez, vinheta, granulação e bloom exigem injetar código em cada jogo, e o Matiz não injeta nada.</li>
      <li>Com o HDR do Windows ligado, as curvas de luz não funcionam (a cor continua).</li>
      <li>Jogo em tela cheia exclusiva de verdade pode pular a matriz de cor. Tela cheia sem bordas funciona.</li>
      <li>Jogo que mexe na gama ao abrir é corrigido em até 2 segundos.</li>
      <li>Ao sair pelo menu da bandeja, a tela volta exatamente ao que era antes.</li>
    </ul>
    <button class="botao secundario" id="op-sair">Sair do Matiz</button>
  </div>`;
}

function chave(id, ligado, desabilitado = false) {
  return `<label class="chave pequena"><input type="checkbox" id="${id}" ${ligado ? 'checked' : ''} ${desabilitado ? 'disabled' : ''}><span class="chave-trilho"><span class="chave-bolinha"></span></span></label>`;
}

function escapar(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function ligarPainel() {
  const painel = $('#painel');

  if (est.grupo === 'estilos') {
    pad = new Pad($('#pad'), {
      aoMudar: (x, y) => {
        est.pad = { x, y };
        mudou();
      },
    });
    const paleta = $('#paleta');
    paleta.addEventListener('input', () => { est.paleta = Number(paleta.value); mudou({ miniaturas: false }); });
    paleta.addEventListener('change', () => agendarMiniaturas());
    const intens = $('#intensidade');
    intens.addEventListener('input', () => { est.intensidade = Number(intens.value); mudou({ miniaturas: false }); });
    intens.addEventListener('change', () => agendarMiniaturas());

  } else if (est.grupo === 'opcoes') {
    ligarOpcoes();
  } else {
    regua = new Regua($('#regua'), {
      aoMudar: (id, v) => {
        est.ajustes[id] = v;
        mudou();
      },
    });
    $('#discos').addEventListener('click', (e) => {
      const b = e.target.closest('.disco');
      if (!b || b.disabled) return;
      est.disco[est.grupo] = b.dataset.param;
      atualizarPainel();
      $('#regua').focus();
    });
    $('#discos').addEventListener('dblclick', (e) => {
      const b = e.target.closest('.disco');
      if (!b || b.disabled) return;
      delete est.ajustes[b.dataset.param];
      mudou();
    });
    $('#zerar-grupo').addEventListener('click', () => {
      for (const p of PARAMETROS) if (p.grupo === est.grupo) delete est.ajustes[p.id];
      mudou();
    });
  }
}

/** Transforma tudo o que está na tela (estilo + pad + ajustes) num estilo novo e zera o resto. */
function salvarEstiloAtual(nome) {
  const look = {};
  const atual = estiloAtual().look || {};
  const paleta = est.paleta / 100;
  const intens = est.intensidade / 100;
  const padC = { saturacao: 55 * est.pad.x, sombras: 45 * est.pad.y, contraste: -35 * est.pad.y, brilho: 10 * est.pad.y };
  for (const p of PARAMETROS) {
    if (p.tipo === 'matiz') continue;
    const v = ((est.ajustes[p.id] ?? 0) + paleta * (atual[p.id] ?? 0) + (padC[p.id] ?? 0)) * intens;
    if (Math.abs(v) > 0.5) look[p.id] = Math.round(v);
  }
  // tons: fica o da camada mais forte (o estilo só guarda uma cor por faixa)
  for (const faixa of ['sombra', 'realce']) {
    const meu = (est.ajustes[faixa + 'Forca'] ?? 0) * intens;
    const doEstilo = paleta * (atual[faixa + 'Forca'] ?? 0) * intens;
    if (meu >= doEstilo && meu > 0.5) look[faixa + 'Matiz'] = valorDe(faixa + 'Matiz');
    else if (doEstilo > 0.5) look[faixa + 'Matiz'] = atual[faixa + 'Matiz'] ?? PARAM[faixa + 'Matiz'].padrao;
    const f = meu + doEstilo;
    if (f > 0.5) look[faixa + 'Forca'] = Math.round(Math.min(100, f));
    else delete look[faixa + 'Forca'];
  }
  const id = Date.now().toString(36);
  const cor = corDoLook(look);
  est.meus = [...est.meus, { id, nome, look, cor }];
  est.estilo = 'u:' + id;
  est.ajustes = {};
  est.pad = { x: 0, y: 0 };
  est.paleta = 100;
  est.intensidade = 100;
  montarFaixa();
  mudou({ painel: true });
  avisar(`Estilo “${nome}” salvo. Os ajustes finos foram zerados porque agora fazem parte dele.`);
}

function corDoLook(look) {
  const s = calcularSaida({ ...estadoInicial(), estilo: 'original', ajustes: look });
  const px = [0.62, 0.55, 0.5].map((v, c) => s.rampa[c * 256 + Math.round(v * 255)]);
  return '#' + px.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
}

function atualizarPainel() {
  if (est.grupo === 'estilos') {
    const e = estiloAtual();
    const nome = $('#estilo-nome');
    if (!nome) return;
    nome.textContent = e.nome;
    pad?.definir(est.pad.x, est.pad.y, e.cor || '#9a9aa2');
    const fmt = (v) => { const n = Math.round(v * 100); return n > 0 ? `+${n}` : `${n}`; };
    $('#leitura-tom').textContent = fmt(est.pad.y);
    $('#leitura-cor').textContent = fmt(est.pad.x);
    const paleta = $('#paleta');
    paleta.value = est.paleta;
    $('#paleta-valor').textContent = est.estilo === 'original' ? '—' : `${est.paleta}`;
    paleta.disabled = est.estilo === 'original';
    paleta.style.setProperty('--trilho-fio', `linear-gradient(90deg, var(--superficie-3), ${e.cor || '#9a9aa2'})`);
    $('#intensidade').value = est.intensidade;
    $('#intensidade-valor').textContent = `${est.intensidade}`;
    return;
  }
  if (est.grupo === 'opcoes' || !$('#discos')) return;

  const params = PARAMETROS.filter((p) => p.grupo === est.grupo);
  let atual = PARAM[est.disco[est.grupo]];
  if (!atual || atual.grupo !== est.grupo || (atual.nvidia && !nvidia())) atual = params.find((p) => !p.nvidia || nvidia());
  est.disco[est.grupo] = atual.id;

  $('#discos').innerHTML = params.map((p) => {
    const html = disco(p, valorDe(p.id), p.id === atual.id);
    return p.nvidia && !nvidia() ? html.replace('<button', '<button disabled title="Precisa de placa NVIDIA"') : html;
  }).join('');

  const v = valorDe(atual.id);
  $('#ajuste-nome').textContent = atual.nome;
  const val = $('#ajuste-valor');
  val.textContent = textoValor(atual, v);
  val.classList.toggle('mexido', atual.tipo !== 'matiz' && Math.abs(v - padraoDe(atual)) > 0.5);
  if (atual.tipo === 'matiz') val.style.color = `hsl(${v} 85% 65%)`;
  else val.style.color = '';
  $('#ajuste-dica').textContent = DICAS[atual.id] || '';
  regua?.definir(atual, v);
}

// ---------- opções ----------

function ligarOpcoes() {
  $('#op-pausar')?.addEventListener('change', (e) => enviar({ tipo: 'opcao', chave: 'pausarComJanela', valor: e.target.checked }));
  $('#op-iniciar')?.addEventListener('change', (e) => enviar({ tipo: 'opcao', chave: 'iniciarComWindows', valor: e.target.checked }));
  $$('[data-tela]').forEach((c) => c.addEventListener('change', () => {
    const marcadas = $$('[data-tela]').filter((x) => x.checked).map((x) => x.dataset.tela);
    const todas = $$('[data-tela]').length;
    enviar({ tipo: 'opcao', chave: 'monitores', valor: marcadas.length === todas ? [] : marcadas.length ? marcadas : [marcadas[0] ?? ''] });
  }));
  $('#op-atalho')?.addEventListener('click', gravarAtalho);
  $('#op-procurar')?.addEventListener('click', () => {
    $('#atualizacao').innerHTML = '<p class="nota">Procurando…</p>';
    enviar({ tipo: 'atualizacao-checar' });
  });
  $('#op-sair')?.addEventListener('click', () => enviar({ tipo: 'sair' }));
}

const VK = (() => {
  const m = {};
  for (let i = 0; i < 26; i++) m['Key' + String.fromCharCode(65 + i)] = 65 + i;
  for (let i = 0; i < 10; i++) { m['Digit' + i] = 48 + i; m['Numpad' + i] = 96 + i; }
  for (let i = 1; i <= 24; i++) m['F' + i] = 111 + i;
  Object.assign(m, { Insert: 45, Delete: 46, Home: 36, End: 35, PageUp: 33, PageDown: 34, Pause: 19, Space: 32, Backquote: 192, Minus: 189, Equal: 187 });
  return m;
})();

function gravarAtalho() {
  const b = $('#op-atalho');
  b.classList.add('gravando');
  b.textContent = 'Aperte… (Esc cancela)';
  const aoTeclar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') return terminar();
    const tecla = VK[e.code];
    if (!tecla) return;
    const mods = (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.shiftKey ? 4 : 0) | (e.metaKey ? 8 : 0);
    if (!mods && !/^F\d+$/.test(e.code)) {
      b.textContent = 'Use Ctrl, Alt ou Shift junto';
      return;
    }
    const nome = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Win', e.code.replace(/^Key|^Digit/, '')].filter(Boolean).join(' + ');
    enviar({ tipo: 'opcao', chave: 'atalho', valor: { mods, tecla }, nome });
    terminar();
  };
  const terminar = () => {
    window.removeEventListener('keydown', aoTeclar, true);
    b.classList.remove('gravando');
    b.textContent = sis?.atalho?.nome || 'nenhum';
  };
  window.addEventListener('keydown', aoTeclar, true);
}

function mostrarAtualizacao(m) {
  const caixa = $('#atualizacao');
  if (!caixa) return;
  if (m.erro) { caixa.innerHTML = `<p class="nota">${escapar(m.erro)}</p>`; return; }
  if (!m.nova) { caixa.innerHTML = `<p class="nota">Você está na versão mais nova (v${escapar(m.atual)}).</p>`; return; }
  caixa.innerHTML = `
    <p class="nota"><b>Versão ${escapar(m.ultima)} disponível.</b> O que mudou:</p>
    <pre class="notas-versao">${escapar(m.notas || 'Sem notas.')}</pre>
    ${m.dev ? '<p class="nota fraca">Esta é a cópia de desenvolvimento: atualize pelo git.</p>' : '<button class="botao" id="op-instalar">Instalar e reabrir</button>'}`;
  $('#op-instalar')?.addEventListener('click', (e) => {
    e.target.disabled = true;
    enviar({ tipo: 'atualizacao-instalar' });
  });
}

// ---------- barra da prévia ----------

function segurar(botao, aoApertar, aoSoltar) {
  const solta = () => { botao.classList.remove('segurando'); aoSoltar(); };
  botao.addEventListener('pointerdown', (e) => { botao.setPointerCapture(e.pointerId); botao.classList.add('segurando'); aoApertar(); });
  botao.addEventListener('pointerup', solta);
  botao.addEventListener('pointercancel', solta);
  botao.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); botao.classList.add('segurando'); aoApertar(); } });
  botao.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') solta(); });
}

segurar($('#b-original'), () => { segurandoOriginal = true; desenhar(); }, () => { segurandoOriginal = false; desenhar(); });
segurar($('#b-testar'), () => enviar({ tipo: 'teste', valor: true }), () => enviar({ tipo: 'teste', valor: false }));

let confirmarTimer = null;
$('#b-redefinir').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!b.classList.contains('confirmar')) {
    b.classList.add('confirmar');
    b.textContent = 'Clique de novo para zerar';
    confirmarTimer = setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Redefinir tudo'; }, 3000);
    return;
  }
  clearTimeout(confirmarTimer);
  b.classList.remove('confirmar');
  b.textContent = 'Redefinir tudo';
  Object.assign(est, { estilo: 'original', paleta: 70, intensidade: 100, pad: { x: 0, y: 0 }, ajustes: {} });
  marcarEstiloAtivo();
  mudou({ painel: true });
});

$('#ligado').addEventListener('change', (e) => enviar({ tipo: 'ligado', valor: e.target.checked }));

// ---------- aviso ----------

let avisoTimer = null;
function avisar(texto) {
  const a = $('#aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { a.hidden = true; }, 5000);
}

// ---------- mensagens do app ----------

let iniciado = false;
aoReceber((m) => {
  switch (m.tipo) {
    case 'estado': {
      const antes = nvidia();
      sis = { ...sis, ...m };
      if (!iniciado) {
        iniciado = true;
        carregar(m.interface);
        montarFaixa();
        montarGrupos();
        montarPainel();
        carregarImagens();
        mudou();
      } else if (est.grupo === 'opcoes') {
        montarPainel();
      } else if (antes !== nvidia()) {
        mudou({ painel: true });
      }
      montarTopo();
      break;
    }
    case 'status':
      sis = { ...sis, ...m };
      montarTopo();
      if (est.grupo === 'opcoes' && !document.activeElement?.closest?.('.painel')) montarPainel();
      break;
    case 'atualizacao':
      mostrarAtualizacao(m);
      break;
    case 'atualizacao-andamento':
      if ($('#atualizacao')) $('#atualizacao').innerHTML = `<p class="nota">${escapar(m.texto)}</p>`;
      break;
    case 'atualizacao-erro':
      if ($('#atualizacao')) $('#atualizacao').innerHTML = `<p class="nota">${escapar(m.texto)}</p>`;
      avisar(m.texto);
      break;
    case 'aviso':
      avisar(m.texto);
      break;
    default:
      break;
  }
});

ligarFaixa();
montarGrupos();
enviar({ tipo: 'pronto' });

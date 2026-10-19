// Conversa com o app (C#) pelo WebView2. Aberta num navegador comum (prévia de desenvolvimento),
// usa um app de mentira que responde igual, para dar para mexer na interface sem o Matiz rodando.

const ouvintes = new Set();
const real = !!window.chrome?.webview;

export const ehDesenvolvimento = !real;

export function enviar(msg) {
  if (real) window.chrome.webview.postMessage(msg);
  else falso(msg);
}

export function aoReceber(fn) {
  ouvintes.add(fn);
}

function entregar(msg) {
  for (const fn of ouvintes) fn(msg);
}

if (real) window.chrome.webview.addEventListener('message', (e) => entregar(e.data));

// ---------- app de mentira (só no navegador) ----------

const simulado = {
  ligado: true,
  pausarComJanela: true,
  iniciarComWindows: true,
  monitores: [],
  atalho: { mods: 1, tecla: 0x72, nome: 'Alt + F3', ok: true },
  interface: null,
};

function guardado() {
  try { return JSON.parse(localStorage.getItem('matiz-simulado') || 'null'); } catch { return null; }
}

function telas() {
  const alvo = (d) => simulado.monitores.length === 0 || simulado.monitores.includes(d);
  return [
    { dispositivo: '\\\\.\\DISPLAY1', nome: '3440 × 1440', principal: true, alvo: alvo('\\\\.\\DISPLAY1'), limite: 1, erro: false },
    { dispositivo: '\\\\.\\DISPLAY2', nome: '1080 × 1920', principal: false, alvo: alvo('\\\\.\\DISPLAY2'), limite: 1, erro: false },
    { dispositivo: '\\\\.\\DISPLAY3', nome: '3840 × 2160', principal: false, alvo: alvo('\\\\.\\DISPLAY3'), limite: 1, erro: false },
  ];
}

function status(tipo = 'status') {
  return {
    tipo,
    ligado: simulado.ligado,
    situacao: !simulado.ligado ? 'desligado' : 'ativo',
    mag: true,
    telas: telas(),
  };
}

function falso(msg) {
  const responder = (m) => setTimeout(() => entregar(m), 30);
  switch (msg.tipo) {
    case 'pronto':
      simulado.interface = guardado();
      responder({
        ...status('estado'),
        versao: '1.0.0',
        repositorio: 'FelipeWASD83/matiz',
        dev: true,
        pausarComJanela: simulado.pausarComJanela,
        iniciarComWindows: simulado.iniciarComWindows,
        monitores: simulado.monitores,
        atalho: simulado.atalho,
        nvidia: { disponivel: true, motivo: '' },
        interface: simulado.interface,
      });
      break;
    case 'aplicar':
      try { localStorage.setItem('matiz-simulado', JSON.stringify(msg.interface)); } catch { /* sem armazenamento */ }
      break;
    case 'ligado':
      simulado.ligado = msg.valor;
      responder(status());
      break;
    case 'opcao':
      simulado[msg.chave] = msg.valor;
      if (msg.chave === 'atalho') simulado.atalho = { ...msg.valor, nome: msg.nome || 'atalho', ok: true };
      responder({ ...status('estado'), versao: '1.0.0', dev: true, pausarComJanela: simulado.pausarComJanela, iniciarComWindows: simulado.iniciarComWindows, monitores: simulado.monitores, atalho: simulado.atalho, nvidia: { disponivel: true, motivo: '' } });
      break;
    case 'atualizacao-checar':
      responder({ tipo: 'atualizacao', atual: '1.0.0', dev: true, ultima: '1.0.0', nova: false, notas: '' });
      break;
    default:
      break;
  }
}

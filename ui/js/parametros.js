// Os controles e os estilos prontos. Para criar um estilo novo, copie uma linha de ESTILOS
// e mude os números (mesma escala dos controles: -100 a 100, matiz das cores de 0 a 360).

export const GRUPOS = [
  { id: 'estilos', nome: 'Estilos' },
  { id: 'luz', nome: 'Luz' },
  { id: 'cor', nome: 'Cor' },
  { id: 'canais', nome: 'Canais' },
  { id: 'tons', nome: 'Tons' },
  { id: 'opcoes', nome: 'Opções' },
];

// tipo: 'normal' (-100..100), 'positivo' (0..100), 'matiz' (0..360, cor do círculo cromático), 'graus' (-180..180)
export const PARAMETROS = [
  { id: 'exposicao', grupo: 'luz', nome: 'Exposição', tipo: 'normal' },
  { id: 'brilho', grupo: 'luz', nome: 'Brilho', tipo: 'normal' },
  { id: 'realces', grupo: 'luz', nome: 'Realces', tipo: 'normal' },
  { id: 'sombras', grupo: 'luz', nome: 'Sombras', tipo: 'normal' },
  { id: 'contraste', grupo: 'luz', nome: 'Contraste', tipo: 'normal' },
  { id: 'pontoPreto', grupo: 'luz', nome: 'Ponto preto', tipo: 'normal' },
  { id: 'desbotar', grupo: 'luz', nome: 'Desbotar', tipo: 'positivo' },

  { id: 'saturacao', grupo: 'cor', nome: 'Saturação', tipo: 'normal' },
  { id: 'vibracaoNv', grupo: 'cor', nome: 'Vibração NVIDIA', tipo: 'positivo', nvidia: true },
  { id: 'calor', grupo: 'cor', nome: 'Calor', tipo: 'normal' },
  { id: 'tint', grupo: 'cor', nome: 'Tint', tipo: 'normal' },
  { id: 'matiz', grupo: 'cor', nome: 'Matiz', tipo: 'graus' },

  { id: 'vermelho', grupo: 'canais', nome: 'Vermelho', tipo: 'normal' },
  { id: 'verde', grupo: 'canais', nome: 'Verde', tipo: 'normal' },
  { id: 'azul', grupo: 'canais', nome: 'Azul', tipo: 'normal' },

  { id: 'sombraForca', grupo: 'tons', nome: 'Tom nas sombras', tipo: 'positivo' },
  { id: 'sombraMatiz', grupo: 'tons', nome: 'Cor das sombras', tipo: 'matiz', padrao: 200 },
  { id: 'realceForca', grupo: 'tons', nome: 'Tom nos realces', tipo: 'positivo' },
  { id: 'realceMatiz', grupo: 'tons', nome: 'Cor dos realces', tipo: 'matiz', padrao: 35 },
  { id: 'equilibrio', grupo: 'tons', nome: 'Equilíbrio', tipo: 'normal' },
];

export const FAIXAS = {
  normal: { min: -100, max: 100 },
  positivo: { min: 0, max: 100 },
  matiz: { min: 0, max: 360 },
  graus: { min: -180, max: 180 },
};

export function padraoDe(p) {
  return p.padrao ?? 0;
}

export const PARAM = Object.fromEntries(PARAMETROS.map((p) => [p.id, p]));

// Estilos no espírito dos filtros do iOS e dos Estilos Fotográficos do iPhone.
// "cor" é só a amostra que pinta o pad e a barra de paleta.
export const ESTILOS = [
  { id: 'original', nome: 'Original', cor: '#9a9aa2', look: {} },
  { id: 'vivido', nome: 'Vívido', cor: '#ff8a5c', look: { saturacao: 35, contraste: 14, sombras: 6, brilho: 4 } },
  { id: 'vivido-quente', nome: 'Vívido Quente', cor: '#ffb057', look: { saturacao: 32, contraste: 14, sombras: 6, calor: 30 } },
  { id: 'vivido-frio', nome: 'Vívido Frio', cor: '#6cb8ff', look: { saturacao: 32, contraste: 14, sombras: 6, calor: -30 } },
  { id: 'dramatico', nome: 'Dramático', cor: '#c7a37a', look: { contraste: 45, sombras: -22, realces: -25, saturacao: -10, brilho: -8 } },
  { id: 'dramatico-quente', nome: 'Dramático Quente', cor: '#d9894a', look: { contraste: 45, sombras: -22, realces: -25, saturacao: -8, brilho: -8, calor: 32 } },
  { id: 'dramatico-frio', nome: 'Dramático Frio', cor: '#5f8fc4', look: { contraste: 45, sombras: -22, realces: -25, saturacao: -8, brilho: -8, calor: -32 } },
  { id: 'mono', nome: 'Mono', cor: '#b5b5b5', look: { saturacao: -100, contraste: 8 } },
  { id: 'prata', nome: 'Prata', cor: '#c9d3df', look: { saturacao: -100, contraste: 22, desbotar: 30, realceForca: 30, realceMatiz: 210, brilho: 6 } },
  { id: 'noir', nome: 'Noir', cor: '#5a5a5a', look: { saturacao: -100, contraste: 70, pontoPreto: 30, brilho: -10, realces: 10 } },
  { id: 'ambar', nome: 'Âmbar', cor: '#ffaa33', look: { calor: 35, tint: 5, saturacao: 10, sombraForca: 25, sombraMatiz: 30 } },
  { id: 'dourado', nome: 'Dourado', cor: '#f2c14e', look: { calor: 42, saturacao: 10, realceForca: 35, realceMatiz: 45, brilho: 4 } },
  { id: 'rose', nome: 'Rosé', cor: '#f29bb8', look: { calor: 14, tint: 25, realceForca: 30, realceMatiz: 340, saturacao: 4 } },
  { id: 'frio', nome: 'Frio', cor: '#7fb2e5', look: { calor: -35, tint: -5, sombraForca: 15, sombraMatiz: 215 } },
  { id: 'neutro', nome: 'Neutro', cor: '#a7a39b', look: { saturacao: -15, calor: -6, contraste: -4 } },
  { id: 'luminoso', nome: 'Luminoso', cor: '#ffe7a8', look: { brilho: 20, sombras: 30, contraste: -15, saturacao: 10 } },
  { id: 'etereo', nome: 'Etéreo', cor: '#e8c7e6', look: { desbotar: 35, contraste: -30, saturacao: -25, brilho: 15, realceForca: 15, realceMatiz: 330 } },
  { id: 'silencioso', nome: 'Silencioso', cor: '#9fa79a', look: { desbotar: 25, saturacao: -35, contraste: -20 } },
  { id: 'cinema', nome: 'Cinema', cor: '#3fb8b0', look: { sombraForca: 38, sombraMatiz: 190, realceForca: 30, realceMatiz: 32, contraste: 20, saturacao: -10, pontoPreto: 6 } },
  { id: 'competitivo', nome: 'Competitivo', cor: '#7cf29a', look: { sombras: 48, pontoPreto: -12, saturacao: 30, contraste: 10, brilho: 10 } },
];

export const ESTILO = Object.fromEntries(ESTILOS.map((e) => [e.id, e]));

// O pad: x = cor (menos cor <-> mais cor), y = tom (mais fundo <-> mais aberto).
export function contribuicaoDoPad(x, y) {
  return {
    saturacao: 55 * x,
    sombras: 45 * y,
    contraste: -35 * y,
    brilho: 10 * y,
  };
}

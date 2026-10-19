# Matiz

Filtro de cor e tom para a tela inteira do Windows, e por isso para qualquer jogo, sem injetar nada no jogo.
Você abre a janela, escolhe um estilo ou mexe nos ajustes, fecha, e o filtro continua valendo enquanto o
Matiz estiver na bandeja (perto do relógio).

Os controles imitam os do iPhone: o pad quadrado dos Estilos Fotográficos (tom num eixo, cor no outro),
a régua de girar do editor do Fotos e estilos prontos no espírito dos filtros do iOS.

## Instalar

Precisa do .NET 10 (já está no PC) e do WebView2 do Edge (vem com o Windows 11). Na pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File ".\ferramentas\instalar.ps1"
```

Ele compila, instala em `%LOCALAPPDATA%\Programs\Matiz`, cria o atalho **Matiz** no Menu Iniciar e abre o app.
Rodar de novo atualiza a cópia instalada (fecha o Matiz aberto, devolvendo as cores, e abre de novo).

## Como usar

- **Estilos:** a faixa embaixo da imagem tem os estilos prontos (Vívido, Dramático, Mono, Prata, Noir, Âmbar,
  Dourado, Rosé, Cinema, Competitivo e outros). No painel **Estilo**, o pad ajusta tom (para cima abre as
  sombras, para baixo aprofunda) e cor (direita mais cor, esquerda menos). A **Paleta** dosa o estilo
  escolhido; a **Intensidade geral** dosa tudo. "+ Salvar o atual" guarda o que está na tela como estilo seu.
- **Luz, Cor, Canais e Tons:** escolha um disco e arraste a régua (ou roda do mouse; Shift vai de 5 em 5;
  setas também). Duplo clique na régua ou no disco zera aquele ajuste.
- **Segure: original** mostra a imagem sem filtro. **Segure: ver na tela** aplica o filtro de verdade
  enquanto a janela está na frente (normalmente ele pausa com a janela aberta para a prévia não levar o
  filtro duas vezes).
- **Atalho global** liga e desliga o filtro com o jogo na frente. O padrão é **Alt + F3**; se outro programa
  já usar (o overlay da NVIDIA usa), o Matiz cai para **Ctrl + Alt + F3** e avisa. Troca em **Opções**.
- **Fechar a janela** não desliga o filtro. Para tirar tudo, use **Sair** no menu do ícone da bandeja ou em
  Opções: a tela volta exatamente ao que era.

## O que ele faz por baixo

Dois mecanismos do próprio Windows, nenhum dentro do jogo e sem custo de GPU:

1. **Matriz de cor** pela API de Ampliação (a mesma das cores de acessibilidade), aplicada pelo compositor
   do Windows em todas as telas: saturação, calor, tint e matiz.
2. **Rampa de gama** da placa de vídeo, uma por tela: exposição, brilho, realces, sombras, contraste, ponto
   preto, desbotar, curvas por canal e tons de sombra e realce.

Com placa NVIDIA, tem ainda a **Vibração NVIDIA** (a vibração digital do Painel de Controle), aplicada pelo
driver e devolvida ao valor anterior quando o Matiz sai.

## Limites

- Só cor e luz. Nitidez, vinheta, granulação, bloom e afins exigem injetar código em cada jogo (como o
  ReShade faz), o que o Matiz não faz de propósito (risco de ban em jogo com anticheat).
- Com o **HDR do Windows ligado**, a rampa de gama não funciona (a matriz de cor continua).
- Jogo em **tela cheia exclusiva** de verdade pode pular a matriz de cor; tela cheia sem bordas funciona.
- Jogo que mexe na gama ao abrir é corrigido sozinho em até 2 segundos.
- O Windows recusa rampa "extrema". Se recusar, o Matiz aplica a maior parte que ele aceita e avisa no topo.

## Memória

O processo da bandeja usa uns 20 MB e não gasta CPU parado. A janela roda num processo à parte (uns 120 MB
com o WebView2) que some inteiro quando você fecha.

## Atualização

Em **Opções > Atualização**, "Procurar atualização" olha as releases do GitHub
(`FelipeWASD83/matiz`), mostra o que mudou, baixa, confere o SHA-256 e troca os arquivos. Se a versão nova
não abrir em 25 segundos, ela volta sozinha para a anterior. Configuração e estilos salvos
(`%APPDATA%\matiz`) nunca são tocados. Publicar uma versão: `ferramentas\publicar-versao.ps1`.

## Desenvolvimento

- `src/Matiz/`: o app (C#, .NET 10, WPF + WebView2).
- `ui/`: a interface (HTML, CSS e JS sem dependências). A conta do filtro está em `ui/js/motor.js`; os
  estilos prontos em `ui/js/parametros.js`.
- `npm test` (ou `node --test`): testes da conta do filtro.
- `Matiz.exe --autoteste`: aplica um filtro moderado por um instante, confere lendo de volta do Windows e da
  placa, restaura e grava o resultado em `%APPDATA%\matiz\autoteste.txt`.
- Prévia da interface no navegador (com um app de mentira respondendo): `python -m http.server 4353 --directory ui`.

## Licença

MIT.

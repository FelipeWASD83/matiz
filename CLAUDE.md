# CLAUDE.md: matiz

Filtro de cor e tom na tela inteira do Windows, para qualquer jogo, sem injetar nada. Criado em 19/10/2026
(pedido do Felipe, plano aprovado com os acréscimos: atalho global, iniciar com o Windows, vibração NVIDIA
e pausa com a janela na frente). Repositório **público** (`FelipeWASD83/matiz`, MIT). O README explica o
uso; aqui ficam as decisões e as armadilhas.

## Arquitetura

- **Dois processos, de propósito.** `Matiz.exe` (bandeja) aplica o filtro, guarda a configuração, escuta o
  atalho e fica em ~20 MB. `Matiz.exe --janela` é a janela (WPF + WebView2, ~120 MB) e conversa com a
  bandeja por um pipe nomeado (`Canal.cs`), uma mensagem JSON por linha. O WPF e o WebView2 não devolvem
  memória depois de carregados; com a janela num processo só dela, fechar devolve tudo. **Não juntar de
  volta num processo só.** Pelo mesmo motivo a janela do atalho global é uma `NativeWindow` do WinForms, não
  uma `HwndSource` do WPF (a do WPF liga o motor de renderização e custava 45 MB).
- **A conta do filtro mora só no `ui/js/motor.js`.** A interface calcula a matriz 5x5 e as três curvas de
  256 pontos e manda pronto para o C# (`aplicar`); o C# só aplica e guarda o resultado na config, para
  reaplicar ao ligar o PC sem abrir a interface. A prévia (WebGL, `previa.js`) usa a mesma saída, na mesma
  ordem da tela: matriz primeiro, curvas depois.
- **Matriz de cor:** `MagSetFullscreenColorEffect` (API de Ampliação). Vale em todas as telas (não tem como
  escolher tela) e morre junto com o processo. Layout: linha = canal de entrada, coluna = de saída
  (`motor.matrizWindows`).
- **Curvas:** `SetDeviceGammaRamp` por tela, compostas por cima da rampa original (que pode ter calibração).
  O Windows recusa rampa extrema **sem dar erro**: o `Efeito` lê de volta e, se não bater, procura por busca
  binária a maior fração aceita e informa na interface. As curvas precisam ser crescentes (o motor garante).
- **Originais em disco** (`%APPDATA%\matiz\originais.json`, com a flag `sujo`): rampa e vibração de antes do
  filtro. Se o app cair com o filtro aplicado, a próxima abertura usa os guardados em vez de capturar a tela
  já filtrada. Não tirar isso.
- **Vigia:** a cada 2 s, se o filtro está ativo, confere matriz e rampas e reaplica o que um jogo ou o
  driver tiver trocado.
- **Vibração NVIDIA:** `nvapi64.dll` por `nvapi_QueryInterface` com IDs (`Nvapi.cs`; conferidos em
  19/10/2026 contra o `nvapi-rs`). Nível 0 = padrão do driver (50% no painel), máximo 63 = 100%. Ela
  **persiste no driver** depois que o app sai: por isso o `Restaurar` sempre devolve o nível original.
- **Atalho padrão Alt + F3**, que no PC dele já é do overlay da NVIDIA (conferido em 19/10/2026: o
  `RegisterHotKey` falha mesmo com o Matiz fechado). O núcleo cai para Ctrl + Alt + F3 (depois Alt + Shift +
  F3, Ctrl + Shift + F3), salva e avisa pela bandeja.
- **Iniciar com o Windows** (`HKCU\...\Run`) só é gravado pela cópia instalada em
  `%LOCALAPPDATA%\Programs\Matiz` (`Atualizador.Instalado()`), nunca pela compilação da pasta do projeto nem
  por cópia de teste.

## Smart App Control

O `Matiz.exe` recém-compilado (apphost do .NET) **rodou** em 19/10/2026. Se um dia o SAC passar a barrar,
a saída é rodar `dotnet Matiz.dll` (o `dotnet.exe` é assinado) e apontar o atalho e o `Run` para ele.
O WebView2Loader.dll é assinado pela Microsoft.

## Comandos

- Compilar: `dotnet build src\Matiz -c Release` (saída em `src\Matiz\bin\Release\net10.0-windows\win-x64`).
- Instalar/atualizar a cópia do PC: `powershell -ExecutionPolicy Bypass -File ".\ferramentas\instalar.ps1"`.
- Testes da conta: `node --test` na pasta do projeto.
- Autoteste do efeito na tela de verdade: `Matiz.exe --autoteste` (pisca o filtro por meio segundo,
  resultado em `%APPDATA%\matiz\autoteste.txt`, código 0 = ok). Fechar o Matiz da bandeja antes.
- Fechar o Matiz que estiver rodando, devolvendo as cores: `Matiz.exe --sair`.
- Prévia da interface: entrada `matiz` do `.claude/launch.json` da raiz (porta 4353). No navegador a
  `ponte.js` usa um app de mentira com 3 telas e NVIDIA, e guarda o estado no `localStorage`.
- Publicar versão (decisão dele): `ferramentas\publicar-versao.ps1`. Versão mora em `versao.json`,
  `package.json`, `src\Matiz\Matiz.csproj` e no topo do `CHANGELOG.md`; o script recusa se não baterem.

## Testado e não testado (19/10/2026)

- Testado: 15 testes da conta; autoteste na tela real (matriz lida de volta igual, curvas aceitas 100% no
  ultrawide e no monitor em pé, NVAPI respondendo, tudo restaurado); ponte interface ⇄ bandeja; atalho
  global alternando; troca de versão do atualizador numa pasta de teste (versão boa abre; versão quebrada
  volta sozinha em 25 s); memória (bandeja ~20 MB; janela ~120 MB só enquanto aberta); interface em
  1440×900, 3440×1440 e 1080×1920.
- **Não testado, fica com ele:** qualquer jogo (pedido dele), tela cheia exclusiva, HDR ligado, a TV,
  release de verdade no GitHub (nenhuma publicada ainda).

## Imagens de exemplo

Ficam em `ui/imagens/` e entram na lista `ui/imagens/lista.json` (`arquivo` e `nome`). Com mais de uma, a
barra embaixo da prévia mostra miniaturas para trocar. Ele vai mandar mais imagens depois.

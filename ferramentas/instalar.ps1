# Compila o Matiz e instala em %LOCALAPPDATA%\Programs\Matiz, com atalho no Menu Iniciar.
# Uso (na pasta do projeto): powershell -ExecutionPolicy Bypass -File ".\ferramentas\instalar.ps1" [-NaoAbrir]
# Pode rodar de novo a qualquer hora: fecha o Matiz que estiver aberto (devolvendo as cores), troca os
# arquivos e abre de novo. Configuração e estilos salvos ficam em %APPDATA%\matiz e não são tocados.

param([switch]$NaoAbrir)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$projeto = Join-Path $raiz 'src\Matiz\Matiz.csproj'
$destino = Join-Path $env:LOCALAPPDATA 'Programs\Matiz'
$saida = Join-Path $env:TEMP 'matiz-instalar'

Write-Host 'Compilando...'
if (Test-Path $saida) { Remove-Item $saida -Recurse -Force }
& dotnet publish $projeto -c Release -o $saida --nologo -v q
if ($LASTEXITCODE -ne 0) { throw 'A compilação falhou (veja as mensagens acima).' }
if (-not (Test-Path (Join-Path $saida 'ui\index.html'))) { throw 'A interface (ui) não foi junto na compilação.' }

$aberto = Get-Process Matiz -ErrorAction SilentlyContinue
if ($aberto) {
    Write-Host 'Fechando o Matiz aberto (as cores voltam ao original)...'
    $exeAberto = $aberto[0].Path
    if ($exeAberto) { & $exeAberto --sair }
    foreach ($p in $aberto) { $p.WaitForExit(10000) | Out-Null }
    Get-Process Matiz -ErrorAction SilentlyContinue | Stop-Process -Force
}

Write-Host "Instalando em $destino"
if (Test-Path $destino) { Get-ChildItem $destino -Force | Remove-Item -Recurse -Force }
New-Item -ItemType Directory -Force $destino | Out-Null
Copy-Item (Join-Path $saida '*') $destino -Recurse -Force
Remove-Item $saida -Recurse -Force

$exe = Join-Path $destino 'Matiz.exe'
$atalho = Join-Path ([Environment]::GetFolderPath('Programs')) 'Matiz.lnk'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($atalho)
$lnk.TargetPath = $exe
$lnk.WorkingDirectory = $destino
$lnk.IconLocation = "$(Join-Path $destino 'icone.ico'),0"
$lnk.Description = 'Filtro de cor e tom na tela inteira, para qualquer jogo'
$lnk.Save()
Write-Host "Atalho no Menu Iniciar: $atalho"

if (-not $NaoAbrir) {
    Start-Process $exe
    Write-Host 'Matiz aberto.'
}
Write-Host 'Pronto.'

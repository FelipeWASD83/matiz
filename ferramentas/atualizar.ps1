# Troca os arquivos do Matiz pela versao nova. Quem chama e o proprio app (Atualizador.cs), depois de baixar e
# conferir o pacote; ninguem precisa rodar isto na mao.
# Espera o app fechar, guarda a pasta atual em -Anterior, copia a nova, abre o app e espera o sinal de vida
# (o arquivo -Marca). Se o sinal nao vier em 25 s, fecha a nova e devolve a anterior.

param(
    [Parameter(Mandatory)][int]$Processo,
    [Parameter(Mandatory)][string]$Instalado,
    [Parameter(Mandatory)][string]$Novo,
    [Parameter(Mandatory)][string]$Anterior,
    [Parameter(Mandatory)][string]$Marca,
    [Parameter(Mandatory)][string]$Versao
)
$ErrorActionPreference = 'Stop'
$log = Join-Path (Split-Path -Parent $Marca) 'atualizacao.log'
function Anotar($t) { Add-Content -Path $log -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $t) -Encoding UTF8 }

function Copiar-Conteudo($de, $para) {
    New-Item -ItemType Directory -Force -Path $para | Out-Null
    Get-ChildItem -LiteralPath $de -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $para -Recurse -Force }
}

function Esvaziar($pasta) {
    if (Test-Path -LiteralPath $pasta) {
        Get-ChildItem -LiteralPath $pasta -Force | Remove-Item -Recurse -Force
    }
}

Anotar "inicio: $Versao em $Instalado"
try {
    $p = Get-Process -Id $Processo -ErrorAction SilentlyContinue
    if ($p) { $p.WaitForExit(30000) | Out-Null }
    Start-Sleep -Milliseconds 400

    if (Test-Path -LiteralPath $Anterior) { Remove-Item -LiteralPath $Anterior -Recurse -Force }
    Copiar-Conteudo $Instalado $Anterior
    Esvaziar $Instalado
    Copiar-Conteudo $Novo $Instalado
    Anotar "arquivos trocados"
}
catch {
    Anotar "falhou ao trocar: $($_.Exception.Message); voltando"
    Esvaziar $Instalado
    Copiar-Conteudo $Anterior $Instalado
    Start-Process -FilePath (Join-Path $Instalado 'Matiz.exe') -ArgumentList '--bandeja'
    exit 1
}

if (Test-Path -LiteralPath $Marca) { Remove-Item -LiteralPath $Marca -Force }
$nova = Start-Process -FilePath (Join-Path $Instalado 'Matiz.exe') -ArgumentList '--pos-atualizacao', "`"$Marca`"" -PassThru
$prazo = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $prazo -and -not (Test-Path -LiteralPath $Marca)) { Start-Sleep -Milliseconds 500 }

if (Test-Path -LiteralPath $Marca) {
    Anotar "versao $Versao abriu"
    Remove-Item -LiteralPath $Novo -Recurse -Force -ErrorAction SilentlyContinue
    exit 0
}

Anotar "a versao $Versao nao deu sinal de vida; voltando para a anterior"
try { if (-not $nova.HasExited) { $nova.Kill() } } catch {}
Start-Sleep -Milliseconds 500
Esvaziar $Instalado
Copiar-Conteudo $Anterior $Instalado
Start-Process -FilePath (Join-Path $Instalado 'Matiz.exe') -ArgumentList '--bandeja', '--atualizacao-falhou'
exit 1

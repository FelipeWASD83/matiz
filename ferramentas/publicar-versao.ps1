# Publica a versão atual do Matiz como release no GitHub (é ela que o botão "Procurar atualização" baixa).
# Quem roda é o Felipe: publicar é decisão dele.
# Antes: subir a versão em versao.json, package.json, src\Matiz\Matiz.csproj e CHANGELOG.md, commitar e dar push.
# Precisa do gh logado (gh auth login) com permissão no repositório.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Rodar([string]$exe, [string[]]$argumentos) {
    # No PowerShell 5.1, com 'Stop', qualquer linha no stderr vira erro fatal mesmo quando deu certo.
    $ErrorActionPreference = 'Continue'
    $saida = & $exe @argumentos 2>&1 | ForEach-Object { "$_" }
    return [pscustomobject]@{ codigo = $LASTEXITCODE; saida = (($saida -join "`n").Trim()) }
}

$info = Get-Content (Join-Path $raiz 'versao.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$versao = $info.versao
$repo = $info.repositorio
$pacote = Get-Content (Join-Path $raiz 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($pacote.version -ne $versao) { throw "package.json diz $($pacote.version) e versao.json diz $versao. Acerte antes." }
$csproj = Get-Content (Join-Path $raiz 'src\Matiz\Matiz.csproj') -Raw -Encoding UTF8
if ($csproj -notmatch "<Version>$([regex]::Escape($versao))</Version>") { throw "O Matiz.csproj não está na versão $versao. Acerte antes." }
$changelog = Get-Content (Join-Path $raiz 'CHANGELOG.md') -Raw -Encoding UTF8
if ($changelog -notmatch "## $([regex]::Escape($versao)) ") { throw "O CHANGELOG.md não tem a seção da versão $versao." }

if ((Rodar git @('status', '--porcelain')).saida) { throw 'Há mudanças não commitadas. Commite antes de publicar.' }
$r = Rodar git @('fetch', '-q', 'origin')
if ($r.codigo -ne 0) { throw "Não deu para falar com o GitHub (git fetch): $($r.saida)" }
$local = (Rodar git @('rev-parse', 'HEAD')).saida
$r = Rodar git @('rev-parse', '@{u}')
if ($r.codigo -ne 0) { throw 'Este ramo não está ligado ao GitHub. Rode: git push -u origin main' }
if ($local -ne $r.saida) { throw 'O commit atual ainda não foi enviado (git push) ou está atrás do GitHub.' }
if ((Rodar gh @('release', 'view', "v$versao", '--repo', $repo)).codigo -eq 0) { throw "A release v$versao já existe." }

# notas da release: só a seção desta versão do CHANGELOG
$linhas = $changelog -split "`r?`n"
$achou = $linhas | Where-Object { $_ -match "^## $([regex]::Escape($versao)) " } | Select-Object -First 1
$inicio = [array]::IndexOf($linhas, $achou)
$notas = @()
for ($i = $inicio + 1; $i -lt $linhas.Length; $i++) {
    if ($linhas[$i] -match '^## ') { break }
    $notas += $linhas[$i]
}

$tmp = Join-Path $env:TEMP "matiz-release-$versao"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
$app = Join-Path $tmp 'Matiz'
New-Item -ItemType Directory -Force $app | Out-Null
$arqNotas = Join-Path $tmp 'notas.md'
[IO.File]::WriteAllText($arqNotas, (($notas -join "`n").Trim()), [Text.UTF8Encoding]::new($false))

Write-Host 'Compilando...'
$r = Rodar dotnet @('publish', 'src\Matiz\Matiz.csproj', '-c', 'Release', '-o', $app, '--nologo', '-v', 'q')
if ($r.codigo -ne 0) { throw "A compilação falhou: $($r.saida)" }
if (-not (Test-Path (Join-Path $app 'ui\index.html'))) { throw 'A interface (ui) não foi junto na compilação.' }
if (-not (Test-Path (Join-Path $app 'Matiz.dll'))) { throw 'Falta o Matiz.dll na compilação.' }

# o pacote tem os arquivos na raiz (o atualizador também aceita uma pasta dentro)
$zip = Join-Path $tmp "matiz-$versao.zip"
Compress-Archive -Path (Join-Path $app '*') -DestinationPath $zip -CompressionLevel Optimal

Write-Host "Publicando v$versao em $repo com $zip"
$r = Rodar gh @('release', 'create', "v$versao", $zip, '--repo', $repo, '--title', "Matiz $versao", '--notes-file', $arqNotas, '--target', $local)
if ($r.codigo -ne 0) { throw "O gh não criou a release: $($r.saida)" }
Write-Host $r.saida
Write-Host 'Pronto. O botão "Procurar atualização" já enxerga esta versão.'

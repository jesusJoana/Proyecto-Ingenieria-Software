#Requires -Version 5.1
<# Fase 2, como usuario normal, misma cuenta de la fase 1.
   Restaura el paquete de trabajo, instala dependencias, prepara bases y pruebas.
   Se detiene ante errores. Al repetir no sobrescribe .env ni trabajo local. #>
[CmdletBinding()]
param([switch]$IPv4)
. "$PSScriptRoot\Common.ps1"
Assert-Guest
if (Test-Admin) { throw 'Cerrar terminal elevada y abrir Windows PowerShell COMO USUARIO NORMAL.' }
$p=Get-SetupPaths; $null=Use-Tools; $null=Get-Secrets
$null=Assert-ManagedService
if ((Get-Service $p.Service).Status -ne 'Running') { throw 'PostgreSQL no esta iniciado. Revisar fase 1.' }
$bundleRoot=(Resolve-Path "$PSScriptRoot\..\..\..\..").Path
$infoFile=Join-Path $bundleRoot 'bundle.json'
$ready=Join-Path $p.Private 'project-ready.json'
if (!(Test-Path -LiteralPath $ready)) {
    if (!(Test-Path $infoFile)) { throw 'Ejecutar este paso desde Entrega\workspace\scripts\provision\windows del ZIP exportado.' }
    $info=Get-Content $infoFile -Raw | ConvertFrom-Json
    if (@(Get-ChildItem -LiteralPath $p.Project -Force).Count) { throw 'Proyecto no vacio sin recibo. Se conserva. Si hubo fallo al clonar, revisar antes de repetir.' }
    Invoke-Native git @('clone','--branch',$info.Branch,(Join-Path $bundleRoot 'repository.bundle'),$p.Project)
    foreach ($relative in $info.Files) {
        $src=Join-Path (Join-Path $bundleRoot 'workspace') $relative; $dest=Join-Path $p.Project $relative
        Assert-ChildPath (Join-Path $bundleRoot 'workspace') $src; Assert-ChildPath $p.Project $dest
        New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($dest)) | Out-Null
        Copy-Item -LiteralPath $src -Destination $dest -Force
    }
    foreach ($relative in $info.Deleted) { $dest=Join-Path $p.Project $relative; Assert-ChildPath $p.Project $dest; if (Test-Path -LiteralPath $dest -PathType Leaf) { Remove-Item -LiteralPath $dest } }
    Invoke-Native git @('-C',$p.Project,'remote','set-url','origin',$info.Remote)
    @{ Root=$p.Project; SourceCommit=$info.Commit } | ConvertTo-Json | Set-Content -LiteralPath $ready -Encoding UTF8
}
$projectReceipt=Get-Content -LiteralPath $ready -Raw | ConvertFrom-Json
if ($projectReceipt.Root -ne $p.Project -or !(Test-Path (Join-Path $p.Project '.git')) -or !(Test-Path (Join-Path $p.Project 'package-lock.json'))) { throw 'Recibo o proyecto incompleto. Se conserva para revision.' }
Push-Location $p.Project
try {
    $manifest=Get-Content package.json -Raw | ConvertFrom-Json
    if ((& node --version) -ne ('v'+$manifest.engines.node) -or (& npm.cmd --version) -ne $manifest.packageManager.Substring(4)) { throw 'Node/npm no coinciden. Repetir fase 1 con la entrega correcta.' }
    Write-Host '1/6 Dependencias exactas del lockfile'
    Invoke-Native npm.cmd @('ci','--include=dev')
    Invoke-Native npm.cmd @('run','check:env')
    Write-Host '2/6 Bases, roles, aislamiento y archivos .env locales'
    Invoke-DatabaseHelper $p.Project 'setup'
    # El proyecto tiene ACL privada. .env queda fuera de Git y no se muestra.
    foreach ($mode in @('development','test','e2e')) { Invoke-Native git @('check-ignore',('.env.'+$mode)) }
    Write-Host '3/6 Migraciones (repetibles) en las tres bases'
    foreach ($script in @('db:migrate','db:migrate:test','db:migrate:e2e','check:db')) { Invoke-Native npm.cmd @('run',$script) }
    Write-Host '4/6 Chromium de la version Playwright instalada'
    $previous=$env:NODE_OPTIONS
    try {
        if ($IPv4) { $preload=(Join-Path $PSScriptRoot 'playwright-ipv4.cjs').Replace('\','/'); $env:NODE_OPTIONS=($previous+' --require="'+$preload+'"').Trim() }
        Invoke-Native node @('node_modules/playwright/cli.js','install','chromium','--only-shell')
    } finally { $env:NODE_OPTIONS=$previous }
    Write-Host '5/6 Editor y extensiones aisladas'
    $versions=Get-Content "$PSScriptRoot\versions.json" -Raw | ConvertFrom-Json
    $userData=Join-Path $p.Private 'code-user'; $extensions=Join-Path $p.Private 'code-extensions'
    New-Item -ItemType Directory -Force -Path (Join-Path $userData 'User') | Out-Null
    $settings=Join-Path $userData 'User\settings.json'
    if (!(Test-Path $settings)) { Write-Utf8 $settings '{"update.mode":"none","extensions.autoUpdate":false,"extensions.autoCheckUpdates":false,"terminal.integrated.defaultProfile.windows":"Windows PowerShell"}' }
    $code=Join-Path $p.Tools 'Code\bin\code.cmd'
    foreach ($extension in $versions.extensions) { Invoke-Native $code @('--user-data-dir',$userData,'--extensions-dir',$extensions,'--install-extension',$extension) }
    $installed=@(& $code --user-data-dir $userData --extensions-dir $extensions --list-extensions --show-versions); Assert-ExitCode $LASTEXITCODE 'Extensiones'
    foreach ($extension in $versions.extensions) { if ($installed -notcontains $extension) { throw "No se confirma extension $extension" } }
    Write-Host '6/6 Comprobaciones completas de herramientas y aplicacion existente'
    Invoke-Native npm.cmd @('run','check:tests')
    Invoke-Native npm.cmd @('run','verify')
    Write-Host 'OK: entorno instalado y pruebas correctas. Falta comprobar reinicio y abrir pgAdmin/editor segun manual.'
} finally { Pop-Location }

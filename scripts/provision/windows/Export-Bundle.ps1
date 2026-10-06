#Requires -Version 5.1
<# Ejecutar en el ANFITRION, como usuario normal. Empaqueta el estado actual
   (tambien scripts aun no publicados) y el historial Git. No hace commit/push.
   Excluye .env, dependencias, logs e ignorados. No ejecuta ningun instalador. #>
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Destination)
. "$PSScriptRoot\Common.ps1"
$root=(Resolve-Path "$PSScriptRoot\..\..\..").Path
$target=[IO.Path]::GetFullPath($Destination)
if ($target.StartsWith($root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Guardar el ZIP fuera del repositorio.' }
if (Test-Path -LiteralPath $target) { throw 'El ZIP ya existe. Elegir otro nombre.' }
$temp=Join-Path $env:TEMP ('refind-export-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
$overlay=Join-Path $temp 'workspace'; New-Item -ItemType Directory -Path $overlay | Out-Null
Push-Location $root
try {
    Invoke-Native git @('bundle','create',(Join-Path $temp 'repository.bundle'),'--all')
    $files=@(& git -c core.quotepath=false ls-files --cached --others --exclude-standard); Assert-ExitCode $LASTEXITCODE 'Listado Git'
    $copied=@(); $deleted=@()
    foreach ($relative in ($files | Select-Object -Unique)) {
        if ($relative -match '(^|/)(\.env($|\.(?!example$))|node_modules/|\.git/|secrets\.xml$)' -or $relative -match '\.(log|vdi|vmdk|iso)$') { continue }
        $source=Join-Path $root $relative; $dest=Join-Path $overlay $relative
        Assert-ChildPath $root $source; Assert-ChildPath $overlay $dest
        if (!(Test-Path -LiteralPath $source -PathType Leaf)) { $deleted+=$relative; continue }
        # OneDrive marca archivos normales como ReparsePoint: copiar hidrata su contenido.
        # Rechazar enlaces reales, no los marcadores de almacenamiento de OneDrive.
        if ((Get-Item -LiteralPath $source).LinkType -in @('SymbolicLink','Junction')) { throw 'No exportar enlaces de archivos.' }
        New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($dest)) | Out-Null
        Copy-Item -LiteralPath $source -Destination $dest; $copied+=$relative
    }
    if (!($copied -contains 'scripts/provision/windows/Install-Machine.ps1')) { throw 'Faltan los scripts nuevos en el paquete.' }
    $branch=& git branch --show-current; Assert-ExitCode $LASTEXITCODE 'Rama Git'
    if (!$branch) { throw 'Situarse en una rama antes de exportar.' }
    @{ Files=$copied; Deleted=$deleted; Branch=$branch; Commit=(& git rev-parse HEAD); Remote='https://github.com/jesusJoana/Proyecto-Ingenieria-Software.git' } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $temp 'bundle.json') -Encoding UTF8
    Compress-Archive -Path "$temp\*" -DestinationPath $target
    Write-Host "OK: $target. Contiene cambios locales; comprobar git status en la VM antes de hacer commits."
} finally {
    Pop-Location
    # Unicamente nuestra carpeta temporal verificada, nunca el repositorio.
    Assert-ChildPath $env:TEMP $temp
    Remove-Item -LiteralPath $temp -Recurse -Force
}

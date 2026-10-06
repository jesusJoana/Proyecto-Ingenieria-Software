# Ejecuta los preambulos REALES, antes de cualquier instalacion, sobre una copia
# temporal con dobles de VM/servicios. Prueba rutas desde C:\ y otra carpeta.
$ErrorActionPreference='Stop'
. "$PSScriptRoot\..\..\scripts\provision\windows\Common.ps1"
$repo=Resolve-ProjectRoot (Resolve-Path "$PSScriptRoot\..\..\scripts\provision\windows").Path ''
$temp=Join-Path $env:TEMP ('refind-entry-'+[guid]::NewGuid().ToString('N'))
$fixture=Join-Path $temp ('Origen [prueba] '+[char]0x00f1)
$scripts=Join-Path $fixture 'scripts\provision\windows'
New-Item -ItemType Directory -Path $scripts -Force | Out-Null
try {
    Copy-Item -LiteralPath (Join-Path $repo 'package.json') -Destination $fixture
    Copy-Item -LiteralPath (Join-Path $repo 'scripts\provision\windows\versions.json') -Destination $scripts
    $common=[IO.File]::ReadAllText((Join-Path $repo 'scripts\provision\windows\Common.ps1'))
    # Ningun doble llama a WMI, al instalador, a PostgreSQL ni a secretos reales.
    $stubs=@'
function Assert-Guest {}
function Test-Admin { return $env:REFIND_PATH_CASE -in @('Install-Machine','Test-Persistence') }
function Get-SetupPaths { return @{Private=$env:REFIND_PATH_FIXTURE;Project=$env:REFIND_PATH_FIXTURE;Service='audit-only'} }
function Use-Tools { return 'audit-only' }
function Get-Secrets { return @{dev='test-only'} }
function Unprotect-Value($Value) { return $Value }
function Assert-ManagedService {}
function Get-Service {
    $service=[pscustomobject]@{Status='Running'}
    $service | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value {}
    return $service
}
function Restart-Service($Name) { if ($Name -ne 'audit-only') { throw 'Servicio inesperado' } }
function Invoke-DatabaseHelper($Project,$Mode) {
    if ($Project -ne $env:REFIND_PATH_FIXTURE) { throw 'Ruta de base incorrecta' }
}
function Invoke-Native($File,$Arguments) {
    if ((Get-Location).Path -ne $env:REFIND_PATH_FIXTURE) { throw 'npm se ejecutaria en otra carpeta' }
}
'@
    Write-Utf8 (Join-Path $scripts 'Common.ps1') ($common+"`n"+$stubs)
    foreach ($case in @('Install-Machine','Prepare-Project')) {
        $real=[IO.File]::ReadAllText((Join-Path $repo ('scripts\provision\windows\'+$case+'.ps1')))
        $stop=if ($case -eq 'Install-Machine') { '$receipt=' } else { '$ready=' }
        $index=$real.IndexOf($stop)
        if ($index -lt 0) { throw 'No se encuentra limite seguro del preambulo.' }
        $ending=if ($case -eq 'Install-Machine') { 'Write-Output ("AUDIT_ROOT="+$SourceRoot); Write-Output ("AUDIT_NODE="+$nodeVersion)' } else { 'Write-Output ("AUDIT_ROOT="+$source); Write-Output ("AUDIT_BUNDLE="+$bundleRoot)' }
        $entry=Join-Path $scripts ($case+'.ps1')
        Write-Utf8 $entry ($real.Substring(0,$index)+"`n"+$ending)
        $env:REFIND_PATH_CASE=$case; $env:REFIND_PATH_FIXTURE=$fixture
        foreach ($cwd in @('C:\',$env:TEMP)) {
            Push-Location -LiteralPath $cwd
            try {
                $result=@(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $entry)
                Assert-ExitCode $LASTEXITCODE $case
                if ($result -notcontains ('AUDIT_ROOT='+$fixture)) { throw "$case no resuelve su propia raiz desde $cwd" }
                if ($case -eq 'Install-Machine' -and $result -notcontains ('AUDIT_NODE='+((Get-Content -LiteralPath (Join-Path $fixture 'package.json') -Raw | ConvertFrom-Json).engines.node))) { throw 'No leyo package.json correcto' }
                Write-Host "OK: $case desde $cwd con ruta especial y sin instalar."
            } finally { Pop-Location }
        }
    }
    # Los demas puntos de entrada se ejecutan completos con servicios y secretos ficticios.
    foreach ($case in @('Enter-Environment','Test-Environment','Test-Persistence','Get-LocalPassword')) {
        $entry=Join-Path $scripts ($case+'.ps1')
        Copy-Item -LiteralPath (Join-Path $repo ('scripts\provision\windows\'+$case+'.ps1')) -Destination $entry
        $env:REFIND_PATH_CASE=$case
        $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$entry)
        if ($case -eq 'Get-LocalPassword') { $arguments+=@('-Environment','development') }
        foreach ($cwd in @('C:\',$env:TEMP)) {
            Push-Location -LiteralPath $cwd
            try {
                $null=& powershell.exe @arguments
                Assert-ExitCode $LASTEXITCODE $case
                Write-Host "OK: $case desde $cwd con servicios simulados."
            } finally { Pop-Location }
        }
    }
} finally {
    Remove-Item Env:REFIND_PATH_CASE,Env:REFIND_PATH_FIXTURE -ErrorAction SilentlyContinue
    Assert-ChildPath $env:TEMP $temp; Remove-Item -LiteralPath $temp -Recurse -Force
}

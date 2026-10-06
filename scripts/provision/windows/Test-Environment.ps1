#Requires -Version 5.1
# Verificacion posterior (tambien despues de reiniciar la VM). No instala paquetes.
. "$PSScriptRoot\Common.ps1"
Assert-Guest
if (Test-Admin) { throw 'Ejecutar las pruebas como usuario normal.' }
$p=Get-SetupPaths; $null=Use-Tools; $null=Assert-ManagedService
Push-Location $p.Project
try {
    Invoke-DatabaseHelper $p.Project 'verify'
    foreach ($script in @('check:env','check:db','check:tests','verify')) { Invoke-Native npm.cmd @('run',$script) }
    Write-Host 'OK: entorno y pruebas actuales comprobados.'
} finally { Pop-Location }

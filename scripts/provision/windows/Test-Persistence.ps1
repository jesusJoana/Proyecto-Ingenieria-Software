#Requires -Version 5.1
# Reinicia SOLO la instancia creada por este instalador. No recrea el marcador.
. "$PSScriptRoot\Common.ps1"
Assert-Guest
if (!(Test-Admin)) { throw 'Este paso requiere Windows PowerShell como administrador dentro de la VM.' }
$p=Get-SetupPaths; $null=Use-Tools; $null=Assert-ManagedService
Invoke-DatabaseHelper $p.Project 'persistence'
Restart-Service -Name $p.Service -ErrorAction Stop
(Get-Service $p.Service).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
Invoke-DatabaseHelper $p.Project 'persistence'
Write-Host 'OK: los tres marcadores persistieron tras reiniciar PostgreSQL.'

# Mostrar UNA clave local para introducirla en pgAdmin. No usar con transcripciones.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('development','test','e2e')][string]$Environment)
. "$PSScriptRoot\Common.ps1"
Assert-Guest
$keys=@{development='dev';test='test';e2e='e2e'}
$values=Get-Secrets
Write-Host 'Clave LOCAL para pgAdmin. No copiar a Git, capturas o mensajes:'
Write-Host (Unprotect-Value $values[$keys[$Environment]])

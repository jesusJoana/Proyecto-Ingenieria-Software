# Usar con punto: . .\scripts\provision\windows\Enter-Environment.ps1
# Solo cambia PATH y funciones de la terminal actual; no toca el PATH de Windows.
. "$PSScriptRoot\Common.ps1"
Assert-Guest
$null=Use-Tools
function global:code {
    $setup=Get-SetupPaths
    & (Join-Path $setup.Tools 'Code\bin\code.cmd') --user-data-dir (Join-Path $setup.Private 'code-user') --extensions-dir (Join-Path $setup.Private 'code-extensions') @args
}
Write-Host 'Terminal ReFind: Node, npm, Git y VS Code aislados seleccionados.'

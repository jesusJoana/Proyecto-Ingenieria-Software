# Pruebas de seguridad y configuracion. No instalan nada ni acceden a PostgreSQL.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\scripts\provision\windows\Common.ps1"
$script:Passed = 0
function Check($Name, [scriptblock]$Body) { & $Body; $script:Passed++; Write-Host "OK: $Name" }
function Expect-Failure([scriptblock]$Body) { $failed=$false; try { & $Body } catch { $failed=$true }; if (!$failed) { throw 'Se esperaba rechazo.' } }
Check 'Rechaza el anfitrion fisico antes de instalar' { Expect-Failure { Assert-GuestIdentity 'Dell' 'Latitude' 26200 $true } }
Check 'Acepta Windows 11 x64 en VirtualBox' { Assert-GuestIdentity 'Oracle Corporation' 'VirtualBox' 26200 $true }
Check 'Rechaza Windows antiguo o arquitectura distinta' { Expect-Failure { Assert-GuestIdentity 'Oracle' 'VirtualBox' 19045 $true }; Expect-Failure { Assert-GuestIdentity 'Oracle' 'VirtualBox' 26200 $false } }
Check 'Rechaza rutas que escapan de la carpeta reservada' { Expect-Failure { Assert-ChildPath 'C:\ReFind' 'C:\ReFind-otro\datos' }; Expect-Failure { Assert-ChildPath 'C:\ReFind' 'C:\ReFind\..\Windows' } }
Check 'Admite una ruta descendiente normal' { Assert-ChildPath 'C:\ReFind' 'C:\ReFind\datos\postgresql17' }
Check 'No cambia un archivo local preexistente distinto' {
    $dir=Join-Path $env:TEMP ('refind-unit-'+[guid]::NewGuid().ToString('N')); New-Item $dir -ItemType Directory | Out-Null
    $file=Join-Path $dir 'config.txt'
    try { Write-NewOrSame $file 'original'; Expect-Failure { Write-NewOrSame $file 'nuevo' }; if ([IO.File]::ReadAllText($file) -ne 'original') { throw 'Sobrescrito' }; Write-NewOrSame $file 'original' }
    finally { Remove-Item -LiteralPath $file -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $dir }
}
Check 'Genera secretos distintos y aptos para URL/optionfile' { $a=New-HexSecret; $b=New-HexSecret; if ($a -notmatch '^[0-9a-f]{64}$' -or $a -eq $b) { throw 'Secreto invalido' } }
Check 'Un codigo de salida fallido no se marca como exito' { Expect-Failure { Assert-ExitCode 7 'prueba' }; Assert-ExitCode 0 'prueba' }
Check 'Todos los scripts son sintacticamente validos en Windows PowerShell' {
    foreach ($file in (Get-ChildItem "$PSScriptRoot\..\..\scripts\provision\windows\*.ps1")) {
        $tokens=$null; $errors=$null
        $null=[Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors)
        if ($errors.Count) { throw ($file.Name+': '+($errors.Message -join '; ')) }
    }
}
Write-Host "$script:Passed pruebas correctas. Sin instalaciones ni cambios de servicios."

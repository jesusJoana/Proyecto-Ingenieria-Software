# Pruebas de seguridad y configuracion. No instalan nada ni acceden a PostgreSQL.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\scripts\provision\windows\Common.ps1"
$script:Passed = 0
function Check($Name, [scriptblock]$Body) { & $Body; $script:Passed++; Write-Host "OK: $Name" }
function Expect-Failure([scriptblock]$Body) { $failed=$false; try { & $Body } catch { $failed=$true }; if (!$failed) { throw 'Se esperaba rechazo.' } }
Check 'Resuelve package.json desde el script aunque la terminal este en C:\' {
    $scripts=(Resolve-Path "$PSScriptRoot\..\..\scripts\provision\windows").Path
    $expected=(Resolve-Path "$PSScriptRoot\..\..").Path
    Push-Location 'C:\'
    try {
        if ((Resolve-ProjectRoot $scripts '') -ne $expected) { throw 'Raiz incorrecta' }
        if ((Resolve-ProjectRoot $scripts $expected) -ne $expected) { throw 'Raiz explicita incorrecta' }
        Expect-Failure { Resolve-ProjectRoot $scripts 'C:\' }
    } finally { Pop-Location }
}
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
Check 'Version VS Code se obtiene del ejecutable sin depender de su package.json interno' {
    $codeVersion='1.139.0'
    function Get-Item($LiteralPath) { if ($LiteralPath -ne 'C:\ReFind\Tools\Code\Code.exe') { throw 'Ruta incorrecta' }; return @{VersionInfo=@{ProductVersion=$codeVersion}} }
    Assert-CodeVersion 'C:\ReFind\Tools\Code\Code.exe' '1.139.0'
    $codeVersion='1.139.0+build'; Assert-CodeVersion 'C:\ReFind\Tools\Code\Code.exe' '1.139.0'
    foreach ($codeVersion in @('1.139.01','1.138.0','','1.139.0-insider')) { Expect-Failure { Assert-CodeVersion 'C:\ReFind\Tools\Code\Code.exe' '1.139.0' } }
}
Check 'Rutas con espacios, corchetes y acentos no se interpretan como comodines' {
    $dir=Join-Path $env:TEMP ('refind-path-'+[guid]::NewGuid().ToString('N'))
    $project=Join-Path $dir ('ReFind [prueba] '+[char]0x00f1)
    $scripts=Join-Path $project 'scripts\provision\windows'
    New-Item -ItemType Directory -Path $scripts -Force | Out-Null
    try {
        Write-Utf8 (Join-Path $project 'package.json') '{}'
        Push-Location 'C:\'
        try { if ((Resolve-ProjectRoot $scripts '') -ne $project) { throw 'Ruta especial incorrecta' } }
        finally { Pop-Location }
    } finally { Assert-ChildPath $env:TEMP $dir; Remove-Item -LiteralPath $dir -Recurse -Force }
}
Check 'No selecciona un Node incompleto ni ejecutables heredados del PATH' {
    $dir=Join-Path $env:TEMP ('refind-tools-'+[guid]::NewGuid().ToString('N'))
    $nodeHome=Join-Path $dir 'Node\node-prueba'
    New-Item -ItemType Directory -Path $nodeHome -Force | Out-Null
    function Get-SetupPaths { @{Tools=$dir} }
    $previous=$env:PATH
    try {
        Expect-Failure { Use-Tools }
        if ($env:PATH -ne $previous) { throw 'PATH cambiado antes de validar' }
        foreach ($relative in @('Node\node-prueba\node.exe','Node\node-prueba\npm.cmd','Git\cmd\git.exe','Code\bin\code.cmd')) {
            $file=Join-Path $dir $relative
            New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($file)) -Force | Out-Null
            Write-Utf8 $file ''
        }
        if ((Use-Tools) -ne $nodeHome -or !$env:PATH.StartsWith($nodeHome+';')) { throw 'Herramientas incorrectas' }
    } finally { $env:PATH=$previous; Assert-ChildPath $env:TEMP $dir; Remove-Item -LiteralPath $dir -Recurse -Force }
}
Check 'Todos los scripts son sintacticamente validos en Windows PowerShell' {
    foreach ($file in (Get-ChildItem "$PSScriptRoot\..\..\scripts\provision\windows\*.ps1")) {
        $tokens=$null; $errors=$null
        $null=[Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors)
        if ($errors.Count) { throw ($file.Name+': '+($errors.Message -join '; ')) }
    }
}
Write-Host "$script:Passed pruebas correctas. Sin instalaciones ni cambios de servicios."

# Funciones compartidas. Importar este archivo no instala ni cambia el sistema.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Resolve-ProjectRoot([string]$ScriptDirectory,[string]$SourceRoot) {
    # Resolver despues de param: nunca depender de la carpeta de la terminal.
    if ([string]::IsNullOrWhiteSpace($SourceRoot)) { $SourceRoot=Join-Path $ScriptDirectory '..\..\..' }
    $resolved=(Resolve-Path -LiteralPath $SourceRoot -ErrorAction Stop).Path
    if (!(Test-Path -LiteralPath (Join-Path $resolved 'package.json') -PathType Leaf)) { throw "No hay package.json en $resolved. Indicar -SourceRoot con la raiz de ReFind." }
    return $resolved
}
function Assert-GuestIdentity($Manufacturer,$Model,[int]$Build,[bool]$X64) {
    if ($Model -ne 'VirtualBox' -or $Manufacturer -notmatch 'Oracle|innotek') { throw 'Solo se permite ejecutar dentro de una VM VirtualBox. No ejecutar en el anfitrion.' }
    if ($Build -lt 22000 -or !$X64) { throw 'Se necesita Windows 11 x64 en la VM.' }
}
function Assert-Guest {
    $pc=Get-CimInstance Win32_ComputerSystem; $os=Get-CimInstance Win32_OperatingSystem
    Assert-GuestIdentity $pc.Manufacturer $pc.Model ([int]$os.BuildNumber) ([Environment]::Is64BitOperatingSystem -and $env:PROCESSOR_ARCHITECTURE -eq 'AMD64')
}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Assert-ChildPath([string]$Parent,[string]$Child) {
    $base=[IO.Path]::GetFullPath($Parent).TrimEnd('\')+'\'; $path=[IO.Path]::GetFullPath($Child)
    if (!$path.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta fuera de la carpeta permitida.' }
}
function Assert-ExitCode([int]$Code,[string]$Label) { if ($Code -ne 0) { throw "$Label fallo (codigo $Code). Corregir y repetir; no se marca terminado." } }
function Assert-CodeVersion([string]$CodeExe,[string]$Expected) {
    # El contenido interno puede estar empaquetado; no depender de resources/app/package.json.
    $actual=(Get-Item -LiteralPath $CodeExe -ErrorAction Stop).VersionInfo.ProductVersion
    if (!$actual -or $actual -notmatch ('^'+[regex]::Escape($Expected)+'(?:$|[\s+])')) {
        throw "Version VS Code incorrecta: esperada $Expected; ejecutable $actual."
    }
}
function Invoke-Native([string]$File,[string[]]$Arguments) { & $File @Arguments; Assert-ExitCode $LASTEXITCODE ([IO.Path]::GetFileName($File)) }
function New-HexSecret {
    $bytes=New-Object byte[] 32; $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant() } finally { $rng.Dispose() }
}
function Write-Utf8([string]$Path,[string]$Text) { [IO.File]::WriteAllText($Path,$Text,(New-Object Text.UTF8Encoding($false))) }
function Write-NewOrSame([string]$Path,[string]$Text) {
    if (Test-Path -LiteralPath $Path) { if ([IO.File]::ReadAllText($Path) -ne $Text) { throw "Existe un archivo diferente: $Path. Se conserva; revisar antes de seguir." }; return }
    Write-Utf8 $Path $Text
}
function Protect-Directory([string]$Path) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    $acl=New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true,$false)
    $sids=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')
    foreach ($sid in $sids) { $identity=New-Object Security.Principal.SecurityIdentifier($sid); $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule) }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function Get-SetupPaths {
    return @{ Root='C:\ReFind'; Tools='C:\ReFind\Tools'; Pg='C:\ReFind\PostgreSQL\17'; Data='C:\ReFind\datos\postgresql17'; Service='postgresql-refind-17'; Private=(Join-Path $env:LOCALAPPDATA 'ReFindSetup'); Project='C:\ReFind\Proyecto' }
}
function Get-Secrets([switch]$Create) {
    $private=(Get-SetupPaths).Private; $file=Join-Path $private 'secrets.xml'
    if (Test-Path -LiteralPath $file) { return Import-Clixml -LiteralPath $file }
    if (!$Create) { throw 'Faltan secretos locales. Ejecutar primero Install-Machine.ps1 con la misma cuenta Windows.' }
    Protect-Directory $private
    $secrets=@{}
    foreach ($key in @('postgres','service','dev','test','e2e','session-development','session-test','session-e2e')) { $secrets[$key]=ConvertTo-SecureString (New-HexSecret) -AsPlainText -Force }
    # La cuenta Windows necesita cumplir tambien las reglas de complejidad.
    $secrets.service=ConvertTo-SecureString ('Rf!1'+(New-HexSecret)) -AsPlainText -Force
    $secrets | Export-Clixml -LiteralPath $file
    return $secrets
}
function Unprotect-Value([Security.SecureString]$Value) { return (New-Object Net.NetworkCredential('', $Value)).Password }
function Get-PlainSecrets { $encrypted=Get-Secrets; $plain=@{}; foreach ($key in $encrypted.Keys) { $plain[$key]=Unprotect-Value $encrypted[$key] }; return $plain }
function Get-Download([string]$Url,[string]$File) {
    if (Test-Path -LiteralPath $File) { return }
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    Write-Host ('Descargando '+[IO.Path]::GetFileName($File))
    $part=$File+'.part'
    try { Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $part; Move-Item -LiteralPath $part -Destination $File }
    catch { if (Test-Path -LiteralPath $part) { Remove-Item -LiteralPath $part }; throw "No se pudo descargar $Url. No se sustituye por otra version. Ver manual, descargas." }
}
function Assert-Signature([string]$Path,[string]$Publisher) {
    $sig=Get-AuthenticodeSignature -LiteralPath $Path
    if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch $Publisher) { throw "Firma no valida o editor inesperado: $Path" }
}
function Install-Exe([string]$Path,[string[]]$Arguments) {
    # Start-Process recibe solo rutas controladas, sin claves en los argumentos.
    $process=Start-Process -FilePath $Path -ArgumentList $Arguments -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -eq 3010) { throw 'Instalacion requiere reiniciar Windows. Reiniciar y ejecutar el mismo paso.' }
    Assert-ExitCode $process.ExitCode ([IO.Path]::GetFileName($Path))
}
function Use-Tools {
    $p=Get-SetupPaths
    $nodeFolders=@(Get-ChildItem -LiteralPath (Join-Path $p.Tools 'Node') -Directory -ErrorAction Stop)
    if ($nodeFolders.Count -ne 1) { throw 'Instalacion Node ambigua o incompleta.' }
    foreach ($file in @((Join-Path $nodeFolders[0].FullName 'node.exe'),(Join-Path $nodeFolders[0].FullName 'npm.cmd'),(Join-Path $p.Tools 'Git\cmd\git.exe'),(Join-Path $p.Tools 'Code\bin\code.cmd'))) {
        if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Falta herramienta: $file. Completar Install-Machine.ps1 antes de continuar." }
    }
    $env:PATH=$nodeFolders[0].FullName+';'+(Join-Path $p.Tools 'Git\cmd')+';'+(Join-Path $p.Tools 'Code\bin')+';'+$env:PATH
    return $nodeFolders[0].FullName
}
function Assert-ManagedService {
    $p=Get-SetupPaths
    $service=Get-CimInstance Win32_Service -Filter "Name='postgresql-refind-17'"
    if (!$service -or !$service.PathName.Contains($p.Pg+'\bin\pg_ctl.exe') -or !$service.PathName.Contains($p.Data)) { throw 'Servicio inexistente o ruta ajena. No se modifica.' }
    return $service
}
function Invoke-DatabaseHelper([string]$Project,[string]$Mode) {
    $payload=@{ mode=$Mode; secrets=(Get-PlainSecrets); dataDirectory=(Get-SetupPaths).Data }
    # JSON solo por entrada estandar, nunca como argumentos ni fichero en el repo.
    $payload | ConvertTo-Json -Depth 4 -Compress | & node (Join-Path $PSScriptRoot 'database.mjs') $Project
    Assert-ExitCode $LASTEXITCODE 'Configuracion/comprobacion de bases'
}

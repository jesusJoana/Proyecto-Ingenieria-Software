#Requires -Version 5.1
<# Fase 1, solo en VM VirtualBox y elevada. Instala herramientas aisladas y una
   instancia PostgreSQL propia. Repetir conserva claves, bases y herramientas.
   No ejecuta npm ci ni las pruebas de aplicacion como administrador. #>
[CmdletBinding()]
param([string]$SourceRoot)
. "$PSScriptRoot\Common.ps1"
$SourceRoot=Resolve-ProjectRoot $PSScriptRoot $SourceRoot
Assert-Guest
if (!(Test-Admin)) { throw 'Abrir Windows PowerShell COMO ADMINISTRADOR dentro de la VM.' }
$p=Get-SetupPaths
$versions=Get-Content -LiteralPath "$PSScriptRoot\versions.json" -Raw | ConvertFrom-Json
$package=Get-Content -LiteralPath (Join-Path $SourceRoot 'package.json') -Raw | ConvertFrom-Json
$nodeVersion=$package.engines.node
if ($nodeVersion -notmatch '^\d+\.\d+\.\d+$' -or $package.packageManager -notmatch '^npm@\d+\.\d+\.\d+$') { throw 'Versiones Node/npm no fijadas.' }
$receipt=Join-Path $p.Private 'machine.json'
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if (!(Test-Path -LiteralPath $receipt)) {
    # Comprobar conflictos ANTES de crear nada o ejecutar un instalador.
    foreach ($path in @($p.Tools,$p.Pg,$p.Data,$p.Project)) { if (Test-Path -LiteralPath $path) { throw "Ruta ocupada sin recibo de este instalador: $path. Usar VM limpia." } }
    if (Get-Service -Name $p.Service -ErrorAction SilentlyContinue) { throw 'Servicio reservado ya existente sin recibo.' }
    if (Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue) { throw 'La VM ya tiene PostgreSQL. Usar la VM limpia para evitar que el instalador actualice otra instancia.' }
    if (Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue) { throw 'Puerto 5433 ocupado. No se detiene otro servicio.' }
    if (Get-CimInstance Win32_UserAccount -Filter "LocalAccount=True AND Name='refind_pg_service'") { throw 'Cuenta de servicio reservada ya existente.' }
    Protect-Directory $p.Private
    @{ Owner=$sid; Computer=$env:COMPUTERNAME; Schema=1 } | ConvertTo-Json | Set-Content -LiteralPath $receipt -Encoding UTF8
} else {
    $owned=Get-Content -LiteralPath $receipt -Raw | ConvertFrom-Json
    if ($owned.Owner -ne $sid -or $owned.Computer -ne $env:COMPUTERNAME) { throw 'Recibo pertenece a otra cuenta o equipo.' }
}
$null=Get-Secrets -Create
$cache=Join-Path $p.Private 'downloads'; New-Item -ItemType Directory -Force -Path $cache,$p.Tools | Out-Null
Write-Host '1/4 Node aislado, con SHA256 oficial'
$nodeParent=Join-Path $p.Tools 'Node'; $nodeHome=Join-Path $nodeParent "node-v$nodeVersion-win-x64"
if (!(Test-Path -LiteralPath (Join-Path $nodeHome 'node.exe'))) {
    $zip=Join-Path $cache "node-v$nodeVersion-win-x64.zip"; $sums=Join-Path $cache "node-$nodeVersion-SHASUMS256.txt"
    Get-Download "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip" $zip
    Get-Download "https://nodejs.org/dist/v$nodeVersion/SHASUMS256.txt" $sums
    $line=@(Get-Content -LiteralPath $sums | Where-Object { $_ -match ('\s'+[regex]::Escape([IO.Path]::GetFileName($zip))+'$') })
    if ($line.Count -ne 1 -or (Get-FileHash $zip -Algorithm SHA256).Hash -ine ($line[0] -split '\s+')[0]) { throw 'SHA256 Node incorrecto. Retirar solo la descarga indicada de la cache y repetir.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $nodeParent -Force
}
$actual=& (Join-Path $nodeHome 'node.exe') --version
if ($actual -ne "v$nodeVersion") { throw 'Node aislado tiene otra version.' }
$env:PATH=$nodeHome+';'+$env:PATH
$npmVersion=$package.packageManager.Substring(4)
$npmCli=Join-Path $nodeHome 'node_modules\npm\bin\npm-cli.js'
if ((& (Join-Path $nodeHome 'node.exe') $npmCli --version) -ne $npmVersion) {
    Invoke-Native (Join-Path $nodeHome 'node.exe') @($npmCli,'install','--global',('npm@'+$npmVersion),'--prefix',$nodeHome,'--ignore-scripts','--no-audit','--no-fund')
}
if ((& (Join-Path $nodeHome 'node.exe') $npmCli --version) -ne $npmVersion) { throw 'No se pudo fijar npm.' }
Write-Host '2/4 Git CLI aislado (MinGit), con SHA256 del release oficial'
$gitHome=Join-Path $p.Tools 'Git'
if (!(Test-Path -LiteralPath (Join-Path $gitHome 'cmd\git.exe'))) {
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    $tag=$versions.gitRelease; $short=$tag.Replace('.windows.','.')
    $assetName="MinGit-$short-64-bit.zip"
    $release=Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/tags/v$tag" -Headers @{'User-Agent'='ReFind-Setup'}
    $assets=@($release.assets | Where-Object name -eq $assetName)
    if ($assets.Count -ne 1 -or !$assets[0].digest -or $assets[0].digest -notmatch '^sha256:[a-fA-F0-9]{64}$') { throw 'Release MinGit sin el archivo o SHA256 esperado; no se cambia version automaticamente.' }
    $zip=Join-Path $cache $assetName; Get-Download $assets[0].browser_download_url $zip
    if ((Get-FileHash $zip -Algorithm SHA256).Hash -ine $assets[0].digest.Substring(7)) { throw 'SHA256 Git incorrecto.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $gitHome -Force
}
$actual=& (Join-Path $gitHome 'cmd\git.exe') --version
if ($actual -ne ('git version '+$versions.git)) { throw 'Version Git incorrecta.' }
Write-Host '3/4 VS Code ZIP aislado, firma Microsoft'
$codeHome=Join-Path $p.Tools 'Code'
if (!(Test-Path -LiteralPath (Join-Path $codeHome 'Code.exe'))) {
    $zip=Join-Path $cache ('vscode-'+$versions.vscode+'.zip')
    Get-Download "https://update.code.visualstudio.com/$($versions.vscode)/win32-x64-archive/stable" $zip
    Expand-Archive -LiteralPath $zip -DestinationPath $codeHome -Force
}
Assert-Signature (Join-Path $codeHome 'Code.exe') 'Microsoft Corporation'
Assert-CodeVersion (Join-Path $codeHome 'Code.exe') $versions.vscode
Write-Host '4/4 PostgreSQL propio, sin Stack Builder'
$service=Get-CimInstance Win32_Service -Filter "Name='postgresql-refind-17'"
if (!$service) {
    if (Test-Path -LiteralPath (Join-Path $p.Data 'PG_VERSION')) { throw 'Hay datos pero no servicio. No se reinstala encima. Revisar fallo anterior o restaurar snapshot limpio.' }
    $installer=Join-Path $cache $versions.postgresInstaller
    Get-Download ('https://get.enterprisedb.com/postgresql/'+$versions.postgresInstaller) $installer
    Assert-Signature $installer 'EnterpriseDB'
    $secrets=Get-PlainSecrets; $optionFile=Join-Path $p.Private 'postgres-options.txt'
    $trace=Join-Path $p.Private 'postgres-install.log'
    try {
        # Las claves no viajan en la linea de comandos. Archivo privado eliminado al salir.
        $options=@('mode=unattended','unattendedmodeui=none',('prefix='+$p.Pg),('datadir='+$p.Data),'servicename=postgresql-refind-17','serverport=5433','superaccount=postgres',('superpassword='+$secrets.postgres),'serviceaccount=refind_pg_service',('servicepassword='+$secrets.service),'enable-components=server,commandlinetools,pgAdmin','disable-components=stackbuilder','enable_acledit=1','debuglevel=0',('debugtrace='+$trace))
        Write-Utf8 $optionFile ($options -join "`n")
        Install-Exe $installer @('--optionfile',('"'+$optionFile+'"'))
    } finally { if (Test-Path -LiteralPath $optionFile) { Remove-Item -LiteralPath $optionFile }; $secrets=$null }
}
$null=Assert-ManagedService
Set-Service -Name $p.Service -StartupType Automatic
$psql=Join-Path $p.Pg 'bin\psql.exe'
if ((& $psql --version) -ne ('psql (PostgreSQL) '+$versions.postgres)) { throw 'Version PostgreSQL incorrecta.' }
# Solo estos archivos de la instancia creada por este proceso. Copia de respaldo una vez.
$conf=Join-Path $p.Data 'postgresql.conf'; $hba=Join-Path $p.Data 'pg_hba.conf'
foreach ($f in @($conf,$hba)) { if (!(Test-Path -LiteralPath ($f+'.before-refind'))) { Copy-Item -LiteralPath $f -Destination ($f+'.before-refind') } }
$text=[IO.File]::ReadAllText($conf)
$text=[regex]::Replace($text,'(?m)^\s*(listen_addresses|port|cluster_name|password_encryption)\s*=.*$','')
$text=$text.TrimEnd()+"`r`nlisten_addresses = '127.0.0.1'`r`nport = 5433`r`ncluster_name = 'refind-local'`r`npassword_encryption = 'scram-sha-256'`r`n"
Write-Utf8 $conf $text
Write-Utf8 $hba "# ReFind: instancia exclusiva, solo TCP IPv4 local con SCRAM.`r`nhost all all 127.0.0.1/32 scram-sha-256`r`n"
Restart-Service -Name $p.Service -ErrorAction Stop
(Get-Service $p.Service).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
# No asumir la version de pgAdmin solo por la version del instalador PostgreSQL.
$pgConfig=Join-Path $p.Pg 'pgAdmin 4\web\version.py'
if (!(Test-Path -LiteralPath $pgConfig)) { throw 'No se encuentra pgAdmin incluido. Revisar instalacion.' }
$pgText=[IO.File]::ReadAllText($pgConfig)
if ($pgText -notmatch '(?m)^APP_RELEASE\s*=\s*9\s*$' -or $pgText -notmatch '(?m)^APP_REVISION\s*=\s*17\s*$') { throw 'pgAdmin no declara 9.17 en version.py. Comprobar Help/About; no instalar otra version por rutina.' }
Protect-Directory $p.Project
Write-Host 'OK: fase de administrador terminada. Cerrar esta terminal y seguir Prepare-Project.ps1 COMO USUARIO NORMAL, con la misma cuenta.'

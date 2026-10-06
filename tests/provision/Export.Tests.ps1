# Comprueba el paquete real, incluidos archivos alojados en OneDrive.
# Solo lee el proyecto y crea/elimina un ZIP temporal; no instala ni toca servicios.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=Join-Path $env:TEMP ('refind-export-test-'+[guid]::NewGuid().ToString('N')+'.zip')
try {
    Push-Location -LiteralPath $env:TEMP
    try {
        # Ejecutar en el mismo proceso conserva la diferencia entre cwd .NET y PowerShell.
        & "$PSScriptRoot\..\..\scripts\provision\windows\Export-Bundle.ps1" -Destination ([IO.Path]::GetFileName($zip))
    } finally { Pop-Location }
    $archive=[IO.Compression.ZipFile]::OpenRead($zip)
    try {
        $entries=@{}
        foreach ($entry in $archive.Entries) { $entries[$entry.FullName.Replace('\','/')]=$entry }
        # Debe transportar el historial, la configuracion publica y los scripts nuevos.
        foreach ($required in @('repository.bundle','bundle.json','workspace/.env.example','workspace/.gitignore','workspace/package-lock.json','workspace/scripts/provision/windows/Install-Machine.ps1')) {
            if (!$entries.ContainsKey($required)) { throw "Falta $required" }
        }
        # Nunca transportar las credenciales locales en el arbol de trabajo.
        foreach ($name in $entries.Keys) {
            if ($name -match '(^|/)\.env($|\.(?!example$))' -or $name -match '(^|/)node_modules/') { throw 'Incluye configuracion privada o dependencias.' }
        }
        $reader=New-Object IO.StreamReader($entries['bundle.json'].Open())
        try { $manifest=$reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
        # Detecta tambien archivos ocultos omitidos silenciosamente por el compresor.
        foreach ($relative in $manifest.Files) { if (!$entries.ContainsKey('workspace/'+$relative)) { throw "Archivo anunciado pero ausente: $relative" } }
        Write-Host 'OK: exportacion completa, historial y scripts presentes, sin .env privados ni node_modules.'
    } finally { $archive.Dispose() }
} finally { if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip } }

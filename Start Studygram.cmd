@echo off
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -NonInteractive -Command ^
  "$ErrorActionPreference = 'Stop'; $bundle = $null; try {" ^
  "if (-not $env:NODE_EXTRA_CA_CERTS) {" ^
  "$roots = foreach ($location in 'CurrentUser','LocalMachine') { $store = [Security.Cryptography.X509Certificates.X509Store]::new('Root', $location); try { $store.Open('ReadOnly'); $store.Certificates } finally { $store.Close() } };" ^
  "if ($roots) {" ^
  "$bundle = Join-Path ([IO.Path]::GetTempPath()) ('studygram-trust-' + [guid]::NewGuid() + '.pem');" ^
  "$roots | ForEach-Object { '-----BEGIN CERTIFICATE-----'; [Convert]::ToBase64String($_.RawData, [Base64FormattingOptions]::InsertLineBreaks); '-----END CERTIFICATE-----' } | Set-Content -LiteralPath $bundle -Encoding ascii;" ^
  "$env:NODE_EXTRA_CA_CERTS = $bundle" ^
  "} }; & node server/index.js; exit $LASTEXITCODE" ^
  "} finally { if ($bundle) { Remove-Item -LiteralPath $bundle -ErrorAction SilentlyContinue } }"
if errorlevel 1 pause

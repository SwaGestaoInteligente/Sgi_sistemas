param(
  [switch]$SkipBackend,
  [switch]$SkipFrontend,
  [switch]$RunSmoke
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..").Path
$reportPath = Join-Path $root "docs\release-check-latest.md"
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$pushCount = 0
$reportLines = @(
  "# Release Check",
  "",
  "Data: $date",
  ""
)

function Add-Result {
  param(
    [string]$Label,
    [bool]$Success,
    [string]$Detail
  )

  $status = if ($Success) { "OK" } else { "FALHA" }
  $script:reportLines += "- ${Label}: $status"
  if ($Detail) {
    $script:reportLines += "  - $Detail"
  }
}

try {
  if (-not $SkipBackend) {
    Push-Location (Join-Path $root "src\Sgi.Api")
    $pushCount++
    dotnet build Sgi.Api.csproj -c Release
    Pop-Location
    $pushCount--
    Add-Result -Label "Build backend" -Success $true -Detail "dotnet build src/Sgi.Api/Sgi.Api.csproj -c Release"
  } else {
    Add-Result -Label "Build backend" -Success $true -Detail "Ignorado por parametro -SkipBackend"
  }

  if (-not $SkipFrontend) {
    Push-Location (Join-Path $root "sgi-web")
    $pushCount++
    npm run build
    Pop-Location
    $pushCount--
    Add-Result -Label "Build frontend" -Success $true -Detail "npm run build (sgi-web)"
  } else {
    Add-Result -Label "Build frontend" -Success $true -Detail "Ignorado por parametro -SkipFrontend"
  }

  if ($RunSmoke) {
    $smokeScript = Join-Path $root "scripts\test-smoke.ps1"
    if (Test-Path $smokeScript) {
      & $smokeScript
      Add-Result -Label "Smoke test" -Success $true -Detail "scripts/test-smoke.ps1"
    } else {
      Add-Result -Label "Smoke test" -Success $false -Detail "scripts/test-smoke.ps1 nao encontrado"
      throw "Smoke test script nao encontrado."
    }
  } else {
    Add-Result -Label "Smoke test" -Success $true -Detail "Nao executado (use -RunSmoke para habilitar)"
  }

  $reportLines += ""
  $reportLines += "Status geral: OK"
  Set-Content -Path $reportPath -Value $reportLines -Encoding UTF8
  Write-Host "Release check finalizado com sucesso. Relatorio: $reportPath"
}
catch {
  $errorMessage = $_.Exception.Message
  Add-Result -Label "Execucao" -Success $false -Detail $errorMessage
  $reportLines += ""
  $reportLines += "Status geral: FALHA"
  Set-Content -Path $reportPath -Value $reportLines -Encoding UTF8
  Write-Error "Release check falhou: $errorMessage"
  throw
}
finally {
  while ($pushCount -gt 0) {
    try {
      Pop-Location
      $pushCount--
    } catch {
      break
    }
  }
}

param(
  [string]$ApiBase = "http://localhost:7000/api",
  [string]$WebBase = "http://localhost:5173",
  [string]$AdminEmail = "admin@teste.com",
  [string]$AdminSenha = "Admin@123",
  [string]$OrgId = "",
  [switch]$SeedDemo
)

$ErrorActionPreference = "Stop"

$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
$results = New-Object System.Collections.Generic.List[object]

function Add-Result([string]$name, [bool]$ok, [string]$detail) {
  $status = if ($ok) { "PASS" } else { "FAIL" }
  $results.Add([pscustomobject]@{
    Test = $name
    Status = $status
    Detail = $detail
  }) | Out-Null
}

function Build-Report {
  $pass = ($results | Where-Object { $_.Status -eq "PASS" }).Count
  $fail = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
  [pscustomobject]@{
    Timestamp = $timestamp
    Pass = $pass
    Fail = $fail
    Tests = $results
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$reportMd = Join-Path $root "docs/test-report-latest.md"
$reportJson = Join-Path $root "docs/test-report-latest.json"

$apiRoot = if ($ApiBase.EndsWith("/api")) { $ApiBase.Substring(0, $ApiBase.Length - 4) } else { $ApiBase }
$swaggerUrl = "$apiRoot/swagger/index.html"

try {
  $status = (Invoke-WebRequest -Uri $swaggerUrl -Method Get).StatusCode
  Add-Result "API up (Swagger)" ($status -eq 200) "Status $status"
} catch {
  Add-Result "API up (Swagger)" $false $_.Exception.Message
}

try {
  $status = (Invoke-WebRequest -Uri $WebBase -Method Get).StatusCode
  Add-Result "Web up" ($status -eq 200) "Status $status"
} catch {
  Add-Result "Web up" $false $_.Exception.Message
}

$token = $null
try {
  $loginBody = @{ email = $AdminEmail; senha = $AdminSenha } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/login" -Body $loginBody -ContentType "application/json"
  $token = $login.accessToken
  Add-Result "Login admin" ($null -ne $token) "Token recebido"
} catch {
  Add-Result "Login admin" $false $_.Exception.Message
}

if (-not $token) {
  $report = Build-Report
  $json = $report | ConvertTo-Json -Depth 5
  $json | Set-Content -Path $reportJson -Encoding UTF8
  $md = New-Object System.Collections.Generic.List[string]
  $md.Add("# Test Report") | Out-Null
  $md.Add("") | Out-Null
  $md.Add("- Timestamp: $timestamp") | Out-Null
  $md.Add("- Pass: $($report.Pass)") | Out-Null
  $md.Add("- Fail: $($report.Fail)") | Out-Null
  $md.Add("") | Out-Null
  $md.Add("| Test | Status | Detail |") | Out-Null
  $md.Add("| --- | --- | --- |") | Out-Null
  foreach ($item in $report.Tests) {
    $md.Add("| $($item.Test) | $($item.Status) | $($item.Detail) |") | Out-Null
  }
  $md | Set-Content -Path $reportMd -Encoding UTF8
  return
}

$headers = @{ Authorization = "Bearer $token" }

try {
  $orgs = Invoke-RestMethod -Method Get -Uri "$ApiBase/Organizacoes" -Headers $headers
  if (-not $OrgId -and $orgs.Count -gt 0) {
    $OrgId = $orgs[0].id
  }
  Add-Result "Listar organizacoes" ($orgs.Count -gt 0) ("Total " + $orgs.Count)
} catch {
  Add-Result "Listar organizacoes" $false $_.Exception.Message
}

if (-not $OrgId -and $SeedDemo) {
  try {
    $seed = Invoke-RestMethod -Method Post -Uri "$ApiBase/dev/seed-admin"
    $OrgId = $seed.organizacaoId
    Add-Result "Seed admin (dev)" ($null -ne $OrgId) ("Org " + $OrgId)
  } catch {
    Add-Result "Seed admin (dev)" $false $_.Exception.Message
  }
}

if (-not $OrgId) {
  Add-Result "Organizacao alvo" $false "Nenhuma organizacao encontrada. Use -OrgId ou -SeedDemo."
  $report = Build-Report
  $json = $report | ConvertTo-Json -Depth 5
  $json | Set-Content -Path $reportJson -Encoding UTF8
  $md = New-Object System.Collections.Generic.List[string]
  $md.Add("# Test Report") | Out-Null
  $md.Add("") | Out-Null
  $md.Add("- Timestamp: $timestamp") | Out-Null
  $md.Add("- Pass: $($report.Pass)") | Out-Null
  $md.Add("- Fail: $($report.Fail)") | Out-Null
  $md.Add("") | Out-Null
  $md.Add("| Test | Status | Detail |") | Out-Null
  $md.Add("| --- | --- | --- |") | Out-Null
  foreach ($item in $report.Tests) {
    $md.Add("| $($item.Test) | $($item.Status) | $($item.Detail) |") | Out-Null
  }
  $md | Set-Content -Path $reportMd -Encoding UTF8
  return
}

$suffix = (Get-Date).ToString("yyyyMMddHHmmss")

$blocoId = $null
$unidadeId = $null
$pessoaId = $null
$vinculoId = $null

try {
  $blocoBody = @{
    organizacaoId = $OrgId
    tipo = "Bloco"
    codigoInterno = "T$suffix"
    nome = "Bloco Teste $suffix"
  } | ConvertTo-Json
  $bloco = Invoke-RestMethod -Method Post -Uri "$ApiBase/unidades" -Headers $headers -Body $blocoBody -ContentType "application/json"
  $blocoId = $bloco.id
  Add-Result "Criar bloco" ($null -ne $blocoId) ("Id " + $blocoId)
} catch {
  Add-Result "Criar bloco" $false $_.Exception.Message
}

try {
  $unidadeBody = @{
    organizacaoId = $OrgId
    tipo = "Apartamento"
    codigoInterno = "U$suffix"
    nome = "Apto Teste $suffix"
    parentId = $blocoId
  } | ConvertTo-Json
  $unidade = Invoke-RestMethod -Method Post -Uri "$ApiBase/unidades" -Headers $headers -Body $unidadeBody -ContentType "application/json"
  $unidadeId = $unidade.id
  Add-Result "Criar unidade" ($null -ne $unidadeId) ("Id " + $unidadeId)
} catch {
  Add-Result "Criar unidade" $false $_.Exception.Message
}

try {
  $pessoaBody = @{
    organizacaoId = $OrgId
    nome = "Pessoa Teste $suffix"
    tipo = "fisica"
    email = "teste+$suffix@demo.com"
    telefone = "(11) 90000-0000"
    papel = "morador"
  } | ConvertTo-Json
  $pessoa = Invoke-RestMethod -Method Post -Uri "$ApiBase/pessoas" -Headers $headers -Body $pessoaBody -ContentType "application/json"
  $pessoaId = $pessoa.id
  Add-Result "Criar pessoa" ($null -ne $pessoaId) ("Id " + $pessoaId)
} catch {
  Add-Result "Criar pessoa" $false $_.Exception.Message
}

try {
  $vinculoBody = @{
    organizacaoId = $OrgId
    pessoaId = $pessoaId
    unidadeOrganizacionalId = $unidadeId
    papel = "morador"
  } | ConvertTo-Json
  $vinculo = Invoke-RestMethod -Method Post -Uri "$ApiBase/vinculos" -Headers $headers -Body $vinculoBody -ContentType "application/json"
  $vinculoId = $vinculo.id
  Add-Result "Criar vinculo" ($null -ne $vinculoId) ("Id " + $vinculoId)
} catch {
  Add-Result "Criar vinculo" $false $_.Exception.Message
}

try {
  if ($pessoaId) {
    $lista = Invoke-RestMethod -Method Get -Uri "$ApiBase/vinculos?organizacaoId=$OrgId&pessoaId=$pessoaId" -Headers $headers
    if ($lista.Count -gt 0) {
      $match = $lista | Where-Object { $_.unidadeOrganizacionalId -eq $unidadeId } | Select-Object -First 1
      if (-not $match) {
        $match = $lista[0]
      }
      $vinculoId = $match.id
      Add-Result "Listar vinculos por pessoa" $true ("Qtd " + $lista.Count)
    } else {
      Add-Result "Listar vinculos por pessoa" $false "Nenhum vinculo"
    }
  } else {
    Add-Result "Listar vinculos por pessoa" $false "Sem pessoa"
  }
} catch {
  Add-Result "Listar vinculos por pessoa" $false $_.Exception.Message
}

try {
  if ($vinculoId) {
    Invoke-RestMethod -Method Delete -Uri "$ApiBase/vinculos/$vinculoId?organizacaoId=$OrgId" -Headers $headers
    Add-Result "Cleanup: remover vinculo" $true "OK"
  } else {
    Add-Result "Cleanup: remover vinculo" $false "Sem vinculo"
  }
} catch {
  Add-Result "Cleanup: remover vinculo" $false $_.Exception.Message
}

try {
  if ($pessoaId) {
    Invoke-RestMethod -Method Delete -Uri "$ApiBase/pessoas/$pessoaId?organizacaoId=$OrgId" -Headers $headers
    Add-Result "Cleanup: remover pessoa" $true "OK"
  } else {
    Add-Result "Cleanup: remover pessoa" $false "Sem pessoa"
  }
} catch {
  Add-Result "Cleanup: remover pessoa" $false $_.Exception.Message
}

try {
  if ($unidadeId) {
    Invoke-RestMethod -Method Patch -Uri "$ApiBase/unidades/$unidadeId/arquivar" -Headers $headers
    Add-Result "Cleanup: arquivar unidade" $true "OK"
  } else {
    Add-Result "Cleanup: arquivar unidade" $false "Sem unidade"
  }
} catch {
  Add-Result "Cleanup: arquivar unidade" $false $_.Exception.Message
}

try {
  if ($blocoId) {
    Invoke-RestMethod -Method Patch -Uri "$ApiBase/unidades/$blocoId/arquivar" -Headers $headers
    Add-Result "Cleanup: arquivar bloco" $true "OK"
  } else {
    Add-Result "Cleanup: arquivar bloco" $false "Sem bloco"
  }
} catch {
  Add-Result "Cleanup: arquivar bloco" $false $_.Exception.Message
}

$report = Build-Report
$json = $report | ConvertTo-Json -Depth 5
$json | Set-Content -Path $reportJson -Encoding UTF8

$md = New-Object System.Collections.Generic.List[string]
$md.Add("# Test Report") | Out-Null
$md.Add("") | Out-Null
$md.Add("- Timestamp: $timestamp") | Out-Null
$md.Add("- Pass: $($report.Pass)") | Out-Null
$md.Add("- Fail: $($report.Fail)") | Out-Null
$md.Add("") | Out-Null
$md.Add("| Test | Status | Detail |") | Out-Null
$md.Add("| --- | --- | --- |") | Out-Null
foreach ($item in $report.Tests) {
  $md.Add("| $($item.Test) | $($item.Status) | $($item.Detail) |") | Out-Null
}
$md | Set-Content -Path $reportMd -Encoding UTF8

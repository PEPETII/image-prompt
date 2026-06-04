param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"
$baseUrl = "https://ark.cn-beijing.volces.com/api/v3"
$chatUrl = "$baseUrl/chat/completions"
$headers = @{
  "Authorization" = "Bearer $ApiKey"
  "Content-Type"  = "application/json"
}

$seedModels = @(
  "doubao-seed-2-0-pro-260215",
  "doubao-seed-2-0-lite-260428",
  "doubao-seed-2-0-mini-260215",
  "doubao-seed-2-0-code-preview-260215",
  "doubao-seed-1-8-251228",
  "doubao-seed-1-6-251015",
  "doubao-seed-1-6-flash-250828",
  "doubao-seed-1-6-thinking-250715"
)

function Test-ChatModel {
  param([string]$ModelId)
  $body = @{
    model      = $ModelId
    messages   = @(@{ role = "user"; content = "hi" })
    max_tokens = 5
  } | ConvertTo-Json -Depth 5 -Compress
  try {
    $null = Invoke-RestMethod -Uri $chatUrl -Method Post -Headers $headers -Body $body -TimeoutSec $TimeoutSec
    return @{ ok = $true; detail = "200 OK" }
  }
  catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails.Message) {
      try {
        $err = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($err.error.message) { $msg = $err.error.message }
        elseif ($err.error.code) { $msg = $err.error.code }
      }
      catch { $msg = $_.ErrorDetails.Message }
    }
    return @{ ok = $false; detail = $msg }
  }
}

Write-Host "=== List models (vision-related, non-Shutdown) ===" -ForegroundColor Cyan
$modelsResp = Invoke-RestMethod -Uri "$baseUrl/models" -Headers @{ Authorization = "Bearer $ApiKey" } -TimeoutSec $TimeoutSec
$all = @($modelsResp.data)
$active = $all | Where-Object { $_.status -ne "Shutdown" }
$vision = $active | Where-Object {
  $id = ($_.id + " " + $_.name) -join " "
  $id -match "seed|vision|vl|multimodal" -or
  ($_.modalities -and $_.modalities.input_modalities -contains "image")
}
Write-Host "Total models: $($all.Count), active: $($active.Count), vision-ish: $($vision.Count)"
foreach ($m in ($vision | Select-Object -First 30)) {
  Write-Host ("  {0,-45} status={1}" -f $m.id, $m.status)
}

Write-Host "`n=== Test UI datalist (8 Seed names) ===" -ForegroundColor Cyan
foreach ($m in $seedModels) {
  $r = Test-ChatModel -ModelId $m
  $mark = if ($r.ok) { "PASS" } else { "FAIL" }
  $color = if ($r.ok) { "Green" } else { "Red" }
  Write-Host ("[{0}] {1}" -f $mark, $m) -ForegroundColor $color
  if (-not $r.ok) { Write-Host ("       {0}" -f $r.detail) }
}

Write-Host "`n=== Test active API model ids (first 15 with image input) ===" -ForegroundColor Cyan
$withImage = $active | Where-Object {
  $_.modalities -and $_.modalities.input_modalities -contains "image"
} | Select-Object -First 15
if (-not $withImage -or $withImage.Count -eq 0) {
  $withImage = ($active | Where-Object { $_.id -match "seed|vision" } | Select-Object -First 10)
}
foreach ($m in $withImage) {
  $r = Test-ChatModel -ModelId $m.id
  $mark = if ($r.ok) { "PASS" } else { "FAIL" }
  $color = if ($r.ok) { "Green" } else { "Yellow" }
  Write-Host ("[{0}] {1}" -f $mark, $m.id) -ForegroundColor $color
  if (-not $r.ok) { Write-Host ("       {0}" -f $r.detail.Substring(0, [Math]::Min(120, $r.detail.Length))) }
}

Write-Host "`nDone." -ForegroundColor Cyan

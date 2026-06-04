param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,
  [string]$Model = "ark-8c8d587f-e8d3-4055-8e48-9bfa356ca6f3-aba18",
  [string]$BaseUrl = "https://ark.cn-beijing.volces.com/api/v3",
  [string]$Prompt = "一只橘猫坐在窗台上，写实摄影，柔和日光",
  [int]$TimeoutSec = 120
)

$ErrorActionPreference = "Stop"
$imageUrl = "$BaseUrl/images/generations"
$headers = @{
  "Authorization" = "Bearer $ApiKey"
  "Content-Type"  = "application/json"
}

function Invoke-ImageGen {
  param(
    [string]$Label,
    [hashtable]$Body
  )
  $json = $Body | ConvertTo-Json -Depth 6 -Compress
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  Write-Host "POST $imageUrl"
  Write-Host "model=$($Body.model) size=$($Body.size)"
  try {
    $resp = Invoke-RestMethod -Uri $imageUrl -Method Post -Headers $headers -Body $json -TimeoutSec $TimeoutSec
    $count = 0
    if ($resp.data) { $count = @($resp.data).Count }
    Write-Host "[PASS] HTTP OK, data items: $count" -ForegroundColor Green
    if ($resp.data -and $resp.data.Count -gt 0) {
      $first = $resp.data[0]
      if ($first.url) {
        Write-Host "url: $($first.url.Substring(0, [Math]::Min(120, $first.url.Length)))..."
      }
      if ($first.b64_json) {
        Write-Host "b64_json: len=$($first.b64_json.Length)"
      }
    }
    if ($resp.error) {
      Write-Host "error field: $($resp.error | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    }
    return @{ ok = $true; resp = $resp }
  }
  catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails.Message) {
      $msg = $_.ErrorDetails.Message
    }
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    return @{ ok = $false; detail = $msg }
  }
}

Write-Host "Doubao image gen probe" -ForegroundColor Cyan
Write-Host "Model (endpoint id): $Model"
Write-Host "API Key: use your Volcengine console key (sk- or ark- format). Model: use an activated Seedream id from console."

$baseBody = @{
  model  = $Model
  prompt = $Prompt
  n      = 1
}

Invoke-ImageGen -Label "Extension default body (1024x1024)" -Body ($baseBody + @{
  size = "1024x1024"
})

Invoke-ImageGen -Label "Doubao recommended (2K + url)" -Body ($baseBody + @{
  size             = "2K"
  response_format  = "url"
  watermark        = $false
})

Invoke-ImageGen -Label "Doubao seedream name fallback" -Body (@{
  model            = "doubao-seedream-5-0-260128"
  prompt           = $Prompt
  n                = 1
  size             = "2K"
  response_format  = "url"
  watermark        = $false
})

Write-Host "`nDone." -ForegroundColor Cyan

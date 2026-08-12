$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw -Encoding UTF8
$buildScript = Get-Content -LiteralPath (Join-Path $projectRoot "scripts\generate-config.mjs") -Raw -Encoding UTF8
$envExample = Get-Content -LiteralPath (Join-Path $projectRoot ".env.example") -Raw -Encoding UTF8
$renderConfig = Get-Content -LiteralPath (Join-Path $projectRoot "render.yaml") -Raw -Encoding UTF8
$readme = Get-Content -LiteralPath (Join-Path $projectRoot "README.md") -Raw -Encoding UTF8
$browserFiles = @("app.js", "supabase-service.js", "supabase-config.js", "weather-service.js")
$browserCode = ($browserFiles | ForEach-Object { Get-Content -LiteralPath (Join-Path $projectRoot $_) -Raw -Encoding UTF8 }) -join "`n"

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "FAILED: $Message" }
    Write-Output "PASS: $Message"
}

Assert-Condition ($packageJson.Contains('"build": "node scripts/generate-config.mjs"')) "Production build command exists"
Assert-Condition ($buildScript.Contains('const publicFiles')) "Build uses an explicit public-file allowlist"
Assert-Condition ($buildScript.Contains('SUPABASE_URL')) "Build injects Supabase URL"
Assert-Condition ($buildScript.Contains('SUPABASE_PUBLISHABLE_KEY')) "Build injects publishable key"
Assert-Condition ($envExample.Contains('WEATHER_API_URL=')) "Optional weather proxy environment variable is documented"
Assert-Condition ($renderConfig.Contains('runtime: static')) "Render static runtime is configured"
Assert-Condition ($renderConfig.Contains('staticPublishPath: ./dist')) "Render publishes only dist"
Assert-Condition ($renderConfig.Contains('destination: /index.html')) "SPA fallback route is configured"
Assert-Condition ($readme.Contains('render.yaml')) "Render deployment guide exists"
Assert-Condition (-not ($browserCode -match 'sb_secret_[A-Za-z0-9_-]+|"service_role"')) "No secret or service role key is exposed"

Write-Output "All PHASE 10 deployment-preparation checks passed."

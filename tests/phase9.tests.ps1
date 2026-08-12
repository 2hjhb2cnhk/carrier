$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$html = Get-Content -LiteralPath (Join-Path $projectRoot "index.html") -Raw -Encoding UTF8
$appScript = Get-Content -LiteralPath (Join-Path $projectRoot "app.js") -Raw -Encoding UTF8
$weatherScript = Get-Content -LiteralPath (Join-Path $projectRoot "weather-service.js") -Raw -Encoding UTF8
$css = Get-Content -LiteralPath (Join-Path $projectRoot "styles.css") -Raw -Encoding UTF8

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw "FAILED: $Message"
    }

    Write-Output "PASS: $Message"
}

Assert-Condition ($html.Contains('id="weather-temperature"')) "Outside temperature field exists"
Assert-Condition ($html.Contains('id="weather-humidity"')) "Humidity field exists"
Assert-Condition ($html.Contains('id="weather-refresh"')) "Weather refresh control exists"
Assert-Condition ($weatherScript.Contains('const SAMPLE_WEATHER')) "Sample weather data exists"
Assert-Condition ($weatherScript.Contains('weatherApiUrl')) "Weather API proxy structure exists"
Assert-Condition ($weatherScript.Contains('AbortController')) "Weather API timeout protection exists"
Assert-Condition ($weatherScript.Contains('normalizeWeather')) "Weather response validation exists"
Assert-Condition ($appScript.Contains('function getWeatherMissionRecommendation')) "Weather-based mission recommendation exists"
Assert-Condition ($appScript.Contains('async function refreshWeather')) "Weather card renderer exists"
Assert-Condition ($css.Contains('.weather-source.is-danger')) "Weather connection error Red UI exists"

Write-Output "All PHASE 9 weather checks passed."

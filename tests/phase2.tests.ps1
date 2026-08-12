$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$html = Get-Content -LiteralPath (Join-Path $projectRoot "index.html") -Raw -Encoding UTF8
$css = Get-Content -LiteralPath (Join-Path $projectRoot "styles.css") -Raw -Encoding UTF8
$script = Get-Content -LiteralPath (Join-Path $projectRoot "app.js") -Raw -Encoding UTF8

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

$requiredStatusIds = @(
    "detail-power",
    "detail-mode",
    "detail-temperature",
    "detail-fan",
    "detail-runtime",
    "detail-filter"
)

foreach ($id in $requiredStatusIds) {
    Assert-Condition ($html.Contains("id=`"$id`"")) "Aircon status field exists: $id"
}

Assert-Condition ($html.Contains('id="power-button"')) "POWER control exists"
Assert-Condition ($html.Contains('id="mode-select"')) "MODE control exists"
Assert-Condition ($html.Contains('id="temperature-down"') -and $html.Contains('id="temperature-up"')) "Temperature controls exist"
Assert-Condition ([regex]::Matches($html, 'data-fan=').Count -eq 4) "Four FAN controls exist"
Assert-Condition ($html.Contains('id="add-runtime-button"')) "Runtime simulation control exists"
Assert-Condition ([regex]::Matches($html, 'data-scenario=').Count -eq 3) "Three device scenarios exist"
Assert-Condition ($css.Contains('--red-600: #e23a4e')) "Red warning token exists"
Assert-Condition ($css.Contains('.device-alert.is-danger')) "Abnormal status Red UI exists"
Assert-Condition ($css.Contains('.aircon-card.is-danger')) "Aircon summary Red UI exists"
Assert-Condition ($script.Contains('const DEFAULT_AIRCON_STATE')) "Virtual Carrier IoT state exists"
Assert-Condition ($script.Contains('function renderAirconState')) "Aircon rendering function exists"
Assert-Condition ($script.Contains('airconState.filterLife <= 10')) "Filter warning condition exists"
Assert-Condition ($script.Contains('airconState.sensorError')) "Sensor error condition exists"
Assert-Condition ($script.Contains('carrier-greenon-aircon')) "Virtual state persistence exists"
Assert-Condition ($script.Contains('airconElements.addRuntimeButton.addEventListener("click", () => advanceSimulation(30))')) "Thirty-minute simulation exists"

Write-Output "All PHASE 2 automated checks passed."

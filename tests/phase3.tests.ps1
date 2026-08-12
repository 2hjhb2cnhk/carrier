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

Assert-Condition ($html.Contains('id="mission-start-button"')) "Mission participation control exists"
Assert-Condition ($html.Contains('id="mission-progress-bar"')) "Mission progress indicator exists"
Assert-Condition ($html.Contains('id="mission-time-button"')) "Mission time simulation control exists"
Assert-Condition ([regex]::Matches($html, 'id="condition-(power|mode|temperature|sensor)"').Count -eq 4) "Four live mission conditions exist"
Assert-Condition ($html.Contains('id="mission-warning"')) "Mission warning region exists"
Assert-Condition ($html.Contains('id="mission-result"')) "Mission result region exists"
Assert-Condition ($css.Contains('.condition-list li.is-danger')) "Condition violation Red UI exists"
Assert-Condition ($css.Contains('.mission-result.is-danger')) "Mission failure Red UI exists"
Assert-Condition ($css.Contains('.mission-state-chip.is-success')) "Mission success UI exists"
Assert-Condition ($script.Contains('function getMissionConditions')) "Mission condition evaluator exists"
Assert-Condition ($script.Contains('function advanceSimulation')) "Mission time simulation exists"
Assert-Condition ($script.Contains('missionState.status = "failed"')) "Mission failure transition exists"
Assert-Condition ($script.Contains('missionState.status = "success"')) "Mission success transition exists"
Assert-Condition ($script.Contains('missionState.elapsedMinutes >= 60')) "Sixty-minute completion rule exists"
Assert-Condition ($script.Contains('carrier-greenon-mission')) "Mission persistence exists"

Write-Output "All PHASE 3 automated checks passed."

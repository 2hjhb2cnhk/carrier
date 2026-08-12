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

Assert-Condition ($html.Contains('id="signup-form"')) "Signup form exists"
Assert-Condition ($html.Contains('id="login-form"')) "Login form exists"
Assert-Condition ($html.Contains('id="logout-button"')) "Logout control exists"
Assert-Condition ($html.Contains('id="member-dashboard"')) "MY member dashboard exists"
Assert-Condition ($html.Contains('id="level-name"')) "GREEN LEVEL exists"
Assert-Condition ($html.Contains('id="report-title"')) "GREEN REPORT exists"
Assert-Condition ($html.Contains('id="report-missions"')) "Mission report metric exists"
Assert-Condition ($html.Contains('id="report-orders"')) "Reward report metric exists"
Assert-Condition ($css.Contains('.form-error')) "Authentication error Red UI exists"
Assert-Condition ($css.Contains('.level-progress')) "GREEN LEVEL progress UI exists"
Assert-Condition ($script.Contains('function loadDemoAuthState')) "Demo auth state exists"
Assert-Condition ($script.Contains('function getGreenLevel')) "GREEN LEVEL calculation exists"
Assert-Condition ($script.Contains('function renderMyPage')) "MY page renderer exists"
Assert-Condition ($script.Contains('window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY)')) "Logout clears session"
Assert-Condition (-not $script.Contains('password: String(formData.get("password"))')) "Password is not stored in demo profile"
Assert-Condition ($script.Contains('completedMissions * 0.4')) "GREEN REPORT carbon estimate exists"

Write-Output "All PHASE 6 automated checks passed."

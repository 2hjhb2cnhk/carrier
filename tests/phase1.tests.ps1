$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$htmlPath = Join-Path $projectRoot "index.html"
$cssPath = Join-Path $projectRoot "styles.css"
$scriptPath = Join-Path $projectRoot "app.js"

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

Assert-Condition (Test-Path -LiteralPath $htmlPath) "Home document exists"
Assert-Condition (Test-Path -LiteralPath $cssPath) "Shared stylesheet exists"
Assert-Condition (Test-Path -LiteralPath $scriptPath) "Application script exists"

$html = Get-Content -LiteralPath $htmlPath -Raw -Encoding UTF8
$css = Get-Content -LiteralPath $cssPath -Raw -Encoding UTF8
$script = Get-Content -LiteralPath $scriptPath -Raw -Encoding UTF8

Assert-Condition ($html.Contains('name="viewport"')) "Mobile viewport is configured"
Assert-Condition ([regex]::Matches($html, 'data-page="(home|mission|wallet|shop|my)"').Count -eq 5) "Five main page sections exist"
Assert-Condition ([regex]::Matches($html, 'data-page-target=').Count -eq 5) "Five bottom navigation items exist"
Assert-Condition ($html.Contains('class="skip-link"')) "Keyboard skip link exists"
Assert-Condition ($css.Contains('--surface: #ffffff')) "White design token exists"
Assert-Condition ($css.Contains('--blue-600: #709ed1')) "Pastel blue brand token exists"
Assert-Condition ($css.Contains('--lavender-100: #eee9f8')) "Pastel lavender support token exists"
Assert-Condition ($css.Contains('--mint-100: #e8f4ef')) "Pastel mint support token exists"
Assert-Condition ($css.Contains('--peach-100: #fbece6')) "Pastel peach support token exists"
Assert-Condition ($css.Contains('@media (min-width: 620px)')) "Wide responsive breakpoint exists"
Assert-Condition ($css.Contains('@media (max-width: 390px)')) "Small mobile breakpoint exists"
Assert-Condition ($script.Contains('function showPage')) "Page navigation function exists"
Assert-Condition ($script.Contains('window.addEventListener("popstate"')) "Browser history navigation is handled"
Assert-Condition ($script.Contains('// Carrier GreenON')) "Beginner-friendly Korean JavaScript comments exist"

Write-Output "All PHASE 1 automated checks passed."

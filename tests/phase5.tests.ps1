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

Assert-Condition ($html.Contains('id="reward-grid"')) "Reward product list exists"
Assert-Condition ([regex]::Matches($html, 'data-reward-category=').Count -eq 4) "ALL and three reward categories exist"
Assert-Condition ($html.Contains('id="reward-modal"')) "Reward detail modal exists"
Assert-Condition ($html.Contains('id="reward-purchase-button"')) "Point purchase control exists"
Assert-Condition ($html.Contains('id="purchase-warning"')) "Insufficient point warning exists"
Assert-Condition ($html.Contains('id="order-list"')) "Purchase history exists"
Assert-Condition ($css.Contains('.purchase-warning')) "Insufficient point Red warning UI exists"
Assert-Condition ($css.Contains('.reward-purchase-line.is-danger')) "Insufficient balance Red UI exists"
Assert-Condition ($script.Contains('category: "FOOD"')) "FOOD rewards exist"
Assert-Condition ($script.Contains('category: "LIFE"')) "LIFE rewards exist"
Assert-Condition ($script.Contains('category: "CARRIER"')) "CARRIER rewards exist"
Assert-Condition ($script.Contains('function purchaseSelectedReward')) "Reward purchase function exists"
Assert-Condition ($script.Contains('walletState.balance < product.price')) "Insufficient point guard exists"
Assert-Condition ($script.Contains('walletState.balance -= product.price')) "Point deduction exists"
Assert-Condition ($script.Contains('type: "spend"')) "Spend transaction is recorded"
Assert-Condition ($script.Contains('orderState.unshift')) "Purchase order is recorded"

Write-Output "All PHASE 5 automated checks passed."

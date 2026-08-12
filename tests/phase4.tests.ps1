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

Assert-Condition ($html.Contains('id="wallet-balance"')) "Current wallet balance exists"
Assert-Condition ($html.Contains('id="wallet-total-earned"')) "Earned points summary exists"
Assert-Condition ($html.Contains('id="wallet-total-spent"')) "Spent points summary exists"
Assert-Condition ($html.Contains('id="transaction-list"')) "Point transaction list exists"
Assert-Condition ([regex]::Matches($html, 'data-transaction-filter=').Count -eq 3) "Point history filters exist"
Assert-Condition ($css.Contains('.wallet-balance-card')) "GREEN WALLET visual card exists"
Assert-Condition ($css.Contains('.transaction-item[data-type="spend"]')) "Spent transaction visual state exists"
Assert-Condition ($script.Contains('const WALLET_STORAGE_KEY')) "Wallet persistence key exists"
Assert-Condition ($script.Contains('function awardMissionReward')) "Mission reward function exists"
Assert-Condition ($script.Contains('const transactionId = `mission-${missionState.date}`')) "Daily duplicate reward guard exists"
Assert-Condition ($script.Contains('walletState.balance += 150')) "Mission adds 150 GREEN POINT"
Assert-Condition ($script.Contains('type: "earn"')) "Earn transaction is recorded"
Assert-Condition ($script.Contains('function renderWallet')) "Wallet renderer exists"

Write-Output "All PHASE 4 automated checks passed."

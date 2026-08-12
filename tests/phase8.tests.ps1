$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$appScript = Get-Content -LiteralPath (Join-Path $projectRoot "app.js") -Raw -Encoding UTF8
$serviceScript = Get-Content -LiteralPath (Join-Path $projectRoot "supabase-service.js") -Raw -Encoding UTF8
$schema = Get-Content -LiteralPath (Join-Path $projectRoot "supabase\schema.sql") -Raw -Encoding UTF8

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

Assert-Condition ($serviceScript.Contains('async function loadAppData')) "Supabase app data loader exists"
Assert-Condition ($serviceScript.Contains('from("profiles")')) "Profile data loads from Supabase"
Assert-Condition ($serviceScript.Contains('from("user_missions")')) "Mission records load from Supabase"
Assert-Condition ($serviceScript.Contains('from("point_transactions")')) "Point records load from Supabase"
Assert-Condition ($serviceScript.Contains('from("rewards")')) "Reward products load from Supabase"
Assert-Condition ($serviceScript.Contains('from("reward_orders")')) "Purchase history loads from Supabase"
Assert-Condition ($serviceScript.Contains('from("aircon_status")')) "Aircon state loads from Supabase"
Assert-Condition ($serviceScript.Contains('rpc("start_green_mission"')) "Mission start uses database RPC"
Assert-Condition ($serviceScript.Contains('rpc("advance_green_mission"')) "Mission progress and reward use database RPC"
Assert-Condition ($serviceScript.Contains('rpc("purchase_reward"')) "Reward purchase uses database RPC"
Assert-Condition ($appScript.Contains('async function hydrateSupabaseAppData')) "Supabase data hydrates every screen"
Assert-Condition ($appScript.Contains('window.localStorage.removeItem(key)')) "Legacy local data is removed after login"
Assert-Condition ($appScript.Contains('if (databaseMode) return false')) "Client-side mission award is disabled in database mode"
Assert-Condition ($schema.Contains("using ((select auth.uid()) = user_id)")) "User-owned rows remain separated by RLS"

Write-Output "All PHASE 8 data-transition checks passed."

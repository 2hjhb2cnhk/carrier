$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$html = Get-Content -LiteralPath (Join-Path $projectRoot "index.html") -Raw -Encoding UTF8
$appScript = Get-Content -LiteralPath (Join-Path $projectRoot "app.js") -Raw -Encoding UTF8
$serviceScript = Get-Content -LiteralPath (Join-Path $projectRoot "supabase-service.js") -Raw -Encoding UTF8
$configScript = Get-Content -LiteralPath (Join-Path $projectRoot "supabase-config.js") -Raw -Encoding UTF8
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

$requiredTables = @("profiles", "missions", "user_missions", "point_transactions", "rewards", "reward_orders", "aircon_status")
foreach ($table in $requiredTables) {
    Assert-Condition ($schema.Contains("create table public.$table")) "Supabase table exists: $table"
    Assert-Condition ($schema.Contains("alter table public.$table enable row level security")) "RLS enabled in schema: $table"
}

Assert-Condition ($html.Contains('@supabase/supabase-js@2.111.0')) "Supabase JavaScript client is version-pinned"
Assert-Condition ($configScript.Contains('sb_publishable_')) "Browser uses a publishable key"
Assert-Condition (-not (($configScript + $serviceScript + $appScript) -match 'sb_secret_[A-Za-z0-9_-]+|"service_role"')) "No service role or secret key in browser code"
Assert-Condition ($serviceScript.Contains('signInWithPassword')) "Supabase password login is connected"
Assert-Condition ($serviceScript.Contains('client.auth.signUp')) "Supabase signup is connected"
Assert-Condition ($serviceScript.Contains('client.auth.signOut')) "Supabase logout is connected"
Assert-Condition ($appScript.Contains('initializeSupabaseAuth')) "Supabase session restoration exists"
Assert-Condition ([regex]::Matches($schema, '\(select auth\.uid\(\)\)').Count -ge 10) "RLS and RPC ownership checks exist"
Assert-Condition ($schema.Contains('grant update (display_name) on public.profiles')) "Profile updates use column-level least privilege"
Assert-Condition ($schema.Contains('revoke all on function public.purchase_reward')) "Sensitive RPC public access is revoked"
Assert-Condition ($schema.Contains('walletState.balance -= product.price') -eq $false) "Database schema does not trust client point deduction"

Write-Output "All PHASE 7 local security checks passed."

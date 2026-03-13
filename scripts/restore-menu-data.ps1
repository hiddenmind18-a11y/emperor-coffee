# PowerShell Script to Restore Menu Data from Dump File
# Run this on your Windows machine

$pgRestore = "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
$dumpFile = "E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
$databaseUrl = "postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Restoring Menu Data from Dump File" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define tables to restore in correct order (respecting foreign keys)
$tables = @(
    @{Name="Category"; Desc="Categories"},
    @{Name="Ingredient"; Desc="Ingredients"},
    @{Name="VariantType"; Desc="Variant Types"},
    @{Name="VariantOption"; Desc="Variant Options"},
    @{Name="MenuItem"; Desc="Menu Items"},
    @{Name="MenuItemVariant"; Desc="Menu Item Variants"},
    @{Name="MenuItemBranch"; Desc="Menu Item Branch Assignments"},
    @{Name="Recipe"; Desc="Recipes"}
)

foreach ($table in $tables) {
    Write-Host "Restoring $($table.Desc)..." -ForegroundColor Yellow

    $arguments = @(
        "--data-only",
        "--disable-triggers",
        "--no-owner",
        "--no-privileges",
        "--table=$($table.Name)",
        "-d", $databaseUrl,
        $dumpFile
    )

    try {
        $output = & $pgRestore $arguments 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $($table.Desc) restored successfully!" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Warning restoring $($table.Desc)" -ForegroundColor Yellow
            Write-Host "  $output" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ❌ Error restoring $($table.Desc): $_" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Restore Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please check your application to verify the data is restored." -ForegroundColor Green

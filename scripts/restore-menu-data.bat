@echo off
REM Batch Script to Restore Menu Data from Dump File
REM Run this on your Windows machine

set PGRESTORE="C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
set DUMPFILE="E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
set DBURL=postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require

echo ========================================
echo Restoring Menu Data from Dump File
echo ========================================
echo.

echo [1/8] Restoring Categories...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="Category" -d %DBURL% %DUMPFILE%
echo.

echo [2/8] Restoring Ingredients...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="Ingredient" -d %DBURL% %DUMPFILE%
echo.

echo [3/8] Restoring Variant Types...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="VariantType" -d %DBURL% %DUMPFILE%
echo.

echo [4/8] Restoring Variant Options...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="VariantOption" -d %DBURL% %DUMPFILE%
echo.

echo [5/8] Restoring Menu Items...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="MenuItem" -d %DBURL% %DUMPFILE%
echo.

echo [6/8] Restoring Menu Item Variants...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="MenuItemVariant" -d %DBURL% %DUMPFILE%
echo.

echo [7/8] Restoring Menu Item Branch Assignments...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="MenuItemBranch" -d %DBURL% %DUMPFILE%
echo.

echo [8/8] Restoring Recipes...
%PGRESTORE% --data-only --disable-triggers --no-owner --no-privileges --table="Recipe" -d %DBURL% %DUMPFILE%
echo.

echo ========================================
echo Restore Complete!
echo ========================================
echo.
echo Please check your application to verify the data is restored.
pause

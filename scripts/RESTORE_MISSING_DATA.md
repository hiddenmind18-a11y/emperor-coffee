# Restore Missing Data (Menu Items, Categories, Recipes)

This guide will help you restore the missing data from your dump file.

## Step 1: Check What's Missing

Run this command to see which tables are empty:

```bash
# In your project directory
bun run scripts/check-and-restore.ts
```

## Step 2: Restore Missing Data

You need to run these pg_restore commands on your Windows machine using the correct connection string.

### First, restore Categories:

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" ^
  --data-only ^
  --disable-triggers ^
  --no-owner ^
  --no-privileges ^
  --table="Category" ^
  -d "postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" ^
  "E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
```

### Then, restore Menu Items:

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" ^
  --data-only ^
  --disable-triggers ^
  --no-owner ^
  --no-privileges ^
  --table="MenuItem" ^
  -d "postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" ^
  "E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
```

### Then, restore Ingredients:

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" ^
  --data-only ^
  --disable-triggers ^
  --no-owner ^
  --no-privileges ^
  --table="Ingredient" ^
  -d "postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" ^
  "E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
```

### Then, restore Recipes:

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" ^
  --data-only ^
  --disable-triggers ^
  --no-owner ^
  --no-privileges ^
  --table="Recipe" ^
  -d "postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" ^
  "E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
```

### Also restore related tables:

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" ^
  --data-only ^
  --disable-triggers ^
  --no-owner ^
  --no-privileges ^
  --table="MenuItemVariant" ^
  --table="VariantType" ^
  --table="VariantOption" ^
  -d "postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" ^
  "E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
```

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" ^
  --data-only ^
  --disable-triggers ^
  --no-owner ^
  --no-privileges ^
  --table="MenuItemBranch" ^
  -d "postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" ^
  "E:\EmperorBackups\EmperorPOS_2026-03-12.dump"
```

## Step 3: Verify Data

After restoring, check if the data is restored:

```bash
bun run scripts/check-and-restore.ts
```

## Important Notes:

1. **Connection String**: I've updated to use the direct Neon connection (without -pooler) to avoid the P2021 error

2. **Order Matters**: Categories first, then Ingredients, then MenuItems, then Recipes (because of foreign key dependencies)

3. **No Schema Changes**: Using --data-only ensures we only restore data, not modify the table structure

4. **Disable Triggers**: --disable-triggers prevents errors from triggers during restore

## If You Get Errors:

If you see any errors, please share them and I'll help you troubleshoot.

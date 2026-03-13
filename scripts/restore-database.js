const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const NEW_DATABASE_URL = 'postgresql://neondb_owner:npg_jR2nVQDJXG8O@ep-nameless-flower-alam3jmb-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: NEW_DATABASE_URL
    }
  }
});

// Correct model names from schema
const MODELS = [
  'User',
  'Branch',
  'Table',
  'BranchLicense',
  'Category',
  'MenuItem',
  'MenuItemBranch',
  'Recipe',
  'Ingredient',
  'VariantType',
  'VariantOption',
  'MenuItemVariant',
  'BranchInventory',
  'InventoryTransaction',
  'CostCategory',
  'BranchCost',
  'DailyExpense',
  'InvoiceSerial',
  'Order',
  'DeliveryArea',
  'Courier',
  'OrderItem',
  'VoidedItem',
  'OrderItemTransfer',
  'SyncHistory',
  'SyncConflict',
  'IdempotencyKey',
  'AuditLog',
  'Shift',
  'BusinessDay',
  'Customer',
  'CustomerAddress',
  'Supplier',
  'PurchaseOrder',
  'PurchaseOrderItem',
  'InventoryTransfer',
  'InventoryTransferItem',
  'WasteLog',
  'LoyaltyTransaction',
  'Notification',
  'ReceiptSettings',
  'Promotion',
  'PromotionCode',
  'PromotionBranch',
  'PromotionCategory',
  'PromotionUsageLog'
];

async function restoreDatabase(backupFile) {
  console.log('🔄 Starting database restore...');
  console.log('📂 Backup file:', backupFile);
  console.log('📍 Target database:', NEW_DATABASE_URL.replace(/:[^:]*@/, ':***@'));

  try {
    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    console.log(`✅ Backup loaded: ${backupData.timestamp}`);
    console.log(`📦 Version: ${backupData.version}`);

    let totalRecordsRestored = 0;
    let totalErrors = 0;

    // Restore each model in order (parents before children)
    for (const modelName of MODELS) {
      const records = backupData.data[modelName];

      if (!records || records.length === 0) {
        console.log(`⏭️  ${modelName}: No records to restore`);
        continue;
      }

      console.log(`📥 Restoring ${modelName} (${records.length} records)...`);

      let successCount = 0;
      let errorCount = 0;

      for (const record of records) {
        try {
          // Use create with data, skip duplicates
          await prisma[modelName].create({
            data: {
              ...record,
              // Remove id to let Prisma generate new IDs (avoid conflicts)
              id: undefined
            },
            skipDuplicates: true
          });
          successCount++;
        } catch (error) {
          // Try update if create fails
          try {
            if (record.id) {
              await prisma[modelName].upsert({
                where: { id: record.id },
                update: record,
                create: record
              });
              successCount++;
            }
          } catch (upsertError) {
            console.error(`  ⚠️  Failed to restore record ${record.id || '(no id)'}: ${upsertError.message}`);
            errorCount++;
            totalErrors++;
          }
        }
      }

      console.log(`✅ ${modelName}: ${successCount} restored, ${errorCount} errors`);
      totalRecordsRestored += successCount;
    }

    console.log('\n✅ Restore completed successfully!');
    console.log(`📊 Total records restored: ${totalRecordsRestored}`);
    console.log(`❌ Total errors: ${totalErrors}`);

  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get backup file from command line or use the latest
const BACKUP_DIR = path.join(__dirname, '../backups');
const backupFile = process.argv[2] || fs.readdirSync(BACKUP_DIR)
  .filter(f => f.endsWith('.json'))
  .sort()
  .reverse()[0];

if (!backupFile) {
  console.error('❌ No backup file found!');
  process.exit(1);
}

restoreDatabase(path.join(BACKUP_DIR, backupFile));

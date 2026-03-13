const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
    }
  }
});

const OUTPUT_DIR = path.join(__dirname, '../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILE = path.join(OUTPUT_DIR, `emperor-pos-backup-${TIMESTAMP}.json`);

async function backupDatabase() {
  console.log('🔄 Starting database backup...');
  console.log('📍 Backup file:', BACKUP_FILE);

  // Ensure backup directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Get all model names from Prisma
    const models = [
      'User',
      'Branch',
      'MenuItem',
      'MenuItemVariant',
      'Category',
      'Ingredient',
      'Recipe',
      'RecipeItem',
      'Inventory',
      'InventoryTransfer',
      'WasteTracking',
      'Supplier',
      'PurchaseOrder',
      'PurchaseOrderItem',
      'Customer',
      'LoyaltyPoints',
      'PromoCode',
      'BusinessDay',
      'Shift',
      'Order',
      'OrderItem',
      'Payment',
      'DeliveryArea',
      'DeliveryOrder',
      'Courier',
      'DailyExpense',
      'Table',
      'AuditLog',
      'SyncOperation',
      'SyncConflict',
      'Notification',
      'Discount',
      'Tax'
    ];

    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    // Backup each model
    for (const modelName of models) {
      try {
        console.log(`📦 Backing up ${modelName}...`);
        const data = await prisma[modelName].findMany();
        backup.data[modelName] = data;
        console.log(`✅ ${modelName}: ${data.length} records`);
      } catch (error) {
        console.log(`⚠️  ${modelName}: ${error.message}`);
        backup.data[modelName] = [];
      }
    }

    // Write backup to file
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    console.log('\n✅ Backup completed successfully!');
    console.log(`📁 Backup saved to: ${BACKUP_FILE}`);
    console.log(`📊 Total models backed up: ${Object.keys(backup.data).length}`);

    // Calculate total records
    const totalRecords = Object.values(backup.data).reduce((sum, records) => sum + records.length, 0);
    console.log(`📈 Total records: ${totalRecords}`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();

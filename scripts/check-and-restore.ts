import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTables() {
  console.log('🔍 Checking table data...\n')

  // Check tables
  const tables = [
    { name: 'Category', count: await prisma.category.count() },
    { name: 'MenuItem', count: await prisma.menuItem.count() },
    { name: 'Recipe', count: await prisma.recipe.count() },
    { name: 'Ingredient', count: await prisma.ingredient.count() },
    { name: 'User', count: await prisma.user.count() },
    { name: 'Branch', count: await prisma.branch.count() },
    { name: 'Order', count: await prisma.order.count() },
  ]

  console.log('Table Status:')
  console.log('─'.repeat(50))
  tables.forEach(table => {
    const status = table.count === 0 ? '❌ EMPTY' : `✅ ${table.count} records`
    console.log(`${table.name.padEnd(20)} : ${status}`)
  })
  console.log('─'.repeat(50))

  const emptyTables = tables.filter(t => t.count === 0)
  if (emptyTables.length > 0) {
    console.log(`\n⚠️  Empty tables: ${emptyTables.map(t => t.name).join(', ')}`)
  } else {
    console.log('\n✅ All tables have data!')
  }
}

async function main() {
  try {
    await checkTables()
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()

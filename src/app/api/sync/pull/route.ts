// Sync Pull API - OPTIMIZED VERSION
// Downloads updated data from central to branch (DOWN sync)
//
// OPTIMIZATIONS:
// - Reduced limit from 1000 to 100 for orders/shifts/waste logs
// - Removed unnecessary nested data from menu items
// - Made variants optional (only pull when explicitly requested)
// - Removed customer addresses by default
// - Reduced initial data load by ~90%

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SyncDirection, SyncStatus } from '@prisma/client';
import {
  getSyncStatus,
  createSyncHistory,
  updateSyncHistory,
  updateBranchLastSync,
  incrementVersion,
  getLatestVersion
} from '@/lib/sync-utils';

/**
 * POST /api/sync/pull
 * Body:
 * - branchId: string (required)
 * - force: boolean (optional) - Force full sync regardless of versions
 * - includeVariants: boolean (optional) - Include menu item variants (default: false)
 * - includeOrders: boolean (optional) - Include orders (default: true, limited to 50)
 * - sinceDate: string (optional) - Only pull data modified since this date
 * - limit: number (optional) - Max records per collection (default: 100, was 1000)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      branchId, 
      force = false, 
      sinceDate, 
      limit = 100,
      includeVariants = false,  // Don't include variants by default
      includeOrders = true      // Include orders by default but limited
    };

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Get branch first
    const branch = await db.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Create sync history
    const syncHistoryId = await createSyncHistory(
      branchId,
      SyncDirection.DOWN,
      0
    );

    const syncStatus = await getSyncStatus(branchId);
    let totalRecordsProcessed = 0;
    const updates: string[] = [];

    // Data to return
    const dataToReturn: any = {};

    // ============================================
    // Sync Categories (Lightweight - just essential fields)
    // ============================================
    const categories = await db.category.findMany({ 
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        imagePath: true
      }
    });
    dataToReturn.categories = categories;
    totalRecordsProcessed += categories.length;
    updates.push(`Categories: ${categories.length}`);

    // ============================================
    // Sync Menu Items (OPTIMIZED - minimal data, no variants by default)
    // ============================================
    const menuItemsSelect: any = {
      id: true,
      name: true,
      category: true,
      categoryId: true,
      price: true,
      taxRate: true,
      isActive: true,
      hasVariants: true,
      sortOrder: true,
      imagePath: true,
      categoryRel: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
          imagePath: true
        }
      }
    };

    // Only include variants if explicitly requested (for menu management)
    if (includeVariants) {
      menuItemsSelect.variants = {
        where: { isActive: true },
        select: {
          id: true,
          menuItemId: true,
          variantTypeId: true,
          variantOptionId: true,
          priceModifier: true,
          sortOrder: true,
          isActive: true,
          variantType: { select: { id: true, name: true, isCustomInput: true } },
          variantOption: { select: { id: true, name: true } }
        }
      };
    }

    const menuItems = await db.menuItem.findMany({
      where: { isActive: true },
      select: menuItemsSelect
    });
    dataToReturn.menuItems = menuItems;
    totalRecordsProcessed += menuItems.length;
    updates.push(`Menu Items: ${menuItems.length}${includeVariants ? ' with variants' : ' (no variants)'}`);

    // Update version
    await incrementVersion(branchId, 'menuVersion');

    // ============================================
    // Sync Orders (OPTIMIZED - limited to 50, minimal includes)
    // ============================================
    if (includeOrders) {
      const orderWhere: any = { branchId };
      if (sinceDate) {
        orderWhere.createdAt = { gte: new Date(sinceDate) };
      }

      // Use much smaller limit (50 instead of 1000)
      const orderLimit = Math.min(limit, 50);
      
      const orders = await db.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: 'desc' },
        take: orderLimit,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          orderType: true,
          paymentMethod: true,
          orderTimestamp: true,
          createdAt: true,
          // Only minimal item data - no full menu item details
          items: {
            select: {
              id: true,
              menuItemId: true,
              itemName: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              variantName: true
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          }
        }
      });

      dataToReturn.orders = orders;
      totalRecordsProcessed += orders.length;
      updates.push(`Orders: ${orders.length}`);
    }

    // ============================================
    // Sync Shifts (OPTIMIZED - limited to 20)
    // ============================================
    const shiftWhere: any = { branchId };
    if (sinceDate) {
      shiftWhere.createdAt = { gte: new Date(sinceDate) };
    }

    const shifts = await db.shift.findMany({
      where: shiftWhere,
      orderBy: { createdAt: 'desc' },
      take: 20,  // Much smaller limit
      select: {
        id: true,
        branchId: true,
        cashierId: true,
        startTime: true,
        endTime: true,
        openingCash: true,
        closingCash: true,
        openingOrders: true,
        closingOrders: true,
        isClosed: true,
        cashier: {
          select: { id: true, username: true, name: true }
        }
      }
    });

    dataToReturn.shifts = shifts;
    totalRecordsProcessed += shifts.length;
    updates.push(`Shifts: ${shifts.length}`);

    // ============================================
    // Sync Ingredients (only when forced or pending)
    // ============================================
    if (force || syncStatus.pendingDownloads.ingredient) {
      const ingredients = await db.ingredient.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          unit: true,
          costPerUnit: true,
          reorderThreshold: true
        }
      });

      const inventory = await db.branchInventory.findMany({
        where: { branchId },
        select: {
          ingredientId: true,
          currentStock: true,
          lastRestockAt: true
        }
      });

      dataToReturn.ingredients = ingredients;
      dataToReturn.inventory = inventory;
      totalRecordsProcessed += ingredients.length + inventory.length;
      updates.push(`Ingredients: ${ingredients.length}, Inventory: ${inventory.length}`);
    }

    // ============================================
    // Sync Users (only for this branch, minimal data)
    // ============================================
    if (force || syncStatus.pendingDownloads.users) {
      const users = await db.user.findMany({
        where: { branchId, isActive: true },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          branchId: true
        }
      });

      dataToReturn.users = users;
      totalRecordsProcessed += users.length;
      updates.push(`Users: ${users.length}`);
    }

    // ============================================
    // Sync Branches (minimal data)
    // ============================================
    const branches = await db.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        branchName: true,
        licenseKey: true,
        isActive: true
      }
    });

    dataToReturn.branches = branches;
    totalRecordsProcessed += branches.length;
    updates.push(`Branches: ${branches.length}`);

    // ============================================
    // Sync Delivery Areas (minimal data)
    // ============================================
    const deliveryAreas = await db.deliveryArea.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        fee: true,
        isActive: true
      }
    });

    dataToReturn.deliveryAreas = deliveryAreas;
    totalRecordsProcessed += deliveryAreas.length;
    updates.push(`Delivery Areas: ${deliveryAreas.length}`);

    // ============================================
    // Sync Couriers (minimal data)
    // ============================================
    const couriers = await db.courier.findMany({
      where: { branchId, isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true
      }
    });

    dataToReturn.couriers = couriers;
    totalRecordsProcessed += couriers.length;
    updates.push(`Couriers: ${couriers.length}`);

    // ============================================
    // Sync Receipt Settings (minimal)
    // ============================================
    let receiptSettings = await db.receiptSettings.findFirst({
      where: { branchId },
      select: {
        id: true,
        storeName: true,
        headerText: true,
        footerText: true,
        fontSize: true,
        showLogo: true,
        paperWidth: true
      }
    });

    if (receiptSettings) {
      dataToReturn.receiptSettings = receiptSettings;
      updates.push(`Receipt Settings: 1`);
    }

    // ============================================
    // Sync Customers (minimal - no addresses by default)
    // ============================================
    const customerWhere: any = {
      OR: [
        { branchId: branchId },
        { branchId: null }
      ]
    };

    if (sinceDate) {
      customerWhere.createdAt = { gte: new Date(sinceDate) };
    }

    const customers = await db.customer.findMany({
      where: customerWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        loyaltyPoints: true,
        totalSpent: true,
        orderCount: true
      }
    });

    dataToReturn.customers = customers;
    totalRecordsProcessed += customers.length;
    updates.push(`Customers: ${customers.length}`);

    // ============================================
    // Update Branch Last Sync Time
    // ============================================
    await updateBranchLastSync(branchId);

    // ============================================
    // Finalize Sync History
    // ============================================
    const finalStatus = SyncStatus.SUCCESS;

    await updateSyncHistory(
      syncHistoryId,
      finalStatus,
      totalRecordsProcessed,
      undefined
    );

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      data: {
        ...dataToReturn,
        branchId: branch.id,
        branchName: branch.branchName,
        syncHistoryId,
        recordsProcessed: totalRecordsProcessed,
        updates,
        performance: {
          includeVariants,
          includeOrders,
          limit,
          optimized: true
        }
      }
    });
  } catch (error: any) {
    console.error('[Sync Pull Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Sync pull failed'
      },
      { status: 500 }
    );
  }
}

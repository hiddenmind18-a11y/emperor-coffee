// Sync Pull API - LIGHTWEIGHT VERSION
// Downloads updated data from central to branch (DOWN sync)
//
// CRITICAL FIXES FOR 4.54 GB DATA TRANSFER PROBLEM:
// - DISABLED auto-sync on login (auth-context.tsx)
// - REMOVED recipes, orders, shifts, waste logs from sync
// - REMOVED base64 images (imagePath) from all returns
// - Only sync what's ACTUALLY needed for POS operation
//
// This reduces data transfer from GBs to MBs

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
 * - includeOrders: boolean (optional) - Include orders (default: false)
 * - sinceDate: string (optional) - Only pull data modified since this date
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      branchId, 
      force = false, 
      sinceDate, 
      includeVariants = false,
      includeOrders = false
    } = body;

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
      'DOWN' as any,
      0
    );

    const syncStatus = await getSyncStatus(branchId);
    let totalRecordsProcessed = 0;
    const updates: string[] = [];

    // Data to return - ONLY ESSENTIAL DATA
    const dataToReturn: any = {};

    // ============================================
    // Sync Categories (NO IMAGES - prevents massive data transfer)
    // ============================================
    const categories = await db.category.findMany({ 
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        // REMOVED: imagePath - base64 images cause massive data transfer
        defaultVariantTypeId: true
      }
    });
    dataToReturn.categories = categories;
    totalRecordsProcessed += categories.length;
    updates.push(`Categories: ${categories.length}`);

    // ============================================
    // Sync Menu Items (NO IMAGES, NO VARIANTS by default)
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
      // REMOVED: imagePath - base64 images cause massive data transfer
      categoryRel: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
          // REMOVED: imagePath - base64 images cause massive data transfer
        }
      }
    };

    // Only include variants if explicitly requested (for menu management only)
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
    // Sync Branches (minimal data only)
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
    // Sync Couriers (minimal data only)
    // ============================================
    const couriers = await db.courier.findMany({
      where: {
        branchId,
        isActive: true
      },
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
    // Sync Users for this branch (minimal data)
    // ============================================
    if (force) {
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
    // Update Branch Last Sync Time
    // ============================================
    await updateBranchLastSync(branchId);

    // ============================================
    // Finalize Sync History
    // ============================================
    const finalStatus = 'SUCCESS' as const;

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
          optimized: true,
          // REMOVED from sync:
          // - No recipes (heavy ingredient data)
          // - No orders (can be fetched on-demand)
          // - No shifts (can be fetched on-demand)
          // - No waste logs (can be fetched on-demand)
          // - No base64 images (prevents massive data transfer)
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

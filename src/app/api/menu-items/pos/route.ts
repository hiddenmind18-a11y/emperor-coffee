import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached } from '@/lib/cache';

/**
 * Ultra-lightweight Menu Items API for POS Interface
 *
 * This endpoint returns ONLY the essential data needed for the POS:
 * - id, name, category, price, hasVariants, imagePath, sortOrder
 * - Category name and sortOrder
 * - NO recipes, NO ingredient data, NO variant details
 *
 * This reduces data transfer by ~90% compared to the full menu items API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const branchId = searchParams.get('branchId');

    // Cache key
    const cacheKey = `menu:items:pos:${category || 'all'}:${branchId || 'all-branches'}`;

    const menuItems = await getCached(cacheKey, async () => {
      return await db.menuItem.findMany({
        where: {
          isActive: true,
          ...(category && category !== 'all' ? { category } : {}),
          ...(branchId ? {
            // Items are available if they have NO branch assignments (all branches)
            // OR have an assignment to this branch
            OR: [
              { branchAssignments: { none: {} } },
              { branchAssignments: { some: { branchId } } },
            ],
          } : {}),
        },
        select: {
          id: true,
          name: true,
          category: true,
          categoryId: true,
          price: true,
          taxRate: true,
          hasVariants: true,
          sortOrder: true,
          // REMOVED: imagePath - base64 images cause massive data transfer (4.22 GB!)
          // POS doesn't need images embedded in JSON - they should be loaded as separate URLs
          categoryRel: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              // REMOVED: imagePath - base64 images cause massive data transfer
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      });
    }, 600000); // 10 minute cache for POS

    return NextResponse.json({
      success: true,
      menuItems
    }, {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Get POS menu items error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

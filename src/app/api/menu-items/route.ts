import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached, invalidateCachePattern } from '@/lib/cache';

/**
 * OPTIMIZED Menu Items API
 * Reduces data transfer by:
 * 1. Adding pagination (default 50 items per page)
 * 2. NOT including recipes by default (they're heavy)
 * 3. NOT including variants by default (only when requested)
 * 4. Using select instead of include where possible
 * 5. Minimal field selection
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');
    const includeVariants = searchParams.get('includeVariants') === 'true';
    const includeRecipes = searchParams.get('includeRecipes') === 'true';
    const branchId = searchParams.get('branchId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const minimal = searchParams.get('minimal') === 'true'; // Ultra-lightweight mode

    // Pagination
    const skip = (page - 1) * pageSize;

    // Generate cache key
    const cacheKey = `menu:items:optimized:${category || 'all'}:${active || 'all'}:${includeVariants ? 'variants' : 'no-variants'}:${includeRecipes ? 'recipes' : 'no-recipes'}:${minimal ? 'minimal' : 'full'}:${branchId || 'all-branches'}:page-${page}:size-${pageSize}`;

    const result = await getCached(cacheKey, async () => {
      // Build where clause
      const whereClause: any = {
        ...(category && category !== 'all' ? { category } : {}),
        ...(active !== null ? { isActive: active === 'true' } : {}),
      };

      // For minimal mode (POS), only fetch essential fields
      const selectFields: any = {
        id: true,
        name: true,
        category: true,
        categoryId: true,
        price: true,
        taxRate: true,
        isActive: true,
        sortOrder: true,
        hasVariants: true,
        imagePath: true,
      };

      // Only include category relation if not minimal mode
      if (!minimal) {
        selectFields.categoryRel = {
          select: {
            id: true,
            name: true,
            sortOrder: true,
            imagePath: true,
          },
        };
      }

      // Only include branch assignments if filtering by branch
      if (branchId) {
        selectFields.branchAssignments = {
          select: { branchId: true },
        };
      }

      // Fetch menu items with pagination
      const [items, totalCount] = await Promise.all([
        db.menuItem.findMany({
          where: whereClause,
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
          select: selectFields,
          take: pageSize,
          skip,
        }),
        db.menuItem.count({ where: whereClause }),
      ]);

      // Filter by branch if needed
      let filteredItems = items;
      if (branchId) {
        filteredItems = items.filter((item: any) => {
          const branchAssignments = item.branchAssignments || [];
          return branchAssignments.length === 0 || branchAssignments.some((ba: any) => ba.branchId === branchId);
        });
      }

      // Return with pagination metadata
      return {
        items: filteredItems,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasMore: page * pageSize < totalCount,
        },
      };
    }, 300000); // 5 minute cache

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('Get menu items error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

/**
 * Lightweight Menu Items for POS -专门为POS优化的轻量级端点
 * This endpoint only returns essential data needed for the POS interface
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a lightweight request
    if (body.action === 'lightweight') {
      const { branchId, category } = body;

      const items = await db.menuItem.findMany({
        where: {
          isActive: true,
          ...(category && category !== 'all' ? { category } : {}),
          ...(branchId ? {
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
          imagePath: true,
          categoryRel: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              imagePath: true,
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      });

      return NextResponse.json({
        success: true,
        menuItems: items,
      });
    }

    // Original POST logic for creating items
    const { name, category, categoryId, price, taxRate, isActive, sortOrder, hasVariants, branchIds, imagePath } = body;

    if (!name || !price) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, price' },
        { status: 400 }
      );
    }

    // Validate categoryId if provided
    let validCategoryId = null;
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        );
      }
      validCategoryId = categoryId;
    }

    // Validate branchIds if provided
    let validBranchIds: string[] = [];
    if (branchIds && Array.isArray(branchIds) && branchIds.length > 0) {
      if (!branchIds.includes('all')) {
        const branches = await db.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true },
        });
        validBranchIds = branches.map(b => b.id);
      }
    }

    // Create menu item
    const menuItem = await db.menuItem.create({
      data: {
        name,
        category: category || 'Other',
        categoryId: validCategoryId,
        price: parseFloat(price),
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : 0.14,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder !== undefined && sortOrder !== '' ? parseInt(sortOrder) : null,
        hasVariants: hasVariants !== undefined ? hasVariants : false,
        imagePath: imagePath || null,
      },
    });

    // Create branch assignments if specific branches are selected
    if (validBranchIds.length > 0) {
      await db.menuItemBranch.createMany({
        data: validBranchIds.map(branchId => ({
          menuItemId: menuItem.id,
          branchId,
        })),
        skipDuplicates: true,
      });
    }

    // Invalidate cache
    invalidateCachePattern('^menu:items:');

    return NextResponse.json({
      success: true,
      menuItem,
    });
  } catch (error: any) {
    console.error('Menu item POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process menu item request', details: error.message },
      { status: 500 }
    );
  }
}

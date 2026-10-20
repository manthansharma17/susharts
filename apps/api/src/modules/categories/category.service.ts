import { prisma } from '@susharts/db';
import type { CategoryTreeNode } from '@susharts/shared';

/**
 * Returns the non-archived category tree: root categories with their children,
 * ordered by position. This is the storefront navigation tree.
 */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const roots = await prisma.category.findMany({
    where: { parentId: null, isArchived: false },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      position: true,
      children: {
        where: { isArchived: false },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          imageUrl: true,
          position: true,
        },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { position: 'asc' },
  });

  return roots;
}

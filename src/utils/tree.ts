/**
 * Tree traversal and manipulation utilities
 * Provides helpers for working with hierarchical tree structures
 */

export interface TreeNode<T = any> {
  id: string;
  parentId: string | null;
  children?: TreeNode<T>[];
  data?: T;
}

/**
 * Build a tree structure from flat array of nodes
 * @param nodes - Flat array of nodes with id and parentId
 * @param rootParentId - Parent ID to use as root (default: null)
 * @returns Array of root nodes with children populated
 */
export function buildTree<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  rootParentId: string | null = null,
): T[] {
  const nodeMap = new Map<string, T & { children?: T[] }>();
  const roots: (T & { children?: T[] })[] = [];

  // First pass: create map of all nodes
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Second pass: build tree structure
  nodes.forEach((node) => {
    const currentNode = nodeMap.get(node.id)!;
    if (node.parentId === rootParentId) {
      roots.push(currentNode);
    } else if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(currentNode);
      }
    }
  });

  return roots;
}

/**
 * Flatten a tree structure into an array
 * @param roots - Array of root nodes
 * @param includeDepth - Whether to include depth information
 * @returns Flat array of nodes with optional depth
 */
export function flattenTree<T extends { id: string; children?: T[] }>(
  roots: T[],
  includeDepth = false,
): (T & { depth?: number })[] {
  const result: (T & { depth?: number })[] = [];

  function traverse(node: T, depth = 0) {
    const { children, ...rest } = node;
    result.push(
      includeDepth ? { ...rest, depth, children } as T & { depth: number } : node,
    );
    if (children && children.length > 0) {
      children.forEach((child) => traverse(child, depth + 1));
    }
  }

  roots.forEach((root) => traverse(root));
  return result;
}

/**
 * Find a node in tree by ID
 * @param roots - Array of root nodes
 * @param id - ID to search for
 * @returns Found node or undefined
 */
export function findNodeById<T extends { id: string; children?: T[] }>(
  roots: T[],
  id: string,
): T | undefined {
  function search(nodes: T[]): T | undefined {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = search(node.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  return search(roots);
}

/**
 * Get all parent IDs for a given node
 * @param nodes - Flat array of nodes
 * @param nodeId - ID of node to get parents for
 * @returns Array of parent IDs from root to immediate parent
 */
export function getParentChain<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  nodeId: string,
): string[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const parents: string[] = [];

  let currentNode = nodeMap.get(nodeId);
  while (currentNode?.parentId) {
    parents.unshift(currentNode.parentId);
    currentNode = nodeMap.get(currentNode.parentId);
  }

  return parents;
}

/**
 * Get all descendants of a node
 * @param nodes - Flat array of nodes
 * @param parentId - ID of parent node
 * @returns Array of all descendant nodes
 */
export function getDescendants<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  parentId: string,
): T[] {
  const descendants: T[] = [];
  const children = nodes.filter((n) => n.parentId === parentId);

  children.forEach((child) => {
    descendants.push(child);
    descendants.push(...getDescendants(nodes, child.id));
  });

  return descendants;
}

/**
 * Check if a node is an ancestor of another node
 * @param nodes - Flat array of nodes
 * @param ancestorId - Potential ancestor ID
 * @param descendantId - Potential descendant ID
 * @returns True if ancestorId is an ancestor of descendantId
 */
export function isAncestor<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  ancestorId: string,
  descendantId: string,
): boolean {
  const parentChain = getParentChain(nodes, descendantId);
  return parentChain.includes(ancestorId);
}

/**
 * Get siblings of a node
 * @param nodes - Flat array of nodes
 * @param nodeId - ID of node to get siblings for
 * @param includeSelf - Whether to include the node itself
 * @returns Array of sibling nodes
 */
export function getSiblings<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  nodeId: string,
  includeSelf = false,
): T[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    return [];
  }

  const siblings = nodes.filter((n) => n.parentId === node.parentId);
  return includeSelf ? siblings : siblings.filter((n) => n.id !== nodeId);
}

/**
 * Get depth of a node in the tree
 * @param nodes - Flat array of nodes
 * @param nodeId - ID of node
 * @returns Depth of node (0 for root nodes)
 */
export function getNodeDepth<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  nodeId: string,
): number {
  return getParentChain(nodes, nodeId).length;
}

/**
 * Sort tree nodes by a custom comparator
 * @param roots - Array of root nodes
 * @param comparator - Comparison function
 * @returns Sorted tree (mutates original)
 */
export function sortTree<T extends { id: string; children?: T[] }>(
  roots: T[],
  comparator: (a: T, b: T) => number,
): T[] {
  roots.sort(comparator);
  roots.forEach((root) => {
    if (root.children && root.children.length > 0) {
      sortTree(root.children, comparator);
    }
  });
  return roots;
}

/**
 * Map over tree nodes
 * @param roots - Array of root nodes
 * @param mapper - Mapping function
 * @returns New tree with mapped nodes
 */
export function mapTree<T extends { children?: T[] }, R extends { children?: R[] }>(
  roots: T[],
  mapper: (node: T, depth: number) => R,
): R[] {
  function traverse(node: T, depth = 0): R {
    const mapped = mapper(node, depth);
    if (node.children && node.children.length > 0) {
      mapped.children = node.children.map((child) => traverse(child, depth + 1));
    }
    return mapped;
  }

  return roots.map((root) => traverse(root));
}

/**
 * Filter tree nodes
 * @param roots - Array of root nodes
 * @param predicate - Filter function
 * @param keepParents - Whether to keep parent nodes if any descendant matches
 * @returns Filtered tree
 */
export function filterTree<T extends { children?: T[] }>(
  roots: T[],
  predicate: (node: T) => boolean,
  keepParents = true,
): T[] {
  function traverse(node: T): T | null {
    const matches = predicate(node);
    let filteredChildren: T[] = [];

    if (node.children && node.children.length > 0) {
      filteredChildren = node.children
        .map((child) => traverse(child))
        .filter((child): child is T => child !== null);
    }

    if (matches || (keepParents && filteredChildren.length > 0)) {
      return {
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : undefined,
      } as T;
    }

    return null;
  }

  return roots
    .map((root) => traverse(root))
    .filter((root): root is T => root !== null);
}

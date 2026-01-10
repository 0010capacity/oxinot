import { PageData } from "@/stores/pageStore";

/**
 * Builds the full hierarchical path for a page
 * Example: "Workspace/Daily Notes/2024-01-15"
 */
export const buildPagePath = (
  pageId: string,
  pagesById: Record<string, PageData>,
): string => {
  const page = pagesById[pageId];
  if (!page) return "";

  if (page.parentId) {
    const parentPath = buildPagePath(page.parentId, pagesById);
    return parentPath ? `${parentPath}/${page.title}` : page.title;
  }

  return page.title;
};

/**
 * Finds a page by its full hierarchical path
 * Example: "Workspace/Daily Notes/2024-01-15"
 */
export const findPageByPath = (
  fullPath: string,
  pageIds: string[],
  pagesById: Record<string, PageData>,
): string | undefined => {
  return pageIds.find((id) => buildPagePath(id, pagesById) === fullPath);
};

/**
 * Builds the parent path (breadcrumb) for a page
 * Returns an array of parent names and their IDs
 */
export const buildPageBreadcrumb = (
  pageId: string,
  pagesById: Record<string, PageData>,
): { names: string[]; ids: string[] } => {
  const parentNames: string[] = [];
  const pagePathIds: string[] = [];

  const buildParentPath = (id: string) => {
    const page = pagesById[id];
    if (!page) return;

    if (page.parentId) {
      buildParentPath(page.parentId);
      const parentPage = pagesById[page.parentId];
      if (parentPage) {
        parentNames.push(parentPage.title);
        pagePathIds.push(page.parentId);
      }
    }
  };

  buildParentPath(pageId);
  pagePathIds.push(pageId);

  return { names: parentNames, ids: pagePathIds };
};

/**
 * Creates pages along a path, creating intermediate pages if needed
 * Returns the ID of the final page in the path
 */
export const createPageHierarchy = async (
  fullPath: string,
  createPageFn: (title: string, parentId?: string) => Promise<string>,
  findPageFn: (path: string) => string | undefined,
): Promise<string | null> => {
  const pathParts = fullPath.split("/");
  let parentId: string | undefined = undefined;

  for (let i = 0; i < pathParts.length; i++) {
    const currentPath = pathParts.slice(0, i + 1).join("/");

    const existingPage = findPageFn(currentPath);

    if (existingPage) {
      parentId = existingPage;
    } else {
      try {
        const newPageId = await createPageFn(pathParts[i], parentId);
        parentId = newPageId;
      } catch (error) {
        console.error(`Failed to create page "${pathParts[i]}":`, error);
        return null;
      }
    }
  }

  return parentId || null;
};

import { invoke } from "@tauri-apps/api/core";
import { useBlockStore } from "../stores/blockStore";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

export function normalizeWikiTitle(input: string): string {
  return (input ?? "").trim().replace(/\s+/g, " ");
}

export function splitWikiPathSegments(input: string): string[] {
  // Folder-style wiki links: [[A/B/C]] where each segment is a folder-note/page.
  // Normalize whitespace per segment and remove empties.
  return (input ?? "")
    .split("/")
    .map((s) => normalizeWikiTitle(s))
    .filter((s) => s.length > 0);
}

export function parseWikiLinkTarget(raw: string): { noteTitle: string } | null {
  // Support:
  // - [[note]]
  // - [[note|alias]]
  // - [[note#heading]]
  // - [[note#^block-id]]
  // - [[A/B/C]] (folder-style path where parents must exist as folder-notes)
  //
  // Navigation target is the note title/path segment (before | or #)
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const beforeAlias = trimmed.split("|")[0] ?? "";
  const beforeAnchor = beforeAlias.split("#")[0] ?? "";
  const noteTitle = normalizeWikiTitle(beforeAnchor);

  if (!noteTitle) return null;
  return { noteTitle };
}

export async function openOrCreateNoteByTitle(
  noteTitle: string,
): Promise<void> {
  const rawTitleOrPath = normalizeWikiTitle(noteTitle);
  if (!rawTitleOrPath) return;

  const pageStore = usePageStore.getState();
  const viewStore = useViewStore.getState();
  const blockStore = useBlockStore.getState();

  // Ensure pages are loaded (needed for reliable folder chain + breadcrumb building)
  if (pageStore.pageIds.length === 0) {
    try {
      await pageStore.loadPages();
    } catch {
      // If load fails, fall through; create/convert/open may still throw.
    }
  }

  const targetSegments = splitWikiPathSegments(rawTitleOrPath);
  const isPath = targetSegments.length >= 2;

  // Find existing page by (title + optional parent) match
  const findExisting = (
    title: string,
    parentId: string | null,
    pagesById: typeof pageStore.pagesById,
    pageIds: string[],
  ): string | null => {
    const t = title.toLowerCase();
    for (const id of pageIds) {
      const p = pagesById[id];
      if (!p) continue;
      if ((p.title ?? "").toLowerCase() !== t) continue;
      const pid = p.parentId ?? null;
      if (pid === parentId) return p.id;
    }
    return null;
  };

  // Ensure a folder-note exists (and isDirectory=true). Return its pageId.
  const ensureFolderNote = async (
    folderTitle: string,
    parentId: string | null,
  ): Promise<string> => {
    // Re-read state each time to avoid stale copies after loadPages()
    let { pagesById, pageIds } = usePageStore.getState();
    let existingId = findExisting(folderTitle, parentId, pagesById, pageIds);

    if (!existingId) {
      existingId = await pageStore.createPage(
        folderTitle,
        parentId ?? undefined,
      );
      await pageStore.loadPages();
      ({ pagesById, pageIds } = usePageStore.getState());
    }

    const existing = pagesById[existingId];
    if (!existing) return existingId;

    if (!existing.isDirectory) {
      // Folder notes are directories in this app: convert so children live under it.
      await pageStore.convertToDirectory(existingId);
      await pageStore.loadPages();
    }

    return existingId;
  };

  // If it's a folder path, ensure chain A -> B -> ... exists as folder-notes.
  let parentId: string | null = null;

  if (isPath) {
    for (let i = 0; i < targetSegments.length - 1; i++) {
      const seg = targetSegments[i];
      parentId = await ensureFolderNote(seg, parentId);
    }
  }

  // Now ensure/open the final note under the resolved parentId (or root).
  const finalTitle = isPath
    ? targetSegments[targetSegments.length - 1]
    : rawTitleOrPath;

  let { pagesById, pageIds } = usePageStore.getState();
  let pageId = findExisting(finalTitle, parentId, pagesById, pageIds);

  if (!pageId) {
    pageId = await pageStore.createPage(finalTitle, parentId ?? undefined);
    await pageStore.loadPages();
    ({ pagesById, pageIds } = usePageStore.getState());
  } else {
    // Keep state fresh for breadcrumb calculation below
    ({ pagesById } = usePageStore.getState());
  }

  const page = pagesById[pageId];
  if (!page) return;

  // Build parent path for breadcrumb:
  // workspace > parent chain > current page
  const parentNames: string[] = [];
  const pagePathIds: string[] = [];

  let currentParentId: string | undefined = page.parentId;
  while (currentParentId) {
    const parent = pagesById[currentParentId];
    if (!parent) break;
    parentNames.unshift(parent.title);
    pagePathIds.unshift(parent.id);
    currentParentId = parent.parentId;
  }
  pagePathIds.push(page.id);

  // Select + load + open (breadcrumb updated via openNote)
  pageStore.setCurrentPageId(page.id);
  pageStore.selectPage(page.id);
  await blockStore.loadPage(page.id);
  viewStore.openNote(page.id, page.title, parentNames, pagePathIds);
}

export async function navigateToBlockById(blockId: string): Promise<void> {
  const id = (blockId ?? "").trim();
  if (!id) return;

  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) return;

  // Ask backend for the block + its ancestor chain (for zoomPath),
  // so we can navigate without guessing based on currently loaded page.
  let blockWithPath: {
    block: { pageId: string };
    ancestorIds: string[];
  } | null = null;
  try {
    blockWithPath = await invoke("get_block", {
      workspacePath,
      request: { block_id: id },
    });
  } catch {
    blockWithPath = null;
  }
  if (!blockWithPath?.block) return;

  const pageStore = usePageStore.getState();
  const viewStore = useViewStore.getState();
  const blockStore = useBlockStore.getState();

  // Ensure pages exist for breadcrumb calculation
  if (pageStore.pageIds.length === 0) {
    try {
      await pageStore.loadPages();
    } catch {
      // ignore
    }
  }

  const pageId = blockWithPath.block.pageId as string;
  const pagesById = usePageStore.getState().pagesById;
  const page = pagesById[pageId];
  if (!page) return;

  // Build parent path for page breadcrumb
  const parentNames: string[] = [];
  const pagePathIds: string[] = [];
  let currentParentId: string | undefined = page.parentId;

  while (currentParentId) {
    const parent = pagesById[currentParentId];
    if (!parent) break;
    parentNames.unshift(parent.title);
    pagePathIds.unshift(parent.id);
    currentParentId = parent.parentId;
  }
  pagePathIds.push(page.id);

  // Open the page
  pageStore.setCurrentPageId(page.id);
  pageStore.selectPage(page.id);
  await blockStore.loadPage(page.id);
  viewStore.openNote(page.id, page.title, parentNames, pagePathIds);

  // Zoom to the referenced block
  const ancestorIds: string[] = Array.isArray(blockWithPath.ancestorIds)
    ? blockWithPath.ancestorIds
    : [];
  useViewStore.setState({
    focusedBlockId: id,
    zoomPath: ancestorIds.length ? ancestorIds : [id],
  });
}

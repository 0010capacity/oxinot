import { createPageTool } from "./createPageTool";
import { createPageWithBlocksTool } from "./createPageWithBlocksTool";
import { deletePageTool } from "./deletePageTool";
import { listPagesTool } from "./listPagesTool";
import { movePageTool } from "./movePageTool";
import { openPageTool } from "./openPageTool";
import { queryPagesTool } from "./queryPagesTool";
import { updatePageTitleTool } from "./updatePageTitleTool";

export {
  createPageTool,
  createPageWithBlocksTool,
  deletePageTool,
  listPagesTool,
  movePageTool,
  openPageTool,
  queryPagesTool,
  updatePageTitleTool,
};

export const pageTools = [
  openPageTool,
  queryPagesTool,
  listPagesTool,
  createPageTool,
  createPageWithBlocksTool,
  deletePageTool,
  updatePageTitleTool,
  movePageTool,
];

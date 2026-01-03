declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";

  export interface TaskListOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  const plugin: (md: MarkdownIt, options?: TaskListOptions) => void;
  export default plugin;
}

declare module "markdown-it-footnote" {
  import type MarkdownIt from "markdown-it";

  const plugin: (md: MarkdownIt, options?: unknown) => void;
  export default plugin;
}

import { useAIJobsStore } from "@/stores/aiJobsStore";
import type { AIProvider } from "@/stores/aiSettingsStore";
import { useAISettingsStore } from "@/stores/aiSettingsStore";
import { useBlockStore } from "@/stores/blockStore";
import { useBlockUIStore } from "@/stores/blockUIStore";
import { usePageStore } from "@/stores/pageStore";
import { useThreadStore } from "@/stores/threadStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { AgentOrchestrator } from "./agent/orchestrator";
import { createAIProvider } from "./factory";
import { parseMentions } from "./mentions/parser";
import { blockTools } from "./tools/block";
import { contextTools } from "./tools/context";
import { pageTools } from "./tools/page";
import { toolRegistry } from "./tools/registry";
import type { ChatMessage } from "./types";

export interface ThreadExecutionContext {
  workspacePath: string;
  currentPageId: string;
  promptBlockId: string;
  threadId: string;
}

export class ThreadBlockService {
  private static instance: ThreadBlockService | null = null;
  private orchestrators: Map<string, AgentOrchestrator> = new Map();

  static getInstance(): ThreadBlockService {
    if (!ThreadBlockService.instance) {
      ThreadBlockService.instance = new ThreadBlockService();
    }
    return ThreadBlockService.instance;
  }

  constructor() {
    this.registerTools();
  }

  private registerTools(): void {
    try {
      if (!toolRegistry.has("get_block")) {
        toolRegistry.registerMany(blockTools);
      }
      if (!toolRegistry.has("open_page")) {
        toolRegistry.registerMany(pageTools);
      }
      if (!toolRegistry.has("get_current_context")) {
        toolRegistry.registerMany(contextTools);
      }
    } catch (e) {
      console.warn("[ThreadBlockService] Tools registration error:", e);
    }
  }

  async executePrompt(
    promptBlockId: string,
    promptText: string,
    pageId: string,
  ): Promise<string | null> {
    console.log("[ThreadBlockService] executePrompt called", {
      promptBlockId,
      promptText: promptText.slice(0, 50),
      pageId,
    });

    const aiJobsStore = useAIJobsStore.getState();
    const job = aiJobsStore.createJob({
      prompt: promptText,
      mode: "create",
      targetBlockIds: [promptBlockId],
    });

    if (!job) {
      console.log(
        "[ThreadBlockService] Job creation blocked (duplicate or locked)",
      );
      return null;
    }

    const { provider, apiKey, baseUrl, temperature, models } =
      useAISettingsStore.getState();
    const activeModel = models[0] || "";

    console.log("[ThreadBlockService] AI settings", {
      provider,
      activeModel,
      hasApiKey: !!apiKey,
    });

    const threadId = useThreadStore
      .getState()
      .startThread(promptBlockId, activeModel, provider);

    aiJobsStore.setJobThreadId(job.id, threadId);
    aiJobsStore.updateJobStatus(job.id, "streaming");

    const workspacePath = useWorkspaceStore.getState().workspacePath;
    if (!workspacePath) {
      aiJobsStore.setJobError(job.id, "No workspace path available");
      throw new Error("No workspace path available");
    }

    const blockStore = useBlockStore.getState();
    const responseBlockId = await blockStore.createBlock(
      promptBlockId,
      "",
      pageId,
    );

    console.log("[ThreadBlockService] Created response block", {
      responseBlockId,
      parentId: promptBlockId,
    });

    if (responseBlockId) {
      useThreadStore.getState().setResponseBlock(threadId, responseBlockId);
    }

    const context: ThreadExecutionContext = {
      workspacePath,
      currentPageId: pageId,
      promptBlockId,
      threadId,
    };

    this.runExecution(
      threadId,
      promptText,
      context,
      provider,
      activeModel,
      apiKey,
      baseUrl,
      temperature,
      responseBlockId || undefined,
      job.id,
    ).catch((error) => {
      console.error("[ThreadBlockService] Execution error:", error);
      useThreadStore.getState().failThread(threadId, String(error));
      aiJobsStore.setJobError(job.id, String(error));
    });

    return threadId;
  }

  private async runExecution(
    threadId: string,
    promptText: string,
    context: ThreadExecutionContext,
    provider: string,
    model: string,
    apiKey: string | undefined,
    baseUrl: string | undefined,
    temperature: number | undefined,
    responseBlockId: string | undefined,
    jobId: string,
  ): Promise<void> {
    const threadStore = useThreadStore.getState();
    const blockStore = useBlockStore.getState();
    const aiJobsStore = useAIJobsStore.getState();

    try {
      const aiProvider = createAIProvider(
        provider as AIProvider,
        baseUrl || "",
      );
      aiProvider.id = provider;

      const enrichedGoal = this.buildEnrichedGoal(promptText, context);

      const orchestrator = new AgentOrchestrator(aiProvider);
      this.orchestrators.set(threadId, orchestrator);

      const toolContext = {
        workspacePath: context.workspacePath,
        currentPageId: context.currentPageId,
        focusedBlockId: context.promptBlockId,
        selectedBlockIds: [],
      };

      let finalContent = "";

      for await (const step of orchestrator.execute(enrichedGoal, {
        maxIterations: 8,
        verbose: true,
        context: toolContext,
        apiKey,
        baseUrl,
        model,
        temperature,
      })) {
        console.log("[ThreadBlockService] Step:", step.type);

        if (step.type === "final_answer" && step.content) {
          finalContent = step.content;
          threadStore.setStreamContent(threadId, finalContent);

          console.log("[ThreadBlockService] Got final_answer", {
            contentLength: finalContent.length,
            responseBlockId,
          });

          if (responseBlockId) {
            console.log("[ThreadBlockService] Updating block content");
            await blockStore.updateBlockContent(responseBlockId, finalContent);
            console.log("[ThreadBlockService] Block content updated");
          }
        }
      }

      const finalState = orchestrator.getState();

      if (finalState.status === "failed") {
        const errorMsg = finalState.error || "Unknown error";
        threadStore.failThread(threadId, errorMsg);
        aiJobsStore.setJobError(jobId, errorMsg);

        if (responseBlockId) {
          await blockStore.updateBlockContent(
            responseBlockId,
            `Error: ${errorMsg}`,
          );
          await blockStore.updateBlock(responseBlockId, {
            blockType: "bullet",
          });
        }
      } else {
        threadStore.completeThread(threadId);

        if (responseBlockId && finalContent) {
          await blockStore.updateBlockContent(responseBlockId, finalContent);
          await blockStore.updateBlock(responseBlockId, {
            blockType: "bullet",
          });
        }

        aiJobsStore.completeJob(jobId);
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Execution failed";
      threadStore.failThread(threadId, errorMsg);
      aiJobsStore.setJobError(jobId, errorMsg);

      if (responseBlockId) {
        await blockStore.updateBlockContent(
          responseBlockId,
          `Error: ${errorMsg}`,
        );
        await blockStore.updateBlock(responseBlockId, {
          blockType: "bullet",
        });
      }
    } finally {
      this.orchestrators.delete(threadId);
    }
  }

  private buildEnrichedGoal(
    promptText: string,
    context: ThreadExecutionContext,
  ): string {
    const resolvedContext = this.resolveContextFromMentions(promptText);

    const pageContext = this.buildPageContext(context.currentPageId);

    let enrichedGoal = promptText;

    if (pageContext) {
      enrichedGoal += `\n\n--- Current Page Context ---\n${pageContext}`;
    }

    if (resolvedContext) {
      enrichedGoal += `\n\n--- Context from Mentions ---\n${resolvedContext}`;
    }

    return enrichedGoal;
  }

  private buildPageContext(pageId: string): string {
    const blockStore = useBlockStore.getState();
    const pageStore = usePageStore.getState();

    const page = pageStore.pagesById[pageId];
    if (!page) return "";

    const rootBlockIds = blockStore.getRootBlockIds();
    if (rootBlockIds.length === 0) return "";

    const blocks: string[] = [];

    const collectBlocks = (blockIds: string[], depth = 0) => {
      for (const id of blockIds) {
        const block = blockStore.blocksById[id];
        if (!block) continue;

        if (block.blockType !== "ai-response") {
          const indent = "  ".repeat(depth);
          blocks.push(`${indent}- ${block.content}`);
        }

        const children = blockStore.getChildren(id);
        if (children.length > 0) {
          collectBlocks(children, depth + 1);
        }
      }
    };

    collectBlocks(rootBlockIds);

    return `Page: "${page.title}"\n\nContent:\n${blocks.join("\n")}`;
  }

  private resolveContextFromMentions(text: string): string {
    const mentions = parseMentions(text);
    const blockStore = useBlockStore.getState();
    const uiStore = useBlockUIStore.getState();
    const pageStore = usePageStore.getState();

    let contextString = "";
    const processedIds = new Set<string>();

    for (const m of mentions) {
      if (m.type === "current") {
        const focusedId = uiStore.focusedBlockId;
        if (focusedId && !processedIds.has(focusedId)) {
          const block = blockStore.blocksById[focusedId];
          if (block) {
            contextString += `\n[Current Focused Block]\n${block.content}\n`;
            processedIds.add(focusedId);
          }
        }
      } else if (m.type === "selection") {
        const selectedIds = uiStore.selectedBlockIds;
        if (selectedIds.length > 0) {
          contextString += "\n[Selected Blocks]\n";
          for (const id of selectedIds) {
            if (!processedIds.has(id)) {
              const block = blockStore.blocksById[id];
              if (block) {
                contextString += `- ${block.content}\n`;
                processedIds.add(id);
              }
            }
          }
        }
      } else if (m.type === "block" && m.uuid) {
        if (!processedIds.has(m.uuid)) {
          const block = blockStore.blocksById[m.uuid];
          if (block) {
            contextString += `\n[Block ${m.uuid}]\n${block.content}\n`;
            processedIds.add(m.uuid);
          }
        }
      } else if (m.type === "page" && m.uuid) {
        if (!processedIds.has(m.uuid)) {
          const page = pageStore.pagesById[m.uuid];
          if (page) {
            contextString += `\n[Page "${page.title}"]\n(Page ID: ${m.uuid})\n`;
            processedIds.add(m.uuid);
          }
        }
      }
    }

    return contextString;
  }

  cancelThread(threadId: string): void {
    const orchestrator = this.orchestrators.get(threadId);
    if (orchestrator) {
      orchestrator.stop();
      this.orchestrators.delete(threadId);
    }
    useThreadStore.getState().cancelThread(threadId);

    // Also update aiJobsStore to keep both sides in sync
    const aiJobsStore = useAIJobsStore.getState();
    const job = aiJobsStore.getJobByThread(threadId);
    if (
      job &&
      job.status !== "done" &&
      job.status !== "error" &&
      job.status !== "cancelled"
    ) {
      aiJobsStore.cancelJob(job.id);
    }
  }

  buildThreadHistory(promptBlockId: string): ChatMessage[] {
    const blockStore = useBlockStore.getState();
    const messages: ChatMessage[] = [];

    const collectThreadBlocks = (blockId: string) => {
      const block = blockStore.blocksById[blockId];
      if (!block) return;

      if (block.blockType === "ai-prompt") {
        messages.push({ role: "user", content: block.content });
      } else if (block.blockType === "ai-response") {
        messages.push({ role: "assistant", content: block.content });
      }

      const children = blockStore.getChildren(blockId);
      for (const childId of children) {
        collectThreadBlocks(childId);
      }
    };

    collectThreadBlocks(promptBlockId);

    return messages;
  }
}

export const threadBlockService = ThreadBlockService.getInstance();

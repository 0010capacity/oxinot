import type { AIProvider } from "@/stores/aiSettingsStore";
import { useAISettingsStore } from "@/stores/aiSettingsStore";
import { useBlockStore } from "@/stores/blockStore";
import { useBlockUIStore } from "@/stores/blockUIStore";
import type { SessionId } from "@/stores/chatStore";
import { useChatStore } from "@/stores/chatStore";
import { usePageStore } from "@/stores/pageStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  type AgentRunConfig,
  type AgentRunEvent,
  getAgentRunService,
} from "./agent/agentRunService";
import { parseMentions } from "./mentions/parser";
import type { ToolContext } from "./tools/types";

export class ChatService {
  private static instance: ChatService | null = null;
  private abortController: AbortController | null = null;

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async sendMessage(sessionId: SessionId, userMessage: string): Promise<void> {
    const chatStore = useChatStore.getState();
    const aiSettings = useAISettingsStore.getState();
    const workspaceStore = useWorkspaceStore.getState();

    const { provider, apiKey, baseUrl, temperature, models } = aiSettings;
    const activeModel = models[0] || "";
    const workspacePath = workspaceStore.workspacePath;

    if (!workspacePath) {
      chatStore.failStreaming(sessionId, "No workspace path available");
      return;
    }

    chatStore.addMessage(sessionId, { role: "user", content: userMessage });

    const runId = `run_${Date.now()}`;
    chatStore.startStreaming(sessionId, runId);

    this.abortController = new AbortController();

    const toolContext: ToolContext = {
      workspacePath,
      currentPageId: useBlockStore.getState().currentPageId || undefined,
      focusedBlockId: useBlockUIStore.getState().focusedBlockId || undefined,
      selectedBlockIds: useBlockUIStore.getState().selectedBlockIds,
    };

    const enrichedGoal = this.buildEnrichedGoal(userMessage, toolContext);

    const config: AgentRunConfig = {
      goal: enrichedGoal,
      context: toolContext,
      provider: provider as AIProvider,
      model: activeModel,
      apiKey,
      baseUrl,
      temperature,
      abortSignal: this.abortController.signal,
    };

    const agentRunService = getAgentRunService();
    let lastToolName = "";

    const onEvent = (event: AgentRunEvent) => {
      switch (event.type) {
        case "streaming":
          chatStore.appendStreamContent(sessionId, event.delta);
          break;

        case "tool_call":
          lastToolName = event.toolName;
          chatStore.addStreamingToolCall(sessionId, {
            toolName: event.toolName,
            params: event.params,
          });
          break;

        case "tool_result":
          chatStore.completeToolCall(sessionId, lastToolName, event.result);
          break;

        case "done":
          chatStore.finishStreaming(sessionId);
          this.maybeGenerateTitle(sessionId);
          break;

        case "error":
          chatStore.failStreaming(sessionId, event.error);
          break;
      }
    };

    try {
      await agentRunService.run(config, onEvent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      chatStore.failStreaming(sessionId, errorMsg);
    } finally {
      this.abortController = null;
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private buildEnrichedGoal(promptText: string, context: ToolContext): string {
    const resolvedContext = this.resolveContextFromMentions(
      promptText,
      context,
    );

    let enrichedGoal = promptText;

    if (resolvedContext) {
      enrichedGoal += `\n\n--- Context from Mentions ---\n${resolvedContext}`;
    }

    return enrichedGoal;
  }

  private resolveContextFromMentions(
    text: string,
    context: ToolContext,
  ): string {
    const mentions = parseMentions(text);
    const blockStore = useBlockStore.getState();
    const pageStore = usePageStore.getState();

    let contextString = "";
    const processedIds = new Set<string>();

    for (const m of mentions) {
      if (m.type === "current" && context.focusedBlockId) {
        if (!processedIds.has(context.focusedBlockId)) {
          const block = blockStore.blocksById[context.focusedBlockId];
          if (block) {
            contextString += `\n[Current Focused Block]\n${block.content}\n`;
            processedIds.add(context.focusedBlockId);
          }
        }
      } else if (
        m.type === "selection" &&
        context.selectedBlockIds &&
        context.selectedBlockIds.length > 0
      ) {
        contextString += "\n[Selected Blocks]\n";
        for (const id of context.selectedBlockIds) {
          if (!processedIds.has(id)) {
            const block = blockStore.blocksById[id];
            if (block) {
              contextString += `- ${block.content}\n`;
              processedIds.add(id);
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

  private async maybeGenerateTitle(sessionId: SessionId): Promise<void> {
    const chatStore = useChatStore.getState();
    const session = chatStore.sessions[sessionId];

    if (!session || session.title !== "New Chat") return;

    const messages = chatStore.messagesBySession[sessionId];
    const userMessage = messages.find((m) => m.role === "user");
    if (!userMessage) return;

    const title = this.generateTitleFromMessage(userMessage.content);
    chatStore.updateSessionTitle(sessionId, title);
  }

  private generateTitleFromMessage(content: string): string {
    const cleaned = content.replace(/@\[[^\]]+\]\([^)]+\)/g, "").trim();
    const firstLine = cleaned.split("\n")[0];
    const truncated = firstLine.slice(0, 50);
    return truncated.length < firstLine.length ? `${truncated}...` : truncated;
  }
}

export const chatService = ChatService.getInstance();

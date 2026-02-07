/**
 * Advanced Analytics Tracker
 * Provides detailed insights into page access patterns, session tracking, and search analytics
 *
 * Features:
 * - Per-page hit patterns and timing analytics
 * - Session tracking with entry/exit times
 * - Search term frequency distribution and trending
 * - Time-based analytics (hourly, daily patterns)
 * - Data export (JSON/CSV formats)
 *
 * Usage:
 *   import { analyticsTracker } from '@/utils/analyticsTracker'
 *   analyticsTracker.trackPageView('workspace/page-id')
 *   analyticsTracker.trackSearch('query', resultsCount)
 *   analyticsTracker.getSessionSummary()
 *
 * Browser console:
 *   __analyticsTracker.getReport()        // Formatted analytics report
 *   __analyticsTracker.exportData('json') // Export data
 *   __analyticsTracker.getTopPages(10)    // Top 10 most viewed pages
 */

interface PageHitData {
  pageId: string;
  path: string;
  totalHits: number;
  uniqueSessions: number;
  avgTimeSpent: number;
  lastVisited: number;
  firstVisited: number;
  accessTimes: number[];
  referredFrom: Map<string, number>;
}

interface SearchTermData {
  term: string;
  frequency: number;
  lastUsed: number;
  firstUsed: number;
  avgResultsCount: number;
  accessCount: number;
  relatedPages: Map<string, number>;
}

interface SessionData {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  totalDuration: number;
  pagesViewed: string[];
  searchesPerformed: string[];
  pageVisitOrder: { pageId: string; timestamp: number }[];
}

interface AnalyticsSnapshot {
  timestamp: number;
  totalPageViews: number;
  uniquePagesViewed: number;
  uniqueSessions: number;
  totalSearches: number;
  uniqueSearchTerms: number;
  avgSessionDuration: number;
  topPages: PageHitData[];
  topSearches: SearchTermData[];
}

class AnalyticsTracker {
  private pageHits = new Map<string, PageHitData>();
  private searchTerms = new Map<string, SearchTermData>();
  private sessions = new Map<string, SessionData>();
  private currentSessionId: string | null = null;
  private currentSessionStartTime = 0;
  private pageViewTimestamps = new Map<string, number>();
  private sessionIdCounter = 0;
  private enabled = true;

  constructor() {
    this.initializeSession();
  }

  private initializeSession(): void {
    this.currentSessionId = `session-${++this.sessionIdCounter}-${Date.now()}`;
    this.currentSessionStartTime = Date.now();

    const newSession: SessionData = {
      sessionId: this.currentSessionId,
      startTime: this.currentSessionStartTime,
      endTime: null,
      totalDuration: 0,
      pagesViewed: [],
      searchesPerformed: [],
      pageVisitOrder: [],
    };

    this.sessions.set(this.currentSessionId, newSession);
  }

  trackPageView(pageId: string, path: string = pageId): void {
    if (!this.enabled) return;

    const now = Date.now();
    const currentPageId = Array.from(this.pageViewTimestamps.keys()).pop();

    if (currentPageId && this.pageViewTimestamps.has(currentPageId)) {
      const timeEntered = this.pageViewTimestamps.get(currentPageId);
      if (!timeEntered) return;

      const timeSpent = (now - timeEntered) / 1000;

      const pageData = this.pageHits.get(currentPageId);
      if (pageData) {
        pageData.avgTimeSpent =
          (pageData.avgTimeSpent * (pageData.totalHits - 1) + timeSpent) /
          pageData.totalHits;
      }
    }

    let pageData = this.pageHits.get(pageId);
    if (!pageData) {
      pageData = {
        pageId,
        path,
        totalHits: 0,
        uniqueSessions: 0,
        avgTimeSpent: 0,
        lastVisited: now,
        firstVisited: now,
        accessTimes: [],
        referredFrom: new Map(),
      };
      this.pageHits.set(pageId, pageData);
    }

    pageData.totalHits++;
    pageData.lastVisited = now;
    pageData.accessTimes.push(now);

    if (currentPageId) {
      pageData.referredFrom.set(
        currentPageId,
        (pageData.referredFrom.get(currentPageId) || 0) + 1,
      );
    }

    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session) {
        if (!session.pagesViewed.includes(pageId)) {
          session.pagesViewed.push(pageId);
        }
        session.pageVisitOrder.push({
          pageId,
          timestamp: now,
        });
      }
    }

    this.pageViewTimestamps.set(pageId, now);
  }

  trackSearch(query: string, resultsCount = 0, pageContext?: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    const normalizedQuery = query.toLowerCase().trim();

    let searchData = this.searchTerms.get(normalizedQuery);
    if (!searchData) {
      searchData = {
        term: normalizedQuery,
        frequency: 0,
        lastUsed: now,
        firstUsed: now,
        avgResultsCount: 0,
        accessCount: 0,
        relatedPages: new Map(),
      };
      this.searchTerms.set(normalizedQuery, searchData);
    }

    searchData.frequency++;
    searchData.lastUsed = now;
    searchData.avgResultsCount =
      (searchData.avgResultsCount * (searchData.frequency - 1) + resultsCount) /
      searchData.frequency;

    if (pageContext) {
      searchData.relatedPages.set(
        pageContext,
        (searchData.relatedPages.get(pageContext) || 0) + 1,
      );
    }

    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session) {
        session.searchesPerformed.push(normalizedQuery);
      }
    }
  }

  getPageStats(pageId: string): PageHitData | undefined {
    return this.pageHits.get(pageId);
  }

  getTopPages(limit = 10): PageHitData[] {
    return Array.from(this.pageHits.values())
      .sort((a, b) => b.totalHits - a.totalHits)
      .slice(0, limit);
  }

  getTopSearches(limit = 10): SearchTermData[] {
    return Array.from(this.searchTerms.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  getSessionSummary(): Partial<SessionData> | null {
    if (!this.currentSessionId) return null;

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return null;

    const now = Date.now();
    session.endTime = now;
    session.totalDuration = now - session.startTime;

    return {
      sessionId: session.sessionId,
      totalDuration: session.totalDuration,
      pagesViewed: session.pagesViewed,
      searchesPerformed: session.searchesPerformed,
    };
  }

  getSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  getTimeDistribution(pageId?: string): {
    hourly: Map<number, number>;
    daily: Map<number, number>;
  } {
    const hourly = new Map<number, number>();
    const daily = new Map<number, number>();

    const timestamps = pageId
      ? this.pageHits.get(pageId)?.accessTimes || []
      : Array.from(this.pageHits.values()).flatMap((p) => p.accessTimes);

    for (const ts of timestamps) {
      const date = new Date(ts);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      hourly.set(hour, (hourly.get(hour) || 0) + 1);
      daily.set(dayOfWeek, (daily.get(dayOfWeek) || 0) + 1);
    }

    return { hourly, daily };
  }

  getSnapshot(): AnalyticsSnapshot {
    const allPageViews = Array.from(this.pageHits.values()).reduce(
      (sum, p) => sum + p.totalHits,
      0,
    );
    const totalSearches = Array.from(this.searchTerms.values()).reduce(
      (sum, s) => sum + s.frequency,
      0,
    );

    let totalSessionDuration = 0;
    let sessionCount = 0;
    for (const session of this.sessions.values()) {
      if (session.endTime) {
        totalSessionDuration += session.totalDuration;
        sessionCount++;
      }
    }
    const avgSessionDuration =
      sessionCount > 0 ? totalSessionDuration / sessionCount : 0;

    return {
      timestamp: Date.now(),
      totalPageViews: allPageViews,
      uniquePagesViewed: this.pageHits.size,
      uniqueSessions: this.sessions.size,
      totalSearches,
      uniqueSearchTerms: this.searchTerms.size,
      avgSessionDuration,
      topPages: this.getTopPages(5),
      topSearches: this.getTopSearches(5),
    };
  }

  getReport(): string {
    const snapshot = this.getSnapshot();
    const topPages = this.getTopPages(5);
    const topSearches = this.getTopSearches(5);
    const avgDurationMs = snapshot.avgSessionDuration;
    const avgDurationSec = Math.round(avgDurationMs / 1000);

    let pagesList = "";
    for (const page of topPages) {
      const avgTimeSpent = page.avgTimeSpent.toFixed(1);
      pagesList += `║    ${page.path.padEnd(30)} │ ${String(
        page.totalHits,
      ).padEnd(4)} hits │ ${avgTimeSpent}s avg\n`;
    }

    let searchList = "";
    for (const search of topSearches) {
      const avgResults = search.avgResultsCount.toFixed(1);
      searchList += `║    "${search.term
        .substring(0, 28)
        .padEnd(28)}" │ ${String(search.frequency).padEnd(
        4,
      )} │ ${avgResults} results avg\n`;
    }

    return `
╔════════════════════════════════════════════════════════════════════╗
║              📊 ADVANCED ANALYTICS REPORT                          ║
╠════════════════════════════════════════════════════════════════════╣
║ 📈 SESSION OVERVIEW                                                ║
║    Total Sessions: ${String(snapshot.uniqueSessions).padEnd(
      5,
    )} │ Pages Viewed: ${String(snapshot.totalPageViews).padEnd(
      5,
    )} │ Searches: ${String(snapshot.totalSearches)}            ║
║    Avg Session Duration: ${String(avgDurationSec).padEnd(
      2,
    )}s                                  ║
║    Unique Pages: ${String(snapshot.uniquePagesViewed).padEnd(
      3,
    )} │ Unique Search Terms: ${String(snapshot.uniqueSearchTerms).padEnd(
      3,
    )}                 ║
║                                                                    ║
║ 🔝 TOP 5 PAGES                                                     ║
║    Page Name (Path)                    Hits  │ Avg Time          ║
║    ${pagesList.trim().split("\n").join("\n║    ")}  ║
║                                                                    ║
║ 🔍 TOP 5 SEARCHES                                                  ║
║    Search Term                       Freq. │ Avg Results       ║
║    ${searchList.trim().split("\n").join("\n║    ")}  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
    `.trim();
  }

  print(): void {
    console.log(this.getReport());
  }

  exportAsJSON(): string {
    const exportData = {
      timestamp: Date.now(),
      snapshot: this.getSnapshot(),
      pages: Array.from(this.pageHits.values()).map((p) => ({
        ...p,
        referredFrom: Object.fromEntries(p.referredFrom),
      })),
      searches: Array.from(this.searchTerms.values()).map((s) => ({
        ...s,
        relatedPages: Object.fromEntries(s.relatedPages),
      })),
      sessions: Array.from(this.sessions.values()),
    };

    return JSON.stringify(exportData, null, 2);
  }

  exportAsCSV(): string {
    const snapshot = this.getSnapshot();
    const pages = Array.from(this.pageHits.values());
    const searches = Array.from(this.searchTerms.values());

    let csv = "# Advanced Analytics Export\n";
    csv += `# Generated: ${new Date().toISOString()}\n\n`;

    csv += "## Summary\n";
    csv +=
      "Total Sessions,Total Page Views,Unique Pages,Unique Searches,Avg Session Duration (s)\n";
    csv += `${snapshot.uniqueSessions},${snapshot.totalPageViews},${
      snapshot.uniquePagesViewed
    },${snapshot.uniqueSearchTerms},${Math.round(
      snapshot.avgSessionDuration / 1000,
    )}\n\n`;

    csv += "## Page Views\n";
    csv +=
      "Page ID,Path,Total Hits,Unique Sessions,Avg Time Spent (s),First Visited,Last Visited\n";
    for (const page of pages) {
      csv += `"${page.pageId}","${page.path}",${page.totalHits},${
        page.uniqueSessions
      },${page.avgTimeSpent.toFixed(2)},${new Date(
        page.firstVisited,
      ).toISOString()},${new Date(page.lastVisited).toISOString()}\n`;
    }

    csv += "\n## Search Terms\n";
    csv += "Search Term,Frequency,Avg Results Count,First Used,Last Used\n";
    for (const search of searches) {
      csv += `"${search.term}",${
        search.frequency
      },${search.avgResultsCount.toFixed(2)},${new Date(
        search.firstUsed,
      ).toISOString()},${new Date(search.lastUsed).toISOString()}\n`;
    }

    return csv;
  }

  exportData(format: "json" | "csv" = "json"): string {
    if (format === "json") {
      return this.exportAsJSON();
    }
    if (format === "csv") {
      return this.exportAsCSV();
    }
    throw new Error(`Unsupported export format: ${format}`);
  }

  downloadExport(format: "json" | "csv" = "json"): void {
    const data = this.exportData(format);
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `oxinot-analytics-${timestamp}.${format}`;

    const blob = new Blob([data], {
      type: format === "json" ? "application/json" : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    console.log(`[analyticsTracker] 💾 Exported data to ${filename}`);
  }

  reset(): void {
    this.pageHits.clear();
    this.searchTerms.clear();
    this.sessions.clear();
    this.pageViewTimestamps.clear();
    this.sessionIdCounter = 0;
    this.initializeSession();
    console.log("[analyticsTracker] 🔄 Analytics data reset");
  }

  getStats() {
    return {
      pageHits: Array.from(this.pageHits.values()),
      searchTerms: Array.from(this.searchTerms.values()),
      sessions: Array.from(this.sessions.values()),
      snapshot: this.getSnapshot(),
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(
      `[analyticsTracker] ${enabled ? "✅" : "❌"} Analytics tracking ${
        enabled ? "enabled" : "disabled"
      }`,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const analyticsTracker = new AnalyticsTracker();

declare global {
  // eslint-disable-next-line no-var
  var __analyticsTracker: typeof analyticsTracker;
}

if (typeof window !== "undefined") {
  window.__analyticsTracker = analyticsTracker;
  console.log(
    "[analyticsTracker] 🚀 Analytics tracker available at __analyticsTracker",
  );
}

export type { PageHitData, SearchTermData, SessionData, AnalyticsSnapshot };

export default analyticsTracker;

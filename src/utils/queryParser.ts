/**
 * Query macro parser for {{}} syntax
 * Parses {{ QUERY: FROM [...] LIKE "..." DEPTH ... LIMIT ... SORT ... }}
 */

export interface FromClause {
  paths: string[];
}

export interface DepthRange {
  min: number;
  max: number;
}

export enum SortType {
  Random = "RANDOM",
  Abc = "ABC",
  Cba = "CBA",
  Numeric123 = "123",
  Numeric321 = "321",
}

export interface QueryFilter {
  from: FromClause;
  like?: string;
  depth?: DepthRange;
  limit?: number;
  sort?: SortType;
}

export interface QueryMacro {
  raw: string;
  filter: QueryFilter;
}

export class QueryParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryParseError";
  }
}

/**
 * Detect and extract query macros from text
 * Matches {{ ... }} patterns
 */
export function extractQueryMacros(text: string): string[] {
  const regex = /\{\{([^}]*)\}\}/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null = regex.exec(text);

  while (match !== null) {
    matches.push(match[1].trim());
    match = regex.exec(text);
  }

  return matches;
}

/**
 * Parse a single query macro string (content inside {{ }})
 */
export function parseQueryMacro(input: string): QueryMacro {
  const trimmed = input.trim();

  // Validate macro type (must start with QUERY:)
  if (!trimmed.toUpperCase().startsWith("QUERY:")) {
    throw new QueryParseError("Macro must start with QUERY:");
  }

  // Parse all clauses
  const from = parseFromClause(trimmed);
  const like = parseLikeClause(trimmed);
  const depth = parseDepthClause(trimmed);
  const limit = parseLimitClause(trimmed);
  const sort = parseSortClause(trimmed);

  return {
    raw: trimmed,
    filter: {
      from,
      like,
      depth,
      limit,
      sort,
    },
  };
}

/**
 * Parse FROM clause: FROM [path1] [path2] ...
 */
function parseFromClause(input: string): FromClause {
  const fromRegex = /(?:FROM|from)\s+(\[.*?\](?:\s+\[.*?\])*)/;
  const match = input.match(fromRegex);

  if (!match) {
    throw new QueryParseError("FROM clause is required");
  }

  const pathsStr = match[1];
  const paths = extractBracketedPaths(pathsStr);

  if (paths.length === 0) {
    throw new QueryParseError("FROM clause requires at least one path");
  }

  return { paths };
}

/**
 * Extract paths from bracketed format: [path1] [path2]
 */
function extractBracketedPaths(input: string): string[] {
  const bracketsRegex = /\[([^\]]+)\]/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null = bracketsRegex.exec(input);

  while (match !== null) {
    paths.push(match[1].trim());
    match = bracketsRegex.exec(input);
  }

  return paths;
}

/**
 * Parse LIKE clause: LIKE "text"
 */
function parseLikeClause(input: string): string | undefined {
  const likeRegex = /(?:LIKE|like)\s+"([^"]*)"/;
  const match = input.match(likeRegex);
  return match ? match[1] : undefined;
}

/**
 * Parse DEPTH clause: DEPTH 0 or DEPTH 1..10
 */
function parseDepthClause(input: string): DepthRange | undefined {
  const depthRegex = /(?:DEPTH|depth)\s+(\d+)(?:\.\.(\d+))?/;
  const match = input.match(depthRegex);

  if (!match) {
    return undefined;
  }

  const min = Number.parseInt(match[1], 10);
  const max = match[2] ? Number.parseInt(match[2], 10) : min;

  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new QueryParseError("Invalid DEPTH values");
  }

  if (min > max) {
    throw new QueryParseError("DEPTH min must be less than or equal to max");
  }

  return { min, max };
}

/**
 * Parse LIMIT clause: LIMIT 10
 */
function parseLimitClause(input: string): number | undefined {
  const limitRegex = /(?:LIMIT|limit)\s+(\d+)/;
  const match = input.match(limitRegex);

  if (!match) {
    return undefined;
  }

  const limit = Number.parseInt(match[1], 10);
  if (Number.isNaN(limit)) {
    throw new QueryParseError("Invalid LIMIT value");
  }

  return limit;
}

/**
 * Parse SORT clause: SORT RANDOM|ABC|CBA|123|321
 */
function parseSortClause(input: string): SortType | undefined {
  const sortRegex = /(?:SORT|sort)\s+(\w+)/;
  const match = input.match(sortRegex);

  if (!match) {
    return undefined;
  }

  const sortStr = match[1].toUpperCase();
  const validSorts = Object.values(SortType);

  if (!validSorts.includes(sortStr as SortType)) {
    throw new QueryParseError(`Invalid SORT type: ${sortStr}`);
  }

  return sortStr as SortType;
}

/**
 * Check if a page path matches a glob pattern (supports * wildcard)
 */
export function matchesPathPattern(pattern: string, path: string): boolean {
  if (pattern === "*") {
    return true;
  }

  if (!pattern.includes("*")) {
    return pattern === path;
  }

  // Convert glob pattern to regex
  const regexPattern = pattern
    .split(/(\*)/)
    .map((part) => {
      if (part === "*") {
        return ".*";
      }
      // Escape regex special characters
      return part.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

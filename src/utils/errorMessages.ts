// src/utils/errorMessages.ts
const errorMap: Record<string, string> = {
  "page not found": "페이지를 찾을 수 없습니다. 페이지가 삭제되었거나 이동되었을 수 있습니다.",
  "block not found": "블록을 찾을 수 없습니다.",
  "network error": "네트워크 연결을 확인해주세요.",
  "api key invalid": "API 키가 유효하지 않습니다. 설정에서 확인해주세요.",
  "rate limit": "요청 제한에 도달했습니다. 잠시 후 다시 시도해주세요.",
  "permission denied": "작업 권한이 없습니다.",
  "file not found": "파일을 찾을 수 없습니다.",
  "invalid input": "입력이 유효하지 않습니다.",
  "timeout": "요청 시간이 초과되었습니다. 다시 시도해주세요.",
  "unauthorized": "인증이 필요합니다.",
};

export function getUserFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return "작업을 완료할 수 없습니다. 다시 시도해주세요.";
}

export function getUserFriendlyErrorWithDetails(
  error: unknown,
  details?: string,
): string {
  const friendlyMessage = getUserFriendlyError(error);
  if (details) {
    return `${friendlyMessage}\n\n상세 정보: ${details}`;
  }
  return friendlyMessage;
}

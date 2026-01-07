# MD Outliner v2 아키텍처 설계서

> **목표**: Logseq 스타일의 블록 기반 아웃라이너 앱 구현
> **핵심 변경**: 파일 중심 → SQLite DB 중심 아키텍처로 전환

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [SQLite 스키마 설계](#4-sqlite-스키마-설계)
5. [Fractional Indexing](#5-fractional-indexing)
6. [Rust 백엔드 API](#6-rust-백엔드-api)
7. [프론트엔드 상태 관리](#7-프론트엔드-상태-관리)
8. [컴포넌트 구조](#8-컴포넌트-구조)
9. [마크다운 미러링 전략](#9-마크다운-미러링-전략)
10. [디렉토리 구조](#10-디렉토리-구조)
11. [구현 가이드](#11-구현-가이드)
12. [마이그레이션 전략](#12-마이그레이션-전략)

---

## 1. 프로젝트 개요

### 1.1 현재 상태의 문제점

- 마크다운 파일이 Source of Truth로, 복잡한 블록 관계 표현 어려움
- 매번 `flattenBlocks()` 호출로 O(n) 탐색 발생
- 부모-자식 관계가 트리 구조로 중첩되어 업데이트 비효율적
- 블록 순서 변경 시 배열 재정렬 필요

### 1.2 목표 상태

- SQLite가 Source of Truth, 마크다운은 백업/내보내기용
- O(1) 블록 접근 (정규화된 스토어)
- Fractional Indexing으로 순서 변경 최적화
- 향후 백링크, 그래프 뷰 등 고급 기능 확장 가능

### 1.3 설계 원칙

1. **Single Source of Truth**: SQLite DB가 유일한 진실
2. **Optimistic Update**: UI 즉시 반영 → 백그라운드 DB 동기화
3. **Normalized State**: 중첩 트리 대신 flat한 Map 구조
4. **Lazy Loading**: 필요한 페이지/블록만 로드

---

## 2. 기술 스택

### 2.1 변경 사항 요약

| 영역 | 기존 | 변경 | 이유 |
|------|------|------|------|
| DB | 없음 (파일 직접) | **rusqlite** | 동기적, 간단, Tauri와 궁합 좋음 |
| 가상화 | 없음 | **react-virtuoso** | 트리 구조 가상 스크롤 지원 |
| 상태관리 | Zustand (단순) | **Zustand + Immer** | 정규화된 상태의 불변 업데이트 편의 |

### 2.2 전체 기술 스택

#### Frontend
```
- React 19.x
- TypeScript 5.x
- Vite 5.x
- Mantine UI 7.x
- CodeMirror 6
- Zustand 4.x + Immer
- react-virtuoso (NEW)
- @tabler/icons-react
```

#### Backend (Tauri + Rust)
```
- Tauri 2.x
- rusqlite (NEW) - SQLite 바인딩
- serde / serde_json
- tokio (비동기 파일 미러링용)
- uuid - UUID 생성
```

#### 개발 도구
```
- Biome (린팅/포매팅)
- TypeScript ESLint
```

### 2.3 새로운 의존성 설치

#### Rust (Cargo.toml)
```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1.0", features = ["v4"] }
tokio = { version = "1", features = ["fs", "sync"] }
```

#### JavaScript (package.json)
```json
{
  "dependencies": {
    "react-virtuoso": "^4.7.0",
    "immer": "^10.0.0"
  }
}
```

---

## 3. 시스템 아키텍처

### 3.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        React UI                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  BlockEditor (react-virtuoso 가상 스크롤)            │    │
│  │    └─ BlockComponent (개별 블록, memo + 셀렉터)      │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│  ┌─────────────────────────▼─────────────────────────────┐  │
│  │              Zustand Store (캐시 레이어)               │  │
│  │  - blocksById: Record<string, BlockData>              │  │
│  │  - childrenMap: Record<string, string[]>              │  │
│  │  - Optimistic Updates                                 │  │
│  └─────────────────────────┬─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │ Tauri invoke (IPC)
┌────────────────────────────▼────────────────────────────────┐
│                      Rust Backend                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Command Layer                      │    │
│  │  - create_block, update_block, delete_block, ...    │    │
│  └─────────────────────────┬───────────────────────────┘    │
│                            │                                 │
│  ┌─────────────────────────▼───────────────────────────┐    │
│  │              SQLite (Source of Truth)                │    │
│  │  - pages, blocks, block_refs 테이블                  │    │
│  └─────────────────────────┬───────────────────────────┘    │
│                            │ tokio::spawn (비동기)           │
│  ┌─────────────────────────▼───────────────────────────┐    │
│  │           Markdown Mirroring Service                 │    │
│  │  - DB 변경 감지 → .md 파일 자동 업데이트              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 데이터 흐름

#### 읽기 (페이지 로드)
```
1. User opens page
2. React: loadPage(pageId) 호출
3. Zustand: invoke('get_page_blocks', pageId)
4. Rust: SQLite에서 블록들 조회, 정렬하여 반환
5. Zustand: blocksById, childrenMap 업데이트
6. React: 컴포넌트 리렌더링
```

#### 쓰기 (블록 수정)
```
1. User types in block
2. React: updateBlockContent(id, content) 호출
3. Zustand: 
   a. blocksById[id].content 즉시 업데이트 (Optimistic)
   b. invoke('update_block', { id, content })
4. Rust:
   a. SQLite UPDATE
   b. 마크다운 미러링 큐에 추가
5. (실패 시) Zustand: 롤백
```

---

## 4. SQLite 스키마 설계

### 4.1 테이블 정의

```sql
-- 워크스페이스 설정
CREATE TABLE workspace (
    id TEXT PRIMARY KEY DEFAULT 'default',
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 페이지 (각 .md 파일 = 하나의 페이지)
CREATE TABLE pages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT,  -- 미러링될 마크다운 파일 경로
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 블록 (핵심 테이블)
CREATE TABLE blocks (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    parent_id TEXT,  -- NULL = 페이지의 루트 레벨 블록
    content TEXT NOT NULL DEFAULT '',
    order_weight REAL NOT NULL,  -- Fractional Indexing용
    is_collapsed INTEGER DEFAULT 0,
    block_type TEXT DEFAULT 'bullet',  -- 'bullet' | 'code' | 'fence'
    language TEXT,  -- 코드 블록의 언어
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE SET NULL
);

-- 인덱스
CREATE INDEX idx_blocks_page ON blocks(page_id);
CREATE INDEX idx_blocks_parent ON blocks(parent_id);
CREATE INDEX idx_blocks_order ON blocks(page_id, parent_id, order_weight);

-- 블록 참조 (백링크, Phase 2에서 구현)
CREATE TABLE block_refs (
    id TEXT PRIMARY KEY,
    from_block_id TEXT NOT NULL,
    to_block_id TEXT NOT NULL,
    ref_type TEXT DEFAULT 'link',  -- 'link' | 'embed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (from_block_id) REFERENCES blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (to_block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

CREATE INDEX idx_refs_from ON block_refs(from_block_id);
CREATE INDEX idx_refs_to ON block_refs(to_block_id);
```

### 4.2 블록 타입 설명

| block_type | 설명 | Enter 동작 |
|------------|------|------------|
| `bullet` | 일반 블록 | 새 블록 생성 |
| `code` | 코드 블록 (```) | 내부 줄바꿈 |
| `fence` | 펜스 블록 (///) | 내부 줄바꿈 |

---

## 5. Fractional Indexing

### 5.1 개념

블록 순서를 정수 대신 실수로 관리하여, 순서 변경 시 다른 블록들의 인덱스를 수정하지 않음.

```
기존 방식 (정수):
Block A: order=1
Block B: order=2
Block C: order=3

A와 B 사이에 D 삽입 시:
Block A: order=1
Block D: order=2  ← 새로 삽입
Block B: order=3  ← 변경 필요!
Block C: order=4  ← 변경 필요!

Fractional Indexing:
Block A: order=1.0
Block B: order=2.0
Block C: order=3.0

A와 B 사이에 D 삽입 시:
Block A: order=1.0
Block D: order=1.5  ← (1.0 + 2.0) / 2
Block B: order=2.0  ← 변경 없음
Block C: order=3.0  ← 변경 없음
```

### 5.2 Rust 구현

```rust
// src-tauri/src/fractional_index.rs

/// 두 order_weight 사이의 중간값 계산
pub fn calculate_middle(before: Option<f64>, after: Option<f64>) -> f64 {
    match (before, after) {
        (None, None) => 1.0,
        (None, Some(a)) => a / 2.0,
        (Some(b), None) => b + 1.0,
        (Some(b), Some(a)) => (b + a) / 2.0,
    }
}

/// 여러 블록 삽입 시 균등 분배
pub fn calculate_between(before: Option<f64>, after: Option<f64>, count: usize) -> Vec<f64> {
    let start = before.unwrap_or(0.0);
    let end = after.unwrap_or(start + count as f64 + 1.0);
    let step = (end - start) / (count + 1) as f64;
    
    (1..=count).map(|i| start + step * i as f64).collect()
}

/// order_weight 정규화 (간격이 너무 좁아지면 재배치)
/// 부동소수점 정밀도 한계에 도달하면 호출
pub fn needs_rebalancing(before: f64, after: f64) -> bool {
    (after - before).abs() < 1e-10
}

pub fn rebalance_order_weights(count: usize) -> Vec<f64> {
    (1..=count).map(|i| i as f64).collect()
}
```

### 5.3 사용 시나리오

#### 새 블록 추가 (맨 끝)
```rust
let last_order = get_last_sibling_order(parent_id)?;  // 예: 3.0
let new_order = calculate_middle(Some(last_order), None);  // 4.0
```

#### 블록 사이에 삽입
```rust
let prev_order = get_block_order(prev_block_id)?;  // 1.0
let next_order = get_block_order(next_block_id)?;  // 2.0
let new_order = calculate_middle(Some(prev_order), Some(next_order));  // 1.5
```

#### 블록 이동
```rust
// A를 B와 C 사이로 이동
let b_order = 2.0;
let c_order = 3.0;
let new_order = calculate_middle(Some(b_order), Some(c_order));  // 2.5
update_block_order(block_a_id, new_order)?;
```

---

## 6. Rust 백엔드 API

### 6.1 모듈 구조

```
src-tauri/src/
├── main.rs
├── lib.rs
├── db/
│   ├── mod.rs
│   ├── connection.rs    # DB 연결 관리
│   ├── schema.rs        # 테이블 생성
│   └── migrations.rs    # 마이그레이션
├── models/
│   ├── mod.rs
│   ├── page.rs
│   └── block.rs
├── commands/
│   ├── mod.rs
│   ├── workspace.rs     # 워크스페이스 관련
│   ├── page.rs          # 페이지 CRUD
│   └── block.rs         # 블록 CRUD
├── services/
│   ├── mod.rs
│   └── markdown_mirror.rs  # 마크다운 미러링
└── utils/
    ├── mod.rs
    └── fractional_index.rs
```

### 6.2 데이터 모델 (Rust)

```rust
// src-tauri/src/models/block.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    pub id: String,
    pub page_id: String,
    pub parent_id: Option<String>,
    pub content: String,
    pub order_weight: f64,
    pub is_collapsed: bool,
    pub block_type: BlockType,
    pub language: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BlockType {
    Bullet,
    Code,
    Fence,
}

impl Default for BlockType {
    fn default() -> Self {
        BlockType::Bullet
    }
}

// 생성 요청용
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlockRequest {
    pub page_id: String,
    pub parent_id: Option<String>,
    pub after_block_id: Option<String>,  // 이 블록 다음에 삽입
    pub content: Option<String>,
    pub block_type: Option<BlockType>,
}

// 업데이트 요청용
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBlockRequest {
    pub id: String,
    pub content: Option<String>,
    pub is_collapsed: Option<bool>,
    pub block_type: Option<BlockType>,
    pub language: Option<String>,
}

// 이동 요청용
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveBlockRequest {
    pub id: String,
    pub new_parent_id: Option<String>,
    pub after_block_id: Option<String>,
}
```

### 6.3 Tauri Commands

```rust
// src-tauri/src/commands/block.rs

use crate::db::connection::DbPool;
use crate::models::block::*;
use crate::utils::fractional_index;
use tauri::State;

/// 페이지의 모든 블록 조회 (트리 구조로 반환하지 않고 flat하게)
#[tauri::command]
pub async fn get_page_blocks(
    db: State<'_, DbPool>,
    page_id: String
) -> Result<Vec<Block>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("
        SELECT id, page_id, parent_id, content, order_weight, 
               is_collapsed, block_type, language, created_at, updated_at
        FROM blocks
        WHERE page_id = ?
        ORDER BY parent_id NULLS FIRST, order_weight
    ").map_err(|e| e.to_string())?;
    
    let blocks = stmt.query_map([&page_id], |row| {
        Ok(Block {
            id: row.get(0)?,
            page_id: row.get(1)?,
            parent_id: row.get(2)?,
            content: row.get(3)?,
            order_weight: row.get(4)?,
            is_collapsed: row.get::<_, i32>(5)? != 0,
            block_type: parse_block_type(row.get::<_, String>(6)?),
            language: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| e.to_string())?;
    
    Ok(blocks)
}

/// 새 블록 생성
#[tauri::command]
pub async fn create_block(
    db: State<'_, DbPool>,
    request: CreateBlockRequest
) -> Result<Block, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    
    // order_weight 계산
    let order_weight = calculate_new_order_weight(
        &conn,
        &request.page_id,
        request.parent_id.as_deref(),
        request.after_block_id.as_deref()
    )?;
    
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let block_type = request.block_type.unwrap_or_default();
    let content = request.content.unwrap_or_default();
    
    conn.execute(
        "INSERT INTO blocks (id, page_id, parent_id, content, order_weight, block_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            &id,
            &request.page_id,
            &request.parent_id,
            &content,
            order_weight,
            block_type.to_string(),
            &now,
            &now
        ]
    ).map_err(|e| e.to_string())?;
    
    // 생성된 블록 반환
    get_block_by_id(&conn, &id)
}

/// 블록 내용 업데이트
#[tauri::command]
pub async fn update_block(
    db: State<'_, DbPool>,
    request: UpdateBlockRequest
) -> Result<Block, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    
    // 동적 업데이트 쿼리 구성
    let mut updates = vec!["updated_at = ?"];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.clone())];
    
    if let Some(content) = &request.content {
        updates.push("content = ?");
        params.push(Box::new(content.clone()));
    }
    if let Some(collapsed) = request.is_collapsed {
        updates.push("is_collapsed = ?");
        params.push(Box::new(collapsed as i32));
    }
    if let Some(block_type) = &request.block_type {
        updates.push("block_type = ?");
        params.push(Box::new(block_type.to_string()));
    }
    if let Some(language) = &request.language {
        updates.push("language = ?");
        params.push(Box::new(language.clone()));
    }
    
    params.push(Box::new(request.id.clone()));
    
    let sql = format!(
        "UPDATE blocks SET {} WHERE id = ?",
        updates.join(", ")
    );
    
    conn.execute(&sql, rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())))
        .map_err(|e| e.to_string())?;
    
    get_block_by_id(&conn, &request.id)
}

/// 블록 삭제 (하위 블록도 함께)
#[tauri::command]
pub async fn delete_block(
    db: State<'_, DbPool>,
    block_id: String
) -> Result<Vec<String>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    
    // 삭제될 블록 ID들 수집 (본인 + 모든 자손)
    let deleted_ids = collect_descendant_ids(&conn, &block_id)?;
    
    // CASCADE 덕분에 자손도 자동 삭제되지만, 명시적으로 처리
    conn.execute(
        "DELETE FROM blocks WHERE id IN (SELECT id FROM blocks WHERE id = ? OR parent_id = ?)",
        [&block_id, &block_id]
    ).map_err(|e| e.to_string())?;
    
    Ok(deleted_ids)
}

/// 블록 이동 (들여쓰기/내어쓰기/순서 변경)
#[tauri::command]
pub async fn move_block(
    db: State<'_, DbPool>,
    request: MoveBlockRequest
) -> Result<Block, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    
    // 새 order_weight 계산
    let block = get_block_by_id(&conn, &request.id)?;
    let new_order = calculate_new_order_weight(
        &conn,
        &block.page_id,
        request.new_parent_id.as_deref(),
        request.after_block_id.as_deref()
    )?;
    
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
        rusqlite::params![
            &request.new_parent_id,
            new_order,
            &now,
            &request.id
        ]
    ).map_err(|e| e.to_string())?;
    
    get_block_by_id(&conn, &request.id)
}

/// 블록 들여쓰기 (이전 형제의 자식으로)
#[tauri::command]
pub async fn indent_block(
    db: State<'_, DbPool>,
    block_id: String
) -> Result<Block, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let block = get_block_by_id(&conn, &block_id)?;
    
    // 이전 형제 찾기
    let prev_sibling = find_previous_sibling(&conn, &block)?
        .ok_or("Cannot indent: no previous sibling")?;
    
    // 이전 형제의 마지막 자식 다음에 배치
    let new_order = calculate_new_order_weight(
        &conn,
        &block.page_id,
        Some(&prev_sibling.id),
        None  // 마지막에 추가
    )?;
    
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
        rusqlite::params![&prev_sibling.id, new_order, &now, &block_id]
    ).map_err(|e| e.to_string())?;
    
    get_block_by_id(&conn, &block_id)
}

/// 블록 내어쓰기 (부모의 형제로)
#[tauri::command]
pub async fn outdent_block(
    db: State<'_, DbPool>,
    block_id: String
) -> Result<Block, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let block = get_block_by_id(&conn, &block_id)?;
    
    let parent_id = block.parent_id.as_ref()
        .ok_or("Cannot outdent: already at root level")?;
    
    let parent = get_block_by_id(&conn, parent_id)?;
    
    // 부모 바로 다음에 배치
    let new_order = calculate_new_order_weight(
        &conn,
        &block.page_id,
        parent.parent_id.as_deref(),
        Some(parent_id)
    )?;
    
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
        rusqlite::params![&parent.parent_id, new_order, &now, &block_id]
    ).map_err(|e| e.to_string())?;
    
    get_block_by_id(&conn, &block_id)
}

/// 블록 접기/펼치기 토글
#[tauri::command]
pub async fn toggle_collapse(
    db: State<'_, DbPool>,
    block_id: String
) -> Result<Block, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE blocks SET is_collapsed = NOT is_collapsed, updated_at = ? WHERE id = ?",
        [&chrono::Utc::now().to_rfc3339(), &block_id]
    ).map_err(|e| e.to_string())?;
    
    get_block_by_id(&conn, &block_id)
}

// ============ Helper Functions ============

fn calculate_new_order_weight(
    conn: &rusqlite::Connection,
    page_id: &str,
    parent_id: Option<&str>,
    after_block_id: Option<&str>
) -> Result<f64, String> {
    match after_block_id {
        Some(after_id) => {
            let after_block = get_block_by_id(conn, after_id)?;
            
            // after_block 다음 형제 찾기
            let next_sibling: Option<f64> = conn.query_row(
                "SELECT order_weight FROM blocks 
                 WHERE page_id = ? AND parent_id IS ? AND order_weight > ?
                 ORDER BY order_weight LIMIT 1",
                rusqlite::params![page_id, parent_id, after_block.order_weight],
                |row| row.get(0)
            ).ok();
            
            Ok(fractional_index::calculate_middle(
                Some(after_block.order_weight),
                next_sibling
            ))
        }
        None => {
            // 마지막에 추가
            let last_order: Option<f64> = conn.query_row(
                "SELECT MAX(order_weight) FROM blocks WHERE page_id = ? AND parent_id IS ?",
                rusqlite::params![page_id, parent_id],
                |row| row.get(0)
            ).ok().flatten();
            
            Ok(fractional_index::calculate_middle(last_order, None))
        }
    }
}

fn get_block_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Block, String> {
    conn.query_row(
        "SELECT id, page_id, parent_id, content, order_weight, 
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks WHERE id = ?",
        [id],
        |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: parse_block_type(row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        }
    ).map_err(|e| format!("Block not found: {}", e))
}

fn collect_descendant_ids(conn: &rusqlite::Connection, block_id: &str) -> Result<Vec<String>, String> {
    // 재귀 CTE로 모든 자손 수집
    let mut stmt = conn.prepare("
        WITH RECURSIVE descendants AS (
            SELECT id FROM blocks WHERE id = ?
            UNION ALL
            SELECT b.id FROM blocks b
            INNER JOIN descendants d ON b.parent_id = d.id
        )
        SELECT id FROM descendants
    ").map_err(|e| e.to_string())?;
    
    let ids = stmt.query_map([block_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(ids)
}
```

### 6.4 Command 등록

```rust
// src-tauri/src/lib.rs

mod db;
mod models;
mod commands;
mod services;
mod utils;

use db::connection::init_db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // DB 초기화
            let db_pool = init_db(app.handle())?;
            app.manage(db_pool);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Workspace
            commands::workspace::select_workspace,
            commands::workspace::get_workspace,
            
            // Pages
            commands::page::get_pages,
            commands::page::create_page,
            commands::page::delete_page,
            commands::page::rename_page,
            
            // Blocks
            commands::block::get_page_blocks,
            commands::block::create_block,
            commands::block::update_block,
            commands::block::delete_block,
            commands::block::move_block,
            commands::block::indent_block,
            commands::block::outdent_block,
            commands::block::toggle_collapse,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 7. 프론트엔드 상태 관리

### 7.1 Zustand 스토어 설계

```typescript
// src/stores/blockStore.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';

// ============ Types ============

export interface BlockData {
  id: string;
  pageId: string;
  parentId: string | null;
  content: string;
  orderWeight: number;
  isCollapsed: boolean;
  blockType: 'bullet' | 'code' | 'fence';
  language?: string;
  createdAt: string;
  updatedAt: string;
}

interface BlockState {
  // 정규화된 데이터
  blocksById: Record<string, BlockData>;
  childrenMap: Record<string, string[]>;  // parentId (또는 'root') -> sorted childIds
  
  // 현재 상태
  currentPageId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // 선택/포커스 상태
  focusedBlockId: string | null;
  selectedBlockIds: string[];
}

interface BlockActions {
  // 페이지 로드
  loadPage: (pageId: string) => Promise<void>;
  clearPage: () => void;
  
  // 블록 CRUD
  createBlock: (afterBlockId: string | null, content?: string) => Promise<string>;
  updateBlockContent: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  
  // 블록 조작
  indentBlock: (id: string) => Promise<void>;
  outdentBlock: (id: string) => Promise<void>;
  moveBlock: (id: string, newParentId: string | null, afterBlockId: string | null) => Promise<void>;
  toggleCollapse: (id: string) => Promise<void>;
  
  // 선택/포커스
  setFocusedBlock: (id: string | null) => void;
  setSelectedBlocks: (ids: string[]) => void;
  
  // 셀렉터 (컴포넌트에서 구독용)
  getBlock: (id: string) => BlockData | undefined;
  getChildren: (parentId: string | null) => string[];
  getRootBlockIds: () => string[];
}

type BlockStore = BlockState & BlockActions;

// ============ Store Implementation ============

export const useBlockStore = create<BlockStore>()(
  immer((set, get) => ({
    // Initial State
    blocksById: {},
    childrenMap: {},
    currentPageId: null,
    isLoading: false,
    error: null,
    focusedBlockId: null,
    selectedBlockIds: [],

    // ============ Page Operations ============
    
    loadPage: async (pageId: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const blocks: BlockData[] = await invoke('get_page_blocks', { pageId });
        
        // 정규화
        const blocksById: Record<string, BlockData> = {};
        const childrenMap: Record<string, string[]> = { root: [] };
        
        for (const block of blocks) {
          blocksById[block.id] = block;
          
          const parentKey = block.parentId ?? 'root';
          if (!childrenMap[parentKey]) {
            childrenMap[parentKey] = [];
          }
          childrenMap[parentKey].push(block.id);
        }
        
        // orderWeight로 정렬
        for (const key of Object.keys(childrenMap)) {
          childrenMap[key].sort((a, b) => {
            return blocksById[a].orderWeight - blocksById[b].orderWeight;
          });
        }

        set((state) => {
          state.blocksById = blocksById;
          state.childrenMap = childrenMap;
          state.currentPageId = pageId;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to load page';
          state.isLoading = false;
        });
      }
    },

    clearPage: () => {
      set((state) => {
        state.blocksById = {};
        state.childrenMap = {};
        state.currentPageId = null;
        state.focusedBlockId = null;
        state.selectedBlockIds = [];
      });
    },

    // ============ Block CRUD ============

    createBlock: async (afterBlockId: string | null, content?: string) => {
      const { currentPageId, blocksById } = get();
      if (!currentPageId) throw new Error('No page loaded');

      // 부모 결정
      let parentId: string | null = null;
      if (afterBlockId) {
        parentId = blocksById[afterBlockId]?.parentId ?? null;
      }

      // Optimistic: 임시 ID로 즉시 추가
      const tempId = `temp-${Date.now()}`;
      const tempBlock: BlockData = {
        id: tempId,
        pageId: currentPageId,
        parentId,
        content: content ?? '',
        orderWeight: Date.now(), // 임시
        isCollapsed: false,
        blockType: 'bullet',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((state) => {
        state.blocksById[tempId] = tempBlock;
        const parentKey = parentId ?? 'root';
        if (!state.childrenMap[parentKey]) {
          state.childrenMap[parentKey] = [];
        }
        
        if (afterBlockId) {
          const afterIndex = state.childrenMap[parentKey].indexOf(afterBlockId);
          state.childrenMap[parentKey].splice(afterIndex + 1, 0, tempId);
        } else {
          state.childrenMap[parentKey].push(tempId);
        }
        
        state.focusedBlockId = tempId;
      });

      try {
        // 실제 생성
        const newBlock: BlockData = await invoke('create_block', {
          request: {
            pageId: currentPageId,
            parentId,
            afterBlockId,
            content,
          }
        });

        // 임시 블록을 실제 블록으로 교체
        set((state) => {
          delete state.blocksById[tempId];
          state.blocksById[newBlock.id] = newBlock;
          
          const parentKey = parentId ?? 'root';
          const tempIndex = state.childrenMap[parentKey].indexOf(tempId);
          if (tempIndex !== -1) {
            state.childrenMap[parentKey][tempIndex] = newBlock.id;
          }
          
          state.focusedBlockId = newBlock.id;
        });

        return newBlock.id;
      } catch (error) {
        // 롤백
        set((state) => {
          delete state.blocksById[tempId];
          const parentKey = parentId ?? 'root';
          state.childrenMap[parentKey] = state.childrenMap[parentKey].filter(
            id => id !== tempId
          );
        });
        throw error;
      }
    },

    updateBlockContent: async (id: string, content: string) => {
      const block = get().blocksById[id];
      if (!block) return;

      const previousContent = block.content;

      // Optimistic Update
      set((state) => {
        if (state.blocksById[id]) {
          state.blocksById[id].content = content;
          state.blocksById[id].updatedAt = new Date().toISOString();
        }
      });

      try {
        await invoke('update_block', {
          request: { id, content }
        });
      } catch (error) {
        // 롤백
        set((state) => {
          if (state.blocksById[id]) {
            state.blocksById[id].content = previousContent;
          }
        });
        throw error;
      }
    },

    deleteBlock: async (id: string) => {
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return;

      // 백업 (롤백용)
      const backup = {
        block: { ...block },
        parentKey: block.parentId ?? 'root',
        index: childrenMap[block.parentId ?? 'root']?.indexOf(id) ?? -1,
      };

      // Optimistic Delete
      set((state) => {
        delete state.blocksById[id];
        const parentKey = block.parentId ?? 'root';
        state.childrenMap[parentKey] = state.childrenMap[parentKey]?.filter(
          childId => childId !== id
        ) ?? [];
      });

      try {
        await invoke('delete_block', { blockId: id });
      } catch (error) {
        // 롤백
        set((state) => {
          state.blocksById[backup.block.id] = backup.block;
          if (!state.childrenMap[backup.parentKey]) {
            state.childrenMap[backup.parentKey] = [];
          }
          state.childrenMap[backup.parentKey].splice(backup.index, 0, backup.block.id);
        });
        throw error;
      }
    },

    // ============ Block Manipulation ============

    indentBlock: async (id: string) => {
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return;

      const parentKey = block.parentId ?? 'root';
      const siblings = childrenMap[parentKey] ?? [];
      const index = siblings.indexOf(id);
      
      // 이전 형제가 없으면 들여쓰기 불가
      if (index <= 0) return;
      
      const prevSiblingId = siblings[index - 1];

      // Optimistic
      set((state) => {
        // 현재 위치에서 제거
        state.childrenMap[parentKey] = state.childrenMap[parentKey].filter(
          childId => childId !== id
        );
        
        // 이전 형제의 자식으로 추가
        if (!state.childrenMap[prevSiblingId]) {
          state.childrenMap[prevSiblingId] = [];
        }
        state.childrenMap[prevSiblingId].push(id);
        state.blocksById[id].parentId = prevSiblingId;
      });

      try {
        const updatedBlock: BlockData = await invoke('indent_block', { blockId: id });
        set((state) => {
          state.blocksById[id] = updatedBlock;
        });
      } catch (error) {
        // 페이지 다시 로드 (간단한 롤백)
        const pageId = get().currentPageId;
        if (pageId) get().loadPage(pageId);
        throw error;
      }
    },

    outdentBlock: async (id: string) => {
      const { blocksById } = get();
      const block = blocksById[id];
      if (!block || !block.parentId) return;  // 루트면 내어쓰기 불가

      const parent = blocksById[block.parentId];
      if (!parent) return;

      // Optimistic
      set((state) => {
        // 현재 부모에서 제거
        state.childrenMap[block.parentId!] = state.childrenMap[block.parentId!]?.filter(
          childId => childId !== id
        ) ?? [];
        
        // 부모의 부모(조부모)의 자식으로, 부모 다음에 추가
        const grandparentKey = parent.parentId ?? 'root';
        const parentIndex = state.childrenMap[grandparentKey]?.indexOf(block.parentId!) ?? -1;
        
        if (!state.childrenMap[grandparentKey]) {
          state.childrenMap[grandparentKey] = [];
        }
        state.childrenMap[grandparentKey].splice(parentIndex + 1, 0, id);
        state.blocksById[id].parentId = parent.parentId;
      });

      try {
        const updatedBlock: BlockData = await invoke('outdent_block', { blockId: id });
        set((state) => {
          state.blocksById[id] = updatedBlock;
        });
      } catch (error) {
        const pageId = get().currentPageId;
        if (pageId) get().loadPage(pageId);
        throw error;
      }
    },

    moveBlock: async (id: string, newParentId: string | null, afterBlockId: string | null) => {
      try {
        const updatedBlock: BlockData = await invoke('move_block', {
          request: { id, newParentId, afterBlockId }
        });
        
        // 페이지 다시 로드 (이동은 복잡하므로)
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
      } catch (error) {
        throw error;
      }
    },

    toggleCollapse: async (id: string) => {
      const block = get().blocksById[id];
      if (!block) return;

      // Optimistic
      set((state) => {
        if (state.blocksById[id]) {
          state.blocksById[id].isCollapsed = !state.blocksById[id].isCollapsed;
        }
      });

      try {
        await invoke('toggle_collapse', { blockId: id });
      } catch (error) {
        // 롤백
        set((state) => {
          if (state.blocksById[id]) {
            state.blocksById[id].isCollapsed = !state.blocksById[id].isCollapsed;
          }
        });
        throw error;
      }
    },

    // ============ Focus/Selection ============

    setFocusedBlock: (id: string | null) => {
      set((state) => {
        state.focusedBlockId = id;
      });
    },

    setSelectedBlocks: (ids: string[]) => {
      set((state) => {
        state.selectedBlockIds = ids;
      });
    },

    // ============ Selectors ============

    getBlock: (id: string) => get().blocksById[id],
    
    getChildren: (parentId: string | null) => {
      const key = parentId ?? 'root';
      return get().childrenMap[key] ?? [];
    },
    
    getRootBlockIds: () => get().childrenMap['root'] ?? [],
  }))
);

// ============ Selector Hooks (성능 최적화) ============

// 개별 블록 구독 (해당 블록만 변경 시 리렌더)
export const useBlock = (id: string) => 
  useBlockStore((state) => state.blocksById[id]);

// 자식 ID 목록 구독
export const useChildrenIds = (parentId: string | null) =>
  useBlockStore((state) => state.childrenMap[parentId ?? 'root'] ?? []);

// 포커스 상태
export const useFocusedBlockId = () =>
  useBlockStore((state) => state.focusedBlockId);

// 로딩 상태
export const useBlocksLoading = () =>
  useBlockStore((state) => state.isLoading);
```

### 7.2 Debounced Content Update

```typescript
// src/hooks/useDebouncedBlockUpdate.ts

import { useCallback, useRef } from 'react';
import { useBlockStore } from '../stores/blockStore';

const DEBOUNCE_MS = 300;

export function useDebouncedBlockUpdate(blockId: string) {
  const updateBlockContent = useBlockStore((state) => state.updateBlockContent);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<string>();

  const debouncedUpdate = useCallback((content: string) => {
    pendingContentRef.current = content;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (pendingContentRef.current !== undefined) {
        updateBlockContent(blockId, pendingContentRef.current);
        pendingContentRef.current = undefined;
      }
    }, DEBOUNCE_MS);
  }, [blockId, updateBlockContent]);

  const flushUpdate = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (pendingContentRef.current !== undefined) {
      updateBlockContent(blockId, pendingContentRef.current);
      pendingContentRef.current = undefined;
    }
  }, [blockId, updateBlockContent]);

  return { debouncedUpdate, flushUpdate };
}
```

---

## 8. 컴포넌트 구조

### 8.1 컴포넌트 트리

```
App
├── Sidebar (파일/페이지 목록)
│   └── PageTree
│       └── PageItem
└── MainContent
    └── BlockEditor (가상 스크롤 컨테이너)
        └── VirtualBlockList (react-virtuoso)
            └── BlockRow (가상화 단위)
                └── BlockComponent (memo)
                    ├── CollapseToggle
                    ├── BlockBullet
                    └── BlockContent (CodeMirror)
```

### 8.2 BlockEditor (가상 스크롤)

```tsx
// src/outliner/BlockEditor.tsx

import React, { useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useBlockStore, useChildrenIds } from '../stores/blockStore';
import { BlockRow } from './BlockRow';

interface BlockEditorProps {
  pageId: string;
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const loadPage = useBlockStore((state) => state.loadPage);
  const isLoading = useBlockStore((state) => state.isLoading);
  
  React.useEffect(() => {
    loadPage(pageId);
  }, [pageId, loadPage]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <BlockList parentId={null} depth={0} />;
}

interface BlockListProps {
  parentId: string | null;
  depth: number;
}

function BlockList({ parentId, depth }: BlockListProps) {
  const childIds = useChildrenIds(parentId);
  
  // 트리를 평탄화하여 가상 스크롤에 전달
  const flattenedBlocks = useFlattenedBlocks(parentId);
  
  if (depth === 0) {
    // 루트 레벨: 가상 스크롤 적용
    return (
      <Virtuoso
        style={{ height: '100%' }}
        totalCount={flattenedBlocks.length}
        itemContent={(index) => (
          <BlockRow 
            blockId={flattenedBlocks[index].id} 
            depth={flattenedBlocks[index].depth}
          />
        )}
      />
    );
  }
  
  // 중첩 레벨: 일반 렌더링 (가상 스크롤 내부)
  return (
    <>
      {childIds.map((id) => (
        <BlockRow key={id} blockId={id} depth={depth} />
      ))}
    </>
  );
}

// 트리를 DFS로 평탄화
function useFlattenedBlocks(rootParentId: string | null) {
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);
  
  return useMemo(() => {
    const result: { id: string; depth: number }[] = [];
    
    function traverse(parentId: string | null, depth: number) {
      const childIds = childrenMap[parentId ?? 'root'] ?? [];
      
      for (const id of childIds) {
        const block = blocksById[id];
        result.push({ id, depth });
        
        // collapsed가 아니면 자식도 순회
        if (block && !block.isCollapsed) {
          traverse(id, depth + 1);
        }
      }
    }
    
    traverse(rootParentId, 0);
    return result;
  }, [blocksById, childrenMap, rootParentId]);
}
```

### 8.3 BlockComponent (개별 블록)

```tsx
// src/outliner/BlockComponent.tsx

import React, { memo, useCallback } from 'react';
import { useBlock, useChildrenIds, useBlockStore } from '../stores/blockStore';
import { useDebouncedBlockUpdate } from '../hooks/useDebouncedBlockUpdate';
import { BlockContent } from './BlockContent';
import './BlockComponent.css';

interface BlockComponentProps {
  blockId: string;
  depth: number;
}

export const BlockComponent = memo(function BlockComponent({ 
  blockId, 
  depth 
}: BlockComponentProps) {
  const block = useBlock(blockId);
  const childIds = useChildrenIds(blockId);
  const hasChildren = childIds.length > 0;
  
  const toggleCollapse = useBlockStore((state) => state.toggleCollapse);
  const createBlock = useBlockStore((state) => state.createBlock);
  const deleteBlock = useBlockStore((state) => state.deleteBlock);
  const indentBlock = useBlockStore((state) => state.indentBlock);
  const outdentBlock = useBlockStore((state) => state.outdentBlock);
  const setFocusedBlock = useBlockStore((state) => state.setFocusedBlock);
  
  const { debouncedUpdate, flushUpdate } = useDebouncedBlockUpdate(blockId);
  
  const handleContentChange = useCallback((content: string) => {
    debouncedUpdate(content);
  }, [debouncedUpdate]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      flushUpdate();
      createBlock(blockId);
    } else if (e.key === 'Backspace' && block?.content === '') {
      e.preventDefault();
      deleteBlock(blockId);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      flushUpdate();
      if (e.shiftKey) {
        outdentBlock(blockId);
      } else {
        indentBlock(blockId);
      }
    }
  }, [blockId, block?.content, flushUpdate, createBlock, deleteBlock, indentBlock, outdentBlock]);
  
  const handleFocus = useCallback(() => {
    setFocusedBlock(blockId);
  }, [blockId, setFocusedBlock]);
  
  const handleBlur = useCallback(() => {
    flushUpdate();
  }, [flushUpdate]);
  
  if (!block) return null;
  
  return (
    <div 
      className="block-component"
      style={{ paddingLeft: `${depth * 24}px` }}
    >
      <div className="block-row">
        {/* 접기/펼치기 버튼 */}
        <button
          className={`collapse-toggle ${hasChildren ? 'visible' : ''}`}
          onClick={() => toggleCollapse(blockId)}
        >
          {block.isCollapsed ? '▶' : '▼'}
        </button>
        
        {/* 불릿 */}
        <span className="block-bullet">•</span>
        
        {/* 내용 */}
        <BlockContent
          content={block.content}
          blockType={block.blockType}
          language={block.language}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
});
```

### 8.4 BlockRow (가상화 래퍼)

```tsx
// src/outliner/BlockRow.tsx

import React from 'react';
import { BlockComponent } from './BlockComponent';

interface BlockRowProps {
  blockId: string;
  depth: number;
}

export function BlockRow({ blockId, depth }: BlockRowProps) {
  return <BlockComponent blockId={blockId} depth={depth} />;
}
```

---

## 9. 마크다운 미러링 전략

### 9.1 개요

SQLite가 Source of Truth이지만, 마크다운 파일로 백업/내보내기 지원.

- **시점**: DB 변경 후 비동기로 (UI 블로킹 없음)
- **단위**: 페이지 단위 (.md 파일 1개 = 페이지 1개)
- **Debounce**: 연속 편집 시 마지막 변경 후 1초 대기

### 9.2 마크다운 변환 로직

```rust
// src-tauri/src/services/markdown_mirror.rs

use crate::models::block::{Block, BlockType};
use std::collections::HashMap;

/// 블록들을 마크다운 문자열로 변환
pub fn blocks_to_markdown(blocks: &[Block]) -> String {
    // 부모별로 그룹화
    let mut children_map: HashMap<Option<&str>, Vec<&Block>> = HashMap::new();
    
    for block in blocks {
        children_map
            .entry(block.parent_id.as_deref())
            .or_default()
            .push(block);
    }
    
    // 각 그룹 정렬
    for children in children_map.values_mut() {
        children.sort_by(|a, b| a.order_weight.partial_cmp(&b.order_weight).unwrap());
    }
    
    let mut output = String::new();
    render_blocks(&children_map, None, 0, &mut output);
    
    output
}

fn render_blocks(
    children_map: &HashMap<Option<&str>, Vec<&Block>>,
    parent_id: Option<&str>,
    depth: usize,
    output: &mut String,
) {
    let Some(children) = children_map.get(&parent_id) else {
        return;
    };
    
    for block in children {
        let indent = "  ".repeat(depth);
        
        match block.block_type {
            BlockType::Bullet => {
                output.push_str(&format!("{}{}\n", indent, block.content));
            }
            BlockType::Code => {
                let lang = block.language.as_deref().unwrap_or("");
                output.push_str(&format!("{}```{}\n", indent, lang));
                for line in block.content.lines() {
                    output.push_str(&format!("{}{}\n", indent, line));
                }
                output.push_str(&format!("{}```\n", indent));
            }
            BlockType::Fence => {
                output.push_str(&format!("{}///\n", indent));
                for line in block.content.lines() {
                    output.push_str(&format!("{}{}\n", indent, line));
                }
                output.push_str(&format!("{}///\n", indent));
            }
        }
        
        // 자식 렌더링
        render_blocks(children_map, Some(&block.id), depth + 1, output);
    }
}

/// 마크다운 파일을 블록들로 파싱
pub fn markdown_to_blocks(content: &str, page_id: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut parent_stack: Vec<(String, usize)> = Vec::new();  // (id, depth)
    let mut order_counter: f64 = 1.0;
    
    for line in content.lines() {
        let trimmed = line.trim_start();
        let depth = (line.len() - trimmed.len()) / 2;  // 2칸 들여쓰기 기준
        
        if trimmed.is_empty() {
            continue;
        }
        
        // 부모 결정
        while let Some((_, parent_depth)) = parent_stack.last() {
            if *parent_depth >= depth {
                parent_stack.pop();
            } else {
                break;
            }
        }
        
        let parent_id = parent_stack.last().map(|(id, _)| id.clone());
        
        let block = Block {
            id: uuid::Uuid::new_v4().to_string(),
            page_id: page_id.to_string(),
            parent_id,
            content: trimmed.to_string(),
            order_weight: order_counter,
            is_collapsed: false,
            block_type: BlockType::Bullet,
            language: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        
        order_counter += 1.0;
        parent_stack.push((block.id.clone(), depth));
        blocks.push(block);
    }
    
    blocks
}
```

### 9.3 미러링 서비스 (비동기)

```rust
// src-tauri/src/services/markdown_mirror.rs (계속)

use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use std::collections::HashSet;

pub struct MarkdownMirrorService {
    sender: mpsc::Sender<MirrorCommand>,
}

enum MirrorCommand {
    QueuePage(String),  // page_id
    Shutdown,
}

impl MarkdownMirrorService {
    pub fn new(db_path: String) -> Self {
        let (sender, receiver) = mpsc::channel();
        
        // 백그라운드 스레드
        thread::spawn(move || {
            let mut pending_pages: HashSet<String> = HashSet::new();
            let debounce_duration = Duration::from_secs(1);
            
            loop {
                match receiver.recv_timeout(debounce_duration) {
                    Ok(MirrorCommand::QueuePage(page_id)) => {
                        pending_pages.insert(page_id);
                    }
                    Ok(MirrorCommand::Shutdown) => {
                        // 남은 페이지 처리 후 종료
                        for page_id in pending_pages.drain() {
                            let _ = mirror_page_to_file(&db_path, &page_id);
                        }
                        break;
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Debounce 타임아웃: 대기 중인 페이지 처리
                        for page_id in pending_pages.drain() {
                            let _ = mirror_page_to_file(&db_path, &page_id);
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });
        
        Self { sender }
    }
    
    pub fn queue_mirror(&self, page_id: String) {
        let _ = self.sender.send(MirrorCommand::QueuePage(page_id));
    }
    
    pub fn shutdown(&self) {
        let _ = self.sender.send(MirrorCommand::Shutdown);
    }
}

fn mirror_page_to_file(db_path: &str, page_id: &str) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| e.to_string())?;
    
    // 페이지 정보 조회
    let (title, file_path): (String, Option<String>) = conn.query_row(
        "SELECT title, file_path FROM pages WHERE id = ?",
        [page_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| e.to_string())?;
    
    // 블록들 조회
    let mut stmt = conn.prepare("
        SELECT id, page_id, parent_id, content, order_weight, 
               is_collapsed, block_type, language, created_at, updated_at
        FROM blocks WHERE page_id = ?
    ").map_err(|e| e.to_string())?;
    
    let blocks: Vec<Block> = stmt.query_map([page_id], |row| {
        Ok(Block {
            id: row.get(0)?,
            page_id: row.get(1)?,
            parent_id: row.get(2)?,
            content: row.get(3)?,
            order_weight: row.get(4)?,
            is_collapsed: row.get::<_, i32>(5)? != 0,
            block_type: parse_block_type(row.get::<_, String>(6)?),
            language: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| e.to_string())?;
    
    // 마크다운 생성
    let markdown = blocks_to_markdown(&blocks);
    
    // 파일 경로 결정
    if let Some(path) = file_path {
        std::fs::write(&path, markdown)
            .map_err(|e| format!("Failed to write file: {}", e))?;
    }
    
    Ok(())
}
```

---

## 10. 디렉토리 구조

### 10.1 Rust (src-tauri)

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── src/
│   ├── main.rs                 # 진입점
│   ├── lib.rs                  # Tauri 앱 설정
│   │
│   ├── db/
│   │   ├── mod.rs
│   │   ├── connection.rs       # DB 연결 풀 관리
│   │   ├── schema.rs           # 테이블 생성 SQL
│   │   └── migrations.rs       # 스키마 마이그레이션
│   │
│   ├── models/
│   │   ├── mod.rs
│   │   ├── page.rs             # Page 구조체
│   │   └── block.rs            # Block 구조체 + DTO
│   │
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── workspace.rs        # 워크스페이스 선택/설정
│   │   ├── page.rs             # 페이지 CRUD
│   │   └── block.rs            # 블록 CRUD + 조작
│   │
│   ├── services/
│   │   ├── mod.rs
│   │   └── markdown_mirror.rs  # 마크다운 미러링
│   │
│   └── utils/
│       ├── mod.rs
│       └── fractional_index.rs # Fractional Indexing 유틸
│
└── data/
    └── outliner.db             # SQLite DB 파일 (런타임 생성)
```

### 10.2 Frontend (src)

```
src/
├── main.tsx                    # React 진입점
├── App.tsx                     # 메인 앱 컴포넌트
├── index.css                   # 글로벌 스타일
├── vite-env.d.ts
│
├── stores/
│   ├── blockStore.ts           # 블록 상태 (Zustand + Immer)
│   ├── pageStore.ts            # 페이지 목록 상태
│   └── workspaceStore.ts       # 워크스페이스 상태
│
├── hooks/
│   ├── useDebouncedBlockUpdate.ts
│   ├── useBlockNavigation.ts   # 키보드 네비게이션
│   └── useBlockDragDrop.ts     # 드래그앤드롭 (향후)
│
├── components/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── PageTree.tsx
│   │   └── PageItem.tsx
│   │
│   └── common/
│       ├── Button.tsx
│       └── Input.tsx
│
├── outliner/
│   ├── BlockEditor.tsx         # 메인 에디터 (가상 스크롤)
│   ├── BlockEditor.css
│   ├── BlockRow.tsx            # 가상화 래퍼
│   ├── BlockComponent.tsx      # 개별 블록 (memo)
│   ├── BlockContent.tsx        # CodeMirror 래퍼
│   ├── blockKeybindings.ts     # 키 바인딩 설정
│   └── types.ts                # 타입 정의
│
├── api/
│   └── tauri.ts                # Tauri invoke 래퍼
│
└── utils/
    ├── markdown.ts             # 마크다운 유틸 (프리뷰용)
    └── constants.ts
```

---

## 11. 구현 가이드

### 11.1 Phase 1: SQLite 기반 구축

**목표**: Rust에 SQLite 연동, 기본 스키마 생성

#### 작업 목록

1. **Cargo.toml 의존성 추가** ✅
   ```toml
   [dependencies]
   rusqlite = { version = "0.31", features = ["bundled"] }
   uuid = { version = "1.0", features = ["v4"] }
   chrono = { version = "0.4", features = ["serde"] }
   ```

2. **DB 모듈 생성** ✅
   - `src-tauri/src/db/mod.rs` ✅
   - `src-tauri/src/db/connection.rs`: 연결 풀 초기화 ✅
   - `src-tauri/src/db/schema.rs`: CREATE TABLE SQL ✅

3. **앱 시작 시 DB 초기화** ✅
   - `lib.rs`의 `setup` 훅에서 DB 연결 ✅
   - 테이블 없으면 생성 ✅

4. **테스트** 🔄 (Pending)
   - 앱 시작 시 `data/outliner.db` 파일 생성 확인
   - 테이블 구조 확인

#### 예상 소요 시간: 2-3시간

**진행상황**: DB 모듈 구축 완료, 스키마 초기화 구현됨 (2025-01-17)

---

### 11.2 Phase 2: Block CRUD 명령어 ✅

**목표**: 블록 생성/읽기/수정/삭제 Tauri 명령어 구현

#### 작업 목록

1. **모델 정의** ✅
   - `src-tauri/src/models/block.rs` ✅
   - `src-tauri/src/models/page.rs` ✅

2. **Fractional Indexing 유틸** ✅
   - `src-tauri/src/utils/fractional_index.rs` ✅

3. **Block 명령어 구현** ✅
   - `get_page_blocks`: 페이지의 모든 블록 조회 ✅
   - `create_block`: 새 블록 생성 ✅
   - `update_block`: 블록 내용 수정 ✅
   - `delete_block`: 블록 삭제 (자손 포함) ✅

4. **Page 명령어 구현** ✅
   - `get_pages`: 페이지 목록 ✅
   - `create_page`: 새 페이지 ✅
   - `update_page`: 페이지 수정 ✅
   - `delete_page`: 페이지 삭제 ✅

5. **lib.rs에 명령어 등록** ✅

6. **테스트** 🔄 (Pending)
   - 프론트에서 `invoke` 호출 테스트
   - DB에 데이터 저장 확인

#### 예상 소요 시간: 4-6시간

**진행상황**: Block/Page CRUD 명령어 모두 구현 완료 (2025-01-17)

---

### 11.3 Phase 3: Block 조작 명령어 ✅

**목표**: 들여쓰기/내어쓰기/이동/접기 구현

#### 작업 목록

1. **헬퍼 함수 구현** ✅
   - `find_previous_sibling`: 이전 형제 찾기 ✅
   - `collect_descendant_ids`: 자손 ID 수집 (재귀 CTE) ✅

2. **조작 명령어 구현** ✅
   - `indent_block`: 이전 형제의 자식으로 ✅
   - `outdent_block`: 부모의 형제로 ✅
   - `move_block`: 임의 위치로 이동 ✅
   - `toggle_collapse`: 접기/펼치기 ✅

3. **테스트** 🔄 (Pending)
   - 복잡한 트리에서 들여쓰기/내어쓰기
   - Fractional Indexing 동작 확인

#### 예상 소요 시간: 3-4시간

**진행상황**: Block 조작 명령어 모두 구현 완료 (Phase 2와 함께) (2025-01-17)

---

### 11.4 Phase 4: Zustand 스토어 재작성 ✅

**목표**: 정규화된 상태 관리, Optimistic Update

#### 작업 목록

1. **의존성 추가** ✅
   ```bash
   npm install immer react-virtuoso
   ```

2. **blockStore.ts 작성** ✅
   - 섹션 7.1의 코드 기반 ✅
   - `blocksById`, `childrenMap` 구조 ✅
   - Optimistic Update 패턴 ✅

3. **Selector Hooks 작성** ✅
   - `useBlock(id)` ✅
   - `useChildrenIds(parentId)` ✅
   - `useFocusedBlockId()` ✅

4. **Debounced Update Hook** ✅
   - `useDebouncedBlockUpdate` ✅

5. **기존 코드 정리**
   - `blockReducer.ts` 삭제 또는 아카이브
   - `blockUtils.ts` 정리

#### 예상 소요 시간: 4-5시간

**진행상황**: Zustand 스토어, Optimistic Update, Selector Hooks 모두 구현 완료 (2025-01-17)

---

### 11.5 Phase 5: 컴포넌트 연동 ✅

**목표**: UI 컴포넌트를 새 스토어에 연결

#### 작업 목록

1. **BlockEditor 수정** ✅
   - 가상 스크롤 (react-virtuoso) 적용 ✅
   - `useFlattenedBlocks` 훅 ✅

2. **BlockComponent 수정** ✅
   - `useBlock` 셀렉터 사용 ✅
   - `memo`로 최적화 ✅
   - 키 이벤트 핸들러 ✅

3. **BlockRow 생성** ✅
   - 가상화 래퍼 컴포넌트 ✅

4. **AppContent 임시 수정** ✅
   - 마이그레이션 중 상태 반영 ✅

5. **테스트** 🔄 (Pending)
   - 블록 생성/수정/삭제
   - 가상 스크롤 성능

#### 예상 소요 시간: 5-7시간

**진행상황**: BlockEditor, BlockComponent, BlockRow 모두 Zustand 스토어 기반으로 재구현 완료 (2025-01-17)

---

### 11.6 Phase 6: 마크다운 미러링 ✅

**목표**: DB 변경 시 마크다운 파일 자동 업데이트

#### 작업 목록

1. **미러링 서비스 구현** ✅
   - `MarkdownMirrorService` ✅
   - Debounce 로직 ✅

2. **블록 → 마크다운 변환** ✅
   - `blocks_to_markdown` ✅

3. **Command에서 미러링 트리거** ✅
   - `queue_mirror` 명령어 ✅

4. **테스트** 🔄 (Pending)
   - 블록 수정 후 1초 뒤 파일 확인
   - 연속 수정 시 마지막만 저장

#### 예상 소요 시간: 3-4시간

**진행상황**: MarkdownMirrorService, blocks_to_markdown, queue_mirror 명령어 모두 구현 완료 (2025-01-17)

---

### 11.7 Phase 7: 마이그레이션 ✅

**목표**: 기존 마크다운 파일을 SQLite로 임포트

#### 작업 목록

1. **마크다운 → 블록 파싱** ✅
   - `markdown_to_blocks` ✅
   - 들여쓰기 기반 부모-자식 관계 ✅

2. **워크스페이스 마이그레이션** ✅
   - `migrate_workspace` 명령어 ✅
   - 모든 .md 파일 자동 발견 및 임포트 ✅

3. **MigrationResult 구조체** ✅
   - 마이그레이션된 페이지/블록 수 반환 ✅

4. **테스트** 🔄 (Pending)
   - 기존 워크스페이스로 열기
   - 블록 구조 확인

#### 예상 소요 시간: 2-3시간

**진행상황**: markdown_to_blocks, migrate_workspace 명령어 모두 구현 완료 (2025-01-17)

---

## 12. 마이그레이션 전략

### 12.1 기존 데이터 처리

```
┌─────────────────────────────────────────────────────────┐
│ 워크스페이스 선택 시                                      │
├─────────────────────────────────────────────────────────┤
│ 1. outliner.db 존재?                                    │
│    ├─ YES → DB에서 로드                                 │
│    └─ NO  → 2번으로                                     │
│                                                         │
│ 2. .md 파일 존재?                                       │
│    ├─ YES → 마이그레이션 다이얼로그                      │
│    │        "기존 마크다운 파일을 가져올까요?"            │
│    │        [가져오기] [새로 시작]                       │
│    └─ NO  → 빈 워크스페이스로 시작                       │
│                                                         │
│ 3. 가져오기 선택 시                                      │
│    - 각 .md 파일 → Page로 변환                          │
│    - 파일 내용 파싱 → Blocks로 변환                      │
│    - DB에 저장                                          │
│    - 원본 파일은 유지 (백업)                             │
└─────────────────────────────────────────────────────────┘
```

### 12.2 마이그레이션 코드

```rust
// src-tauri/src/commands/workspace.rs

#[tauri::command]
pub async fn migrate_workspace(
    db: State<'_, DbPool>,
    workspace_path: String
) -> Result<MigrationResult, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let mut migrated_pages = 0;
    let mut migrated_blocks = 0;
    
    // .md 파일 찾기
    let md_files: Vec<_> = std::fs::read_dir(&workspace_path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s == "md")
                .unwrap_or(false)
        })
        .collect();
    
    for entry in md_files {
        let path = entry.path();
        let file_name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled");
        
        let content = std::fs::read_to_string(&path)
            .map_err(|e| e.to_string())?;
        
        // 페이지 생성
        let page_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT INTO pages (id, title, file_path, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![
                &page_id,
                file_name,
                path.to_string_lossy().to_string(),
                &now,
                &now
            ]
        ).map_err(|e| e.to_string())?;
        
        // 블록 파싱 및 생성
        let blocks = markdown_to_blocks(&content, &page_id);
        
        for block in &blocks {
            conn.execute(
                "INSERT INTO blocks (id, page_id, parent_id, content, order_weight, 
                                    block_type, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![
                    &block.id,
                    &block.page_id,
                    &block.parent_id,
                    &block.content,
                    block.order_weight,
                    block.block_type.to_string(),
                    &block.created_at,
                    &block.updated_at
                ]
            ).map_err(|e| e.to_string())?;
        }
        
        migrated_pages += 1;
        migrated_blocks += blocks.len();
    }
    
    Ok(MigrationResult {
        pages: migrated_pages,
        blocks: migrated_blocks,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationResult {
    pages: usize,
    blocks: usize,
}
```

---

## 부록: 참고 자료

### A. Fractional Indexing 심화

- [Implementing Fractional Indexing](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)
- [fractional-indexing npm package](https://github.com/rocicorp/fractional-indexing)

### B. 유사 프로젝트

- [Logseq](https://github.com/logseq/logseq) - Clojure + Datascript
- [Obsidian](https://obsidian.md) - 파일 기반
- [Roam Research](https://roamresearch.com) - 그래프 DB

### C. 성능 벤치마크 목표

| 항목 | 목표 |
|------|------|
| 페이지 로드 (1000 블록) | < 100ms |
| 블록 생성 (UI 반영) | < 16ms |
| 블록 수정 (UI 반영) | < 16ms |
| 가상 스크롤 FPS | 60fps |
| 마크다운 미러링 | < 500ms (백그라운드) |

---

## 체크리스트

구현 시 각 항목을 체크하세요:

### Phase 1: SQLite
- [ ] rusqlite 의존성 추가
- [ ] DB 연결 모듈 (`connection.rs`)
- [ ] 스키마 생성 (`schema.rs`)
- [ ] 앱 시작 시 DB 초기화

### Phase 2: Block CRUD
- [ ] Block 모델 정의
- [ ] Page 모델 정의
- [ ] Fractional Indexing 유틸
- [ ] `get_page_blocks` 구현
- [ ] `create_block` 구현
- [ ] `update_block` 구현
- [ ] `delete_block` 구현
- [ ] 명령어 등록

### Phase 3: Block 조작
- [ ] `indent_block` 구현
- [ ] `outdent_block` 구현
- [ ] `move_block` 구현
- [ ] `toggle_collapse` 구현

### Phase 4: Zustand
- [ ] immer 설치
- [ ] react-virtuoso 설치
- [ ] `blockStore.ts` 작성
- [ ] Selector hooks 작성
- [ ] Debounced update hook

### Phase 5: 컴포넌트
- [ ] `BlockEditor` 수정
- [ ] `BlockComponent` 수정
- [ ] 가상 스크롤 적용
- [ ] 키보드 네비게이션

### Phase 6: 미러링
- [ ] `MarkdownMirrorService`
- [ ] `blocks_to_markdown`
- [ ] 트리거 연동

### Phase 7: 마이그레이션
- [ ] `markdown_to_blocks`
- [ ] `migrate_workspace` 명령어
- [ ] 마이그레이션 UI

---

*문서 버전: 1.0*
*최종 수정: 2024*
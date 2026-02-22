use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::commands::workspace::open_workspace_db;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TodoFilter {
    pub status: Option<Vec<String>>,
    pub priority: Option<Vec<String>>,
    pub scheduled_from: Option<String>,
    pub scheduled_to: Option<String>,
    pub deadline_from: Option<String>,
    pub deadline_to: Option<String>,
    pub overdue_only: Option<bool>,
    pub page_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoResult {
    pub block_id: String,
    pub content: String,
    pub page_id: String,
    pub page_title: String,
    pub status: String,
    pub scheduled: Option<String>,
    pub deadline: Option<String>,
    pub priority: Option<String>,
}

#[tauri::command]
pub async fn query_todos(
    workspace_path: String,
    filter: TodoFilter,
) -> Result<Vec<TodoResult>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let status_filter = filter.status.clone().unwrap_or_else(|| {
        vec![
            "todo".to_string(),
            "doing".to_string(),
            "done".to_string(),
            "later".to_string(),
            "canceled".to_string(),
        ]
    });

    let status_placeholders: Vec<String> =
        status_filter.iter().map(|_| "?".to_string()).collect();
    let status_placeholders_str = status_placeholders.join(",");

    // Build the SQL with optional JOINs for scheduled, deadline, priority
    let mut sql = format!(
        r#"
        SELECT DISTINCT
            bm_status.block_id,
            b.content,
            b.page_id,
            p.title,
            bm_status.value as status,
            bm_sched.value as scheduled,
            bm_dead.value as deadline,
            bm_prio.value as priority
        FROM block_metadata bm_status
        JOIN blocks b ON b.id = bm_status.block_id
        JOIN pages p ON p.id = b.page_id
        LEFT JOIN block_metadata bm_sched
            ON bm_sched.block_id = bm_status.block_id AND bm_sched.key = 'scheduled'
        LEFT JOIN block_metadata bm_dead
            ON bm_dead.block_id = bm_status.block_id AND bm_dead.key = 'deadline'
        LEFT JOIN block_metadata bm_prio
            ON bm_prio.block_id = bm_status.block_id AND bm_prio.key = 'priority'
        WHERE bm_status.key = 'todoStatus'
          AND bm_status.value IN ({})
        "#,
        status_placeholders_str
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // Add status params
    for s in &status_filter {
        params.push(Box::new(s.clone()));
    }

    // Add priority filter
    if let Some(ref priorities) = filter.priority {
        let prio_placeholders: Vec<String> =
            priorities.iter().map(|_| "?".to_string()).collect();
        sql.push_str(&format!(
            " AND bm_prio.value IN ({})",
            prio_placeholders.join(",")
        ));
        for p in priorities {
            params.push(Box::new(p.clone()));
        }
    }

    // Add scheduled date range filter
    if let Some(ref from) = filter.scheduled_from {
        sql.push_str(" AND bm_sched.value >= ?");
        params.push(Box::new(from.clone()));
    }
    if let Some(ref to) = filter.scheduled_to {
        sql.push_str(" AND bm_sched.value <= ?");
        params.push(Box::new(to.clone()));
    }

    // Add deadline date range filter
    if let Some(ref from) = filter.deadline_from {
        sql.push_str(" AND bm_dead.value >= ?");
        params.push(Box::new(from.clone()));
    }
    if let Some(ref to) = filter.deadline_to {
        sql.push_str(" AND bm_dead.value <= ?");
        params.push(Box::new(to.clone()));
    }

    // Add overdue filter
    if filter.overdue_only.unwrap_or(false) {
        let today = Utc::now().format("%Y-%m-%d").to_string();
        sql.push_str(
            " AND bm_dead.value < ? AND bm_status.value NOT IN ('done', 'canceled')",
        );
        params.push(Box::new(today));
    }

    // Add page filter
    if let Some(ref page_id) = filter.page_id {
        sql.push_str(" AND b.page_id = ?");
        params.push(Box::new(page_id.clone()));
    }

    // Order by priority (A first), then by scheduled date
    sql.push_str(" ORDER BY bm_prio.value ASC, bm_sched.value ASC, b.updated_at DESC");

    let params_refs: Vec<&dyn rusqlite::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(TodoResult {
                block_id: row.get(0)?,
                content: row.get(1)?,
                page_id: row.get(2)?,
                page_title: row.get(3)?,
                status: row.get(4)?,
                scheduled: row.get(5)?,
                deadline: row.get(6)?,
                priority: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

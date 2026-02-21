use serde::{Deserialize, Serialize};

use crate::commands::workspace::open_workspace_db;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoFilter {
    pub status: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoResult {
    pub block_id: String,
    pub content: String,
    pub page_id: String,
    pub page_title: String,
    pub status: String,
}

#[tauri::command]
pub async fn query_todos(
    workspace_path: String,
    filter: TodoFilter,
) -> Result<Vec<TodoResult>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let status_filter = filter.status.unwrap_or_else(|| {
        vec![
            "todo".to_string(),
            "doing".to_string(),
            "done".to_string(),
            "later".to_string(),
            "canceled".to_string(),
        ]
    });

    let placeholders: Vec<String> = status_filter.iter().map(|_| "?".to_string()).collect();
    let placeholders_str = placeholders.join(",");

    let sql = format!(
        r#"
        SELECT 
            bm.block_id,
            b.content,
            b.page_id,
            p.title,
            bm.value as status
        FROM block_metadata bm
        JOIN blocks b ON b.id = bm.block_id
        JOIN pages p ON p.id = b.page_id
        WHERE bm.key = 'todoStatus'
          AND bm.value IN ({})
        ORDER BY b.updated_at DESC
        "#,
        placeholders_str
    );

    let params_vec: Vec<&dyn rusqlite::ToSql> = status_filter
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params_vec.as_slice(), |row| {
            Ok(TodoResult {
                block_id: row.get(0)?,
                content: row.get(1)?,
                page_id: row.get(2)?,
                page_title: row.get(3)?,
                status: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

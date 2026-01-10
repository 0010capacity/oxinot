use std::path::Path;
use std::process::Command;
use tauri::command;

#[derive(Debug, serde::Serialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub has_changes: bool,
    pub changed_files: Vec<String>,
    pub current_branch: String,
    pub remote_url: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct GitCommitResult {
    pub success: bool,
    pub message: String,
    pub commit_hash: Option<String>,
}

/// Initialize a git repository in the workspace
#[command]
pub async fn git_init(workspace_path: String) -> Result<bool, String> {
    let path = Path::new(&workspace_path);

    if !path.exists() {
        return Err("Workspace path does not exist".to_string());
    }

    // Check if already a git repo
    let git_dir = path.join(".git");
    if git_dir.exists() {
        return Ok(true);
    }

    // Initialize git repository
    let output = Command::new("git")
        .args(["init"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git init: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git init failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Create initial .gitignore
    let gitignore_path = path.join(".gitignore");
    if !gitignore_path.exists() {
        std::fs::write(&gitignore_path, ".DS_Store\n.oxinot/\n")
            .map_err(|e| format!("Failed to create .gitignore: {}", e))?;
    }

    // Create initial commit
    let _ = Command::new("git")
        .args(["add", ".gitignore"])
        .current_dir(path)
        .output();

    let _ = Command::new("git")
        .args(["commit", "-m", "Initial commit"])
        .current_dir(path)
        .output();

    Ok(true)
}

/// Check if workspace is a git repository
#[command]
pub async fn git_is_repo(workspace_path: String) -> Result<bool, String> {
    let path = Path::new(&workspace_path);
    let git_dir = path.join(".git");
    Ok(git_dir.exists() && git_dir.is_dir())
}

/// Get git status of the workspace
#[command]
pub async fn git_status(workspace_path: String) -> Result<GitStatus, String> {
    let path = Path::new(&workspace_path);

    // Check if git repo
    let is_repo = path.join(".git").exists();
    if !is_repo {
        return Ok(GitStatus {
            is_repo: false,
            has_changes: false,
            changed_files: vec![],
            current_branch: String::new(),
            remote_url: None,
        });
    }

    // Get current branch
    let branch_output = Command::new("git")
        .args(["branch", "--show-current"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to get current branch: {}", e))?;

    let current_branch = String::from_utf8_lossy(&branch_output.stdout)
        .trim()
        .to_string();

    // Get status
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to get git status: {}", e))?;

    let status_text = String::from_utf8_lossy(&status_output.stdout);
    let changed_files: Vec<String> = status_text.lines().map(|line| line.to_string()).collect();

    let has_changes = !changed_files.is_empty();

    // Get remote URL
    let remote_url = get_remote_url_internal(path);

    Ok(GitStatus {
        is_repo,
        has_changes,
        changed_files,
        current_branch,
        remote_url,
    })
}

/// Get git remote URL (internal helper)
fn get_remote_url_internal(path: &Path) -> Option<String> {
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(path)
        .output()
        .ok()?;

    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !url.is_empty() {
            return Some(url);
        }
    }
    None
}

/// Get git remote URL
#[command]
pub async fn git_get_remote_url(workspace_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&workspace_path);

    if !path.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    Ok(get_remote_url_internal(path))
}

/// Set git remote URL
#[command]
pub async fn git_set_remote_url(workspace_path: String, url: String) -> Result<String, String> {
    let path = Path::new(&workspace_path);

    if !path.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    // Check if remote 'origin' exists
    let check_output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to check remote: {}", e))?;

    let args = if check_output.status.success() {
        vec!["remote", "set-url", "origin", &url]
    } else {
        vec!["remote", "add", "origin", &url]
    };

    let output = Command::new("git")
        .args(&args)
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to set remote URL: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to set remote URL: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok("Remote URL set successfully".to_string())
}

/// Remove git remote
#[command]
pub async fn git_remove_remote(workspace_path: String) -> Result<String, String> {
    let path = Path::new(&workspace_path);

    if !path.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let output = Command::new("git")
        .args(["remote", "remove", "origin"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to remove remote: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // If remote doesn't exist, that's okay
        if !stderr.contains("No such remote") {
            return Err(format!("Failed to remove remote: {}", stderr));
        }
    }

    Ok("Remote removed successfully".to_string())
}

/// Commit changes with a message
#[command]
pub async fn git_commit(
    workspace_path: String,
    message: String,
) -> Result<GitCommitResult, String> {
    let path = Path::new(&workspace_path);

    // Check if git repo
    if !path.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    // Add all changes
    let add_output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to add changes: {}", e))?;

    if !add_output.status.success() {
        return Ok(GitCommitResult {
            success: false,
            message: format!(
                "Failed to add changes: {}",
                String::from_utf8_lossy(&add_output.stderr)
            ),
            commit_hash: None,
        });
    }

    // Check if there are changes to commit
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to check status: {}", e))?;

    if status_output.stdout.is_empty() {
        return Ok(GitCommitResult {
            success: true,
            message: "No changes to commit".to_string(),
            commit_hash: None,
        });
    }

    // Commit changes
    let commit_output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    if !commit_output.status.success() {
        return Ok(GitCommitResult {
            success: false,
            message: format!(
                "Commit failed: {}",
                String::from_utf8_lossy(&commit_output.stderr)
            ),
            commit_hash: None,
        });
    }

    // Get the commit hash
    let hash_output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to get commit hash: {}", e))?;

    let commit_hash = String::from_utf8_lossy(&hash_output.stdout)
        .trim()
        .to_string();

    Ok(GitCommitResult {
        success: true,
        message: "Changes committed successfully".to_string(),
        commit_hash: Some(commit_hash),
    })
}

/// Push changes to remote
#[command]
pub async fn git_push(workspace_path: String) -> Result<String, String> {
    let path = Path::new(&workspace_path);

    if !path.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let output = Command::new("git")
        .args(["push"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Push failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok("Pushed successfully".to_string())
}

/// Pull changes from remote
#[command]
pub async fn git_pull(workspace_path: String) -> Result<String, String> {
    let path = Path::new(&workspace_path);

    if !path.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let output = Command::new("git")
        .args(["pull"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to pull: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Pull failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok("Pulled successfully".to_string())
}

/// Get git log (recent commits)
#[command]
pub async fn git_log(workspace_path: String, limit: Option<usize>) -> Result<Vec<String>, String> {
    let path = Path::new(&workspace_path);

    if !path.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let limit_str = limit.unwrap_or(20).to_string();
    let output = Command::new("git")
        .args(["log", "--oneline", &format!("-{}", limit_str)])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to get log: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git log failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let log_text = String::from_utf8_lossy(&output.stdout);
    let commits: Vec<String> = log_text.lines().map(|line| line.to_string()).collect();

    Ok(commits)
}

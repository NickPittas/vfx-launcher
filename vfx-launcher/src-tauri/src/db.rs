use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};
use chrono::Utc;
use std::path::PathBuf;
use crate::logger;
use crate::paths;

// Use the paths module to determine database file path
pub fn get_database_path() -> PathBuf {
    paths::get_database_path()
}

pub fn get_connection() -> rusqlite::Result<Connection> {
    let db_path = get_database_path();
    logger::info(&format!("DB CONNECTION DEBUG: Attempting to open database at: {}", db_path.to_string_lossy()));
    
    // Check if the database file exists
    let db_exists = db_path.exists();
    if !db_exists {
        // Make sure the directory exists
        if let Some(parent_dir) = db_path.parent() {
            if !parent_dir.exists() {
                if let Err(e) = std::fs::create_dir_all(parent_dir) {
                    logger::error(&format!("Failed to create database directory {}: {}", parent_dir.display(), e));
                } else {
                    logger::info(&format!("Created database directory: {}", parent_dir.display()));
                }
            }
        }

        logger::warn("Database file does not exist. Will create a new one.");
    }
    
    match Connection::open(&db_path) {
        Ok(conn) => {
            logger::info("DB CONNECTION DEBUG: Successfully opened database connection");
            // Set pragmas for better performance and safety
            if let Err(e) = conn.execute("PRAGMA foreign_keys = ON;", []) {
                logger::warn(&format!("Failed to set foreign_keys pragma: {}", e));
            }
            
            // Set busy timeout to handle concurrent access
            match conn.query_row("PRAGMA busy_timeout = 5000;", [], |_| Ok(())) {
                Ok(_) => logger::info("Set busy_timeout pragma successfully"),
                Err(e) => logger::warn(&format!("Failed to set busy_timeout pragma: {}", e)),
            }
            
            // Use Write-Ahead Logging for better concurrency
            match conn.query_row("PRAGMA journal_mode = WAL;", [], |_| Ok(())) {
                Ok(_) => logger::info("Set journal_mode pragma successfully"),
                Err(e) => logger::warn(&format!("Failed to set journal_mode pragma: {}", e)),
            }
            
            // If this is a new database, initialize it
            if !db_exists {
                logger::info("New database detected, initializing schema...");
                if let Err(e) = init_db_with_admin(&conn) {
                    logger::error(&format!("Failed to initialize database: {}", e));
                }
            } else {
                // Even for existing databases, ensure admin exists
                if let Err(e) = ensure_admin_user_exists(&conn) {
                    logger::error(&format!("Failed to ensure admin user exists: {}", e));
                }
            }
            
            Ok(conn)
        },
        Err(e) => {
            let error_msg = format!("DB CONNECTION ERROR: Failed to open database at {}: {}", db_path.display(), e);
            logger::error(&error_msg);
            Err(e)
        }
    }
}

// Initialize database and create tables
pub fn init_db() -> Result<(), String> {
    let conn = match get_connection() {
        Ok(conn) => conn,
        Err(e) => return Err(format!("Failed to open DB: {}", e))
    };
    init_db_tables(&conn)
}

// Initialize database tables using an existing connection
fn init_db_tables(conn: &Connection) -> Result<(), String> {
    // Connection is now passed as a parameter
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            client TEXT,
            path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_files (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            version TEXT NOT NULL,
            file_type TEXT NOT NULL,
            path TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            parent_folder TEXT,
            shot_name TEXT,
            last_modified TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            nuke_executable_path TEXT,
            ae_executable_path TEXT,
            default_scan_subdirs TEXT,
            default_include_patterns TEXT,
            default_exclude_patterns TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_activity (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            activity_type TEXT NOT NULL,
            project_id INTEGER,
            file_id INTEGER,
            details TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY(file_id) REFERENCES project_files(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS user_favorites (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(user_id, project_id)
        );

        CREATE TABLE IF NOT EXISTS recent_projects (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            last_accessed TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(user_id, project_id)
        );
        ",
    ).map_err(|e| format!("Failed to create tables: {}", e))?;
    // Insert default settings row if absent
    conn.execute(
        "INSERT OR IGNORE INTO settings (id, default_scan_subdirs, default_include_patterns, default_exclude_patterns) VALUES (1, ?, ?, ?)",
        params!["nuke,ae", "*.nk,*.aep", ""],
    ).map_err(|e| format!("Failed to insert default settings: {}", e))?;
    
    Ok(())
}

// Initialize database with admin user
fn init_db_with_admin(conn: &Connection) -> Result<(), String> {
    // First initialize tables
    init_db_tables(conn)?;
    
    // Then ensure admin user exists
    ensure_admin_user_exists(conn)?;
    
    Ok(())
}

// Ensure admin user exists
fn ensure_admin_user_exists(conn: &Connection) -> Result<(), String> {
    use bcrypt::{hash, DEFAULT_COST};
    
    logger::info("Checking for admin user...");
    
    // Check if admin user exists
    let admin_exists: bool = conn.query_row(
        "SELECT 1 FROM users WHERE username = 'admin'",
        [],
        |_| Ok(true)
    ).unwrap_or(false);
    
    if !admin_exists {
        logger::info("Admin user does not exist, creating...");
        
        // Create admin user
        let password = "admin";
        logger::info(&format!("Setting admin password to: {}", password));
        
        let hashed = hash(password, DEFAULT_COST)
            .map_err(|e| format!("Failed to hash password: {}", e))?;
            
        let now = Utc::now().to_rfc3339();
        
        // Insert the admin user
        conn.execute(
            "INSERT INTO users (username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?)",
            params!["admin", hashed, "admin@example.com", "admin", now]
        ).map_err(|e| format!("Failed to create admin user: {}", e))?;
        
        logger::info("Admin user created successfully");
    } else {
        logger::info("Admin user already exists");
    }
    
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub client: Option<String>,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_favorite: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_accessed: Option<String>,
}

#[tauri::command]
pub fn get_projects(user_id: Option<i64>) -> Result<Vec<Project>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    // Base query for projects
    let mut sql = String::from(
        "SELECT p.id, p.name, p.client, p.path, p.created_at, p.updated_at"
    );
    
    // If user_id is provided, we'll also check if each project is favorited by the user
    if let Some(_uid) = user_id {
        sql.push_str(", 
            (SELECT EXISTS(SELECT 1 FROM user_favorites WHERE user_id = ? AND project_id = p.id)) as is_favorite,
            (SELECT last_accessed FROM recent_projects WHERE user_id = ? AND project_id = p.id) as last_accessed");
    }
    
    sql.push_str(" FROM projects p ORDER BY p.id DESC");
    
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    
    // Define a function to map query results to Project objects
    let map_fn = |row: &rusqlite::Row| -> rusqlite::Result<Project> {
        let id: i64 = row.get(0)?;
        let name: String = row.get(1)?;
        let client: Option<String> = row.get(2)?;
        let path: String = row.get(3)?;
        let created_at: String = row.get(4)?;
        let updated_at: String = row.get(5)?;
        
        // Try to get is_favorite and last_accessed, handle error if columns don't exist
        let is_favorite = row.get::<_, i64>(6).map(|val| Some(val == 1)).unwrap_or(None);
        let last_accessed = row.get::<_, String>(7).ok();
        
        Ok(Project {
            id,
            name,
            client,
            path,
            created_at,
            updated_at,
            is_favorite,
            last_accessed,
        })
    };
    
    // Query with appropriate parameters
    let projects: Vec<Project> = if let Some(uid) = user_id {
        stmt.query_map(params![uid, uid], map_fn)
    } else {
        stmt.query_map([], map_fn)
    }.map_err(|e| e.to_string())?
      .map(|p| p.unwrap())
      .collect();
    
    Ok(projects)
}

#[tauri::command]
pub fn add_project(name: String, path: String, client: Option<String>) -> Result<i64, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO projects (name, client, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        params![name, client, path, now, now],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn delete_project(projectId: i64) -> Result<bool, String> {
    // Simple log to confirm function is being called
    println!("DELETE: Deleting project with ID {}", projectId);
    logger::info(&format!("DELETE: Starting deletion of project ID: {}", projectId));
    
    // Use get_connection instead of direct connection for consistency
    let mut conn = match get_connection() {
        Ok(conn) => conn,
        Err(e) => {
            let err = format!("Failed to connect to database: {}", e);
            logger::error(&err);
            return Err(err);
        }
    };
    
    // Use simple, direct approach without transactions for now
    // First delete related records to avoid constraint violations
    let files_result = conn.execute("DELETE FROM project_files WHERE project_id = ?", params![projectId]);
    match files_result {
        Ok(count) => println!("Deleted {} project files", count),
        Err(e) => println!("Warning: couldn't delete project files: {}", e)
    }
    
    // Delete recent projects references
    let recents_result = conn.execute("DELETE FROM recent_projects WHERE project_id = ?", params![projectId]);
    match recents_result {
        Ok(count) => println!("Deleted {} recent project entries", count),
        Err(e) => println!("Warning: couldn't delete recent projects: {}", e)
    }
    
    // Delete favorites
    let favorites_result = conn.execute("DELETE FROM user_favorites WHERE project_id = ?", params![projectId]);
    match favorites_result {
        Ok(count) => println!("Deleted {} favorites", count),
        Err(e) => println!("Warning: couldn't delete favorites: {}", e)
    }
    
    // Now delete the actual project
    println!("Attempting to delete project record...");
    let delete_result = conn.execute("DELETE FROM projects WHERE id = ?", params![projectId]);
    
    match delete_result {
        Ok(count) => {
            println!("SUCCESS: Deleted {} project(s) with ID {}", count, projectId);
            Ok(count > 0)
        },
        Err(e) => {
            let err_msg = format!("Error deleting project: {}", e);
            println!("{}", err_msg);
            Err(err_msg)
        }
    }
}

// Simple delete project function without all the complexity
#[tauri::command]
pub fn remove_project(project_id: i64) -> Result<bool, String> {
    // Get database connection directly
    match Connection::open(get_database_path()) {
        Ok(conn) => {
            // Start with a simple direct delete - no transaction
            match conn.execute("DELETE FROM projects WHERE id = ?", params![project_id]) {
                Ok(rows) => {
                    logger::info(&format!("Removed project {}, {} rows affected", project_id, rows));
                    Ok(rows > 0)
                },
                Err(e) => {
                    let msg = format!("Failed to remove project: {}", e);
                    logger::error(&msg);
                    Err(msg)
                }
            }
        },
        Err(e) => {
            let msg = format!("Database connection failed: {}", e);
            logger::error(&msg);
            Err(msg)
        }
    }
}

// Ultra-simple, focused delete function that avoids any complexity
#[tauri::command]
pub fn emergency_delete_project(projectId: i64) -> Result<String, String> {
    // Log to both terminal and logger
    let msg = format!("EMERGENCY DELETE: Project ID {}", projectId);
    println!("{}", msg);
    logger::info(&msg);
    
    // Open a simple direct connection
    let db_path = get_database_path();
    let mut conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => return Err(format!("DB connection failed: {}", e))
    };
    
    // Skip foreign keys for emergency delete
    match conn.execute("PRAGMA foreign_keys = OFF;", []) {
        Ok(_) => {},
        Err(e) => println!("Warning: Couldn't disable foreign keys: {}", e)
    }
    
    // Delete directly using our camelCase parameter
    match conn.execute("DELETE FROM projects WHERE id = ?", params![projectId]) {
        Ok(rows) => {
            let result = format!("Successfully deleted {} project(s)", rows);
            println!("{}", result);
            Ok(result)
        },
        Err(e) => {
            let err = format!("Delete failed: {}", e);
            println!("{}", err);
            Err(err)
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct ProjectFile {
    pub id: i64,
    pub project_id: i64,
    pub filename: String,
    pub version: String,
    pub file_type: String,
    pub path: String,
    pub relative_path: String,
    pub parent_folder: String,
    pub shot_name: Option<String>,
    pub last_modified: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_project_details(project_id: i64, user_id: Option<i64>) -> Result<Project, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    if let Some(uid) = user_id {
        // Update recent projects for this user
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO recent_projects (user_id, project_id, last_accessed) VALUES (?, ?, ?)",
            params![uid, project_id, now],
        ).map_err(|e| e.to_string())?;
        
        // Get project details with favorite status
        let project = conn.query_row(
            "SELECT p.id, p.name, p.client, p.path, p.created_at, p.updated_at,
             (SELECT EXISTS(SELECT 1 FROM user_favorites WHERE user_id = ? AND project_id = p.id)) as is_favorite,
             (SELECT last_accessed FROM recent_projects WHERE user_id = ? AND project_id = p.id) as last_accessed
             FROM projects p WHERE p.id = ?", 
            params![uid, uid, project_id],
            |row| Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                client: row.get(2)?,
                path: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                is_favorite: Some(row.get::<_, i64>(6)? == 1),
                last_accessed: row.get(7)?,
            }),
        ).map_err(|e| e.to_string())?;
        Ok(project)
    } else {
        // Get basic project details without user-specific info
        let project = conn.query_row(
            "SELECT id, name, client, path, created_at, updated_at FROM projects WHERE id = ?", 
            params![project_id],
            |row| Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                client: row.get(2)?,
                path: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                is_favorite: None,
                last_accessed: None,
            }),
        ).map_err(|e| e.to_string())?;
        Ok(project)
    }
}

#[tauri::command]
pub fn get_project_files(project_id: i64) -> Result<Vec<ProjectFile>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let files = conn.prepare(
        "SELECT id, project_id, filename, version, file_type, path, relative_path, parent_folder, shot_name, last_modified, created_at FROM project_files WHERE project_id = ? ORDER BY filename ASC, version DESC"
    ).map_err(|e| e.to_string())?
      .query_map(params![project_id], |row| Ok(ProjectFile {
            id: row.get(0)?,
            project_id: row.get(1)?,
            filename: row.get(2)?,
            version: row.get(3)?,
            file_type: row.get(4)?,
            path: row.get(5)?,
            relative_path: row.get(6)?,
            parent_folder: row.get(7)?,
            shot_name: row.get(8)?,
            last_modified: row.get(9)?,
            created_at: row.get(10)?,
        })).map_err(|e| e.to_string())?
      .map(|f| f.unwrap())
      .collect();
    Ok(files)
}

#[derive(Serialize, Deserialize)]
pub struct AppSettings {
    pub nuke_executable_path: Option<String>,
    pub ae_executable_path: Option<String>,
    pub default_scan_subdirs: Vec<String>,
    pub default_include_patterns: Vec<String>,
    pub default_exclude_patterns: Vec<String>,
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let row = conn.query_row(
        "SELECT nuke_executable_path, ae_executable_path, default_scan_subdirs, default_include_patterns, default_exclude_patterns FROM settings WHERE id = 1", 
        [],
        |row| {
            let scan: String = row.get(2)?;
            let include: String = row.get(3)?;
            let exclude: String = row.get(4)?;
            Ok(AppSettings {
                nuke_executable_path: row.get(0)?,
                ae_executable_path: row.get(1)?,
                default_scan_subdirs: scan.split(',').map(|s| s.trim().to_string()).collect(),
                default_include_patterns: include.split(',').map(|s| s.trim().to_string()).collect(),
                default_exclude_patterns: exclude.split(',').map(|s| s.trim().to_string()).collect(),
            })
        }
    ).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<bool, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let scan = settings.default_scan_subdirs.join(",");
    let include = settings.default_include_patterns.join(",");
    let exclude = settings.default_exclude_patterns.join(",");
    conn.execute(
        "UPDATE settings SET nuke_executable_path = ?, ae_executable_path = ?, default_scan_subdirs = ?, default_include_patterns = ?, default_exclude_patterns = ? WHERE id = 1", 
        params![settings.nuke_executable_path, settings.ae_executable_path, scan, include, exclude],
    ).map_err(|e| e.to_string())?;
    Ok(true)
}

#[derive(Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub email: Option<String>,
    pub role: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_recent_projects(user_id: i64, limit: Option<i64>) -> Result<Vec<Project>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    let limit_value = limit.unwrap_or(5);
    
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.client, p.path, p.created_at, p.updated_at, 
         (SELECT EXISTS(SELECT 1 FROM user_favorites WHERE user_id = ? AND project_id = p.id)) as is_favorite,
         r.last_accessed
         FROM recent_projects r
         JOIN projects p ON r.project_id = p.id
         WHERE r.user_id = ?
         ORDER BY r.last_accessed DESC
         LIMIT ?"
    ).map_err(|e| e.to_string())?;
    
    let projects = stmt.query_map(params![user_id, user_id, limit_value], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            client: row.get(2)?,
            path: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            is_favorite: Some(row.get::<_, i64>(6)? == 1),
            last_accessed: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?
      .map(|p| p.unwrap())
      .collect();
    
    Ok(projects)
}

#[tauri::command]
pub fn get_favorite_projects(user_id: i64) -> Result<Vec<Project>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.client, p.path, p.created_at, p.updated_at,
         (SELECT last_accessed FROM recent_projects WHERE user_id = ? AND project_id = p.id) as last_accessed
         FROM user_favorites f
         JOIN projects p ON f.project_id = p.id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let projects = stmt.query_map(params![user_id, user_id], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            client: row.get(2)?,
            path: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            is_favorite: Some(true),
            last_accessed: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
      .map(|p| p.unwrap())
      .collect();
    
    Ok(projects)
}

#[tauri::command]
pub fn toggle_favorite_project(user_id: i64, project_id: i64) -> Result<bool, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    
    // Check if project is already a favorite
    let is_favorite: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM user_favorites WHERE user_id = ? AND project_id = ?)",
        params![user_id, project_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    if is_favorite {
        // Remove from favorites
        conn.execute(
            "DELETE FROM user_favorites WHERE user_id = ? AND project_id = ?",
            params![user_id, project_id],
        ).map_err(|e| e.to_string())?;
        
        // Log activity
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO user_activity (user_id, activity_type, project_id, details, timestamp) VALUES (?, ?, ?, ?, ?)",
            params![user_id, "remove_favorite", project_id, "Removed project from favorites", now],
        ).map_err(|e| e.to_string())?;
        
        Ok(false) // Return new state (not favorited)
    } else {
        // Add to favorites
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO user_favorites (user_id, project_id, created_at) VALUES (?, ?, ?)",
            params![user_id, project_id, now],
        ).map_err(|e| e.to_string())?;
        
        // Log activity
        conn.execute(
            "INSERT INTO user_activity (user_id, activity_type, project_id, details, timestamp) VALUES (?, ?, ?, ?, ?)",
            params![user_id, "add_favorite", project_id, "Added project to favorites", now],
        ).map_err(|e| e.to_string())?;
        
        Ok(true) // Return new state (favorited)
    }
}

#[tauri::command]
pub fn get_users() -> Result<Vec<User>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let users = conn.prepare(
        "SELECT id, username, email, role, created_at FROM users ORDER BY id ASC"
    ).map_err(|e| e.to_string())?
      .query_map([], |row| Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            email: row.get(2)?,
            role: row.get(3)?,
            created_at: row.get(4)?,
        })).map_err(|e| e.to_string())?
      .map(|u| u.unwrap())
      .collect();
    Ok(users)
}

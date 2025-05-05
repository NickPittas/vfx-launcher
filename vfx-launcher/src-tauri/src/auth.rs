use serde::{Serialize, Deserialize};
use rusqlite::{params, Connection};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use crate::db;

// User authentication result
#[derive(Serialize, Deserialize)]
pub struct AuthResult {
    pub success: bool,
    pub user_id: Option<i64>,
    pub username: Option<String>,
    pub role: Option<String>,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub email: Option<String>,
    pub role: String,
    pub created_at: String,
}

// Initialize with admin user if none exists
pub fn init_users() -> Result<(), String> {
    println!("Initializing users...");
    let conn = db::get_connection().map_err(|e| {
        let err = e.to_string();
        println!("DB connection error in init_users: {}", err);
        err
    })?;
    
    // Check if we have any users
    let user_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    println!("Current user count: {}", user_count);
    
    // Check specifically for admin user
    let admin_exists: bool = conn.query_row(
        "SELECT 1 FROM users WHERE username = 'admin'",
        [],
        |_| Ok(true)
    ).unwrap_or(false);
    println!("Admin exists check: {}", admin_exists);
    
    // Always recreate admin user for debugging
    {
        // Update the admin user instead of deleting it (avoids foreign key constraints)
        println!("Force updating admin user password");
        println!("Resetting admin user password...");
        // Hash password manually (same as in add_user function)
        let plain_password = "admin";
        println!("Using plain password: {}", plain_password);
        let hashed = hash(plain_password, DEFAULT_COST).map_err(|e| e.to_string())?;
        println!("Generated hash: {} (length: {})", hashed, hashed.len());
        let now = Utc::now().to_rfc3339();
        
        if admin_exists {
            println!("Updating existing admin user's password");
            // Update the password of the existing admin user
            conn.execute(
                "UPDATE users SET password = ? WHERE username = 'admin'",
                params![hashed]
            ).map_err(|e| e.to_string())?;
        } else {
            // Insert admin user if it doesn't exist
            println!("Creating new admin user");
            conn.execute(
                "INSERT INTO users (username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?)",
                params!["admin", hashed, "admin@example.com", "admin", now]
            ).map_err(|e| e.to_string())?;
        }
        
        println!("Created/reset default admin user with username 'admin' and password 'admin'");
        
        // Verify the admin user was actually created
        let admin_check: bool = conn.query_row(
            "SELECT 1 FROM users WHERE username = 'admin'",
            [],
            |_| Ok(true)
        ).unwrap_or(false);
        println!("Admin user exists after creation: {}", admin_check);
        
        // Retrieve the admin password hash to verify it's stored correctly
        let admin_hash: String = conn.query_row(
            "SELECT password FROM users WHERE username = 'admin'",
            [],
            |row| row.get(0)
        ).unwrap_or_else(|_| "<failed to retrieve>".to_string());
        println!("Retrieved admin password hash: {} (length: {})", admin_hash, admin_hash.len());
    } // Close force recreation block
    
    Ok(())
}

// Login user
#[tauri::command]
pub fn login(username: String, password: String) -> Result<AuthResult, String> {
    println!("Login attempt: username='{}', password='{}'", username, password);
    let conn = db::get_connection().map_err(|e| {
        let err = e.to_string();
        println!("DB connection error: {}", err);
        err
    })?;
    
    // Count users for debugging
    let user_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0)
    ).unwrap_or(-1);
    println!("Total users in DB: {}", user_count);
    
    // Check if admin exists
    let admin_exists: bool = conn.query_row(
        "SELECT 1 FROM users WHERE username = 'admin'",
        [],
        |_| Ok(true)
    ).unwrap_or(false);
    println!("Admin user exists: {}", admin_exists);
    
    // Find user by username
    println!("Searching for user with username: {}", username);
    let result = conn.query_row(
        "SELECT id, username, password, role FROM users WHERE username = ?",
        params![username],
        |row| {
            let id = row.get::<_, i64>(0)?;
            let username = row.get::<_, String>(1)?;
            let hashed_pwd = row.get::<_, String>(2)?;
            let role = row.get::<_, String>(3)?;
            println!("Found user: id={}, username={}, role={}", id, username, role);
            Ok((id, username, hashed_pwd, role))
        }
    );
    
    match result {
        Ok((id, username, hashed_password, role)) => {
            // Verify password
            println!("Verifying password with bcrypt. Hash length: {}", hashed_password.len());
            match verify(&password, &hashed_password) {
                Ok(valid) => {
                    if valid {
                        // Password is correct
                        let now = Utc::now().to_rfc3339();
                        
                        // Log activity
                        conn.execute(
                            "INSERT INTO user_activity (user_id, activity_type, timestamp) VALUES (?, ?, ?)",
                            params![id, "login", now]
                        ).ok(); // Ignore logging errors
                        
                        Ok(AuthResult {
                            success: true,
                            user_id: Some(id),
                            username: Some(username),
                            role: Some(role),
                            message: "Login successful".to_string(),
                        })
                    } else {
                        // Password incorrect
                        Ok(AuthResult {
                            success: false,
                            user_id: None,
                            username: None,
                            role: None,
                            message: "Invalid password".to_string(),
                        })
                    }
                },
                Err(_) => {
                    // Error verifying password
                    Ok(AuthResult {
                        success: false,
                        user_id: None,
                        username: None,
                        role: None,
                        message: "Authentication error".to_string(),
                    })
                }
            }
        },
        Err(_) => {
            // User not found
            Ok(AuthResult {
                success: false,
                user_id: None,
                username: None,
                role: None,
                message: "User not found".to_string(),
            })
        }
    }
}

// Add a new user
#[tauri::command]
pub fn add_user(
    username: String,
    password: String,
    email: Option<String>,
    role: String
) -> Result<i64, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    
    // Check if username already exists
    let exists: bool = conn.query_row(
        "SELECT 1 FROM users WHERE username = ?",
        params![username],
        |_| Ok(true)
    ).unwrap_or(false);
    
    if exists {
        return Err("Username already exists".to_string());
    }
    
    // Hash password
    let hashed = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;
    
    // Insert new user
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO users (username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?)",
        params![username, hashed, email, role, now]
    ).map_err(|e| e.to_string())?;
    
    let id = conn.last_insert_rowid();
    Ok(id)
}

// Update user
#[tauri::command]
pub fn update_user(
    id: i64,
    email: Option<String>,
    role: Option<String>,
    new_password: Option<String>
) -> Result<bool, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    
    if let Some(password) = new_password {
        // Update with new password
        let hashed = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE users SET password = ?, email = ?, role = ? WHERE id = ?",
            params![hashed, email, role, id]
        ).map_err(|e| e.to_string())?;
    } else {
        // Update without changing password
        conn.execute(
            "UPDATE users SET email = ?, role = ? WHERE id = ?",
            params![email, role, id]
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(true)
}

// Delete user
#[tauri::command]
pub fn delete_user(id: i64) -> Result<bool, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    
    // Don't allow deleting the last admin
    let admin_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    if admin_count <= 1 {
        // Check if this user is an admin
        let is_admin: bool = conn.query_row(
            "SELECT role = 'admin' FROM users WHERE id = ?",
            params![id],
            |row| row.get(0)
        ).unwrap_or(false);
        
        if is_admin {
            return Err("Cannot delete the last admin user".to_string());
        }
    }
    
    conn.execute(
        "DELETE FROM users WHERE id = ?",
        params![id]
    ).map_err(|e| e.to_string())?;
    
    Ok(true)
}

// Log user activity
#[tauri::command]
pub fn log_activity(
    user_id: i64,
    activity_type: String,
    project_id: Option<i64>,
    file_id: Option<i64>,
    details: Option<String>
) -> Result<i64, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO user_activity (user_id, activity_type, project_id, file_id, details, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?)",
        params![user_id, activity_type, project_id, file_id, details, now]
    ).map_err(|e| e.to_string())?;
    
    let id = conn.last_insert_rowid();
    Ok(id)
}

// Get user activity logs
#[tauri::command]
pub fn get_activity_logs(
    user_id: Option<i64>,
    limit: Option<i64>,
    activity_type: Option<String>
) -> Result<Vec<serde_json::Value>, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    
    // Build the query with optional filters
    let mut sql = String::from(
        "SELECT 
            a.id, a.user_id, u.username, a.activity_type, 
            a.project_id, p.name as project_name, 
            a.file_id, f.filename as file_name, 
            a.details, a.timestamp 
         FROM user_activity a 
         LEFT JOIN users u ON a.user_id = u.id 
         LEFT JOIN projects p ON a.project_id = p.id 
         LEFT JOIN project_files f ON a.file_id = f.id 
         WHERE 1=1"
    );
    
    // Collect all parameters first
    let mut user_filter = None;
    let mut activity_filter = None;
    let mut limit_filter = None;
    
    // Add filters if provided
    if let Some(uid) = user_id {
        sql.push_str(" AND a.user_id = ?");
        user_filter = Some(uid);
    }
    
    if let Some(activity) = &activity_type {
        sql.push_str(" AND a.activity_type = ?");
        activity_filter = Some(activity);
    }
    
    // Order by timestamp descending and apply limit
    sql.push_str(" ORDER BY a.timestamp DESC");
    
    if let Some(limit_value) = limit {
        sql.push_str(" LIMIT ?");
        limit_filter = Some(limit_value);
    }
    
    // Now create the params vector
    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
    
    if let Some(uid) = &user_filter {
        params.push(uid);
    }
    
    if let Some(activity) = &activity_filter {
        params.push(activity);
    }
    
    if let Some(limit_value) = &limit_filter {
        params.push(limit_value);
    }
    
    // Execute the query
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map(params.as_slice(), |row| {
        let mut activity = serde_json::Map::new();
        
        activity.insert("id".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<_, i64>(0)?)));
        activity.insert("user_id".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<_, i64>(1)?)));
        
        // Username
        if let Ok(username) = row.get::<_, String>(2) {
            activity.insert("username".to_string(), serde_json::Value::String(username));
        }
        
        // Activity type
        if let Ok(activity_type) = row.get::<_, String>(3) {
            activity.insert("activity_type".to_string(), serde_json::Value::String(activity_type));
        }
        
        // Project ID
        if let Ok(project_id) = row.get::<_, i64>(4) {
            activity.insert("project_id".to_string(), serde_json::Value::Number(serde_json::Number::from(project_id)));
        }
        
        // Project name
        if let Ok(project_name) = row.get::<_, String>(5) {
            activity.insert("project_name".to_string(), serde_json::Value::String(project_name));
        }
        
        // File ID
        if let Ok(file_id) = row.get::<_, i64>(6) {
            activity.insert("file_id".to_string(), serde_json::Value::Number(serde_json::Number::from(file_id)));
        }
        
        // File name
        if let Ok(file_name) = row.get::<_, String>(7) {
            activity.insert("file_name".to_string(), serde_json::Value::String(file_name));
        }
        
        // Details
        if let Ok(details) = row.get::<_, String>(8) {
            activity.insert("details".to_string(), serde_json::Value::String(details));
        }
        
        // Timestamp
        if let Ok(timestamp) = row.get::<_, String>(9) {
            activity.insert("timestamp".to_string(), serde_json::Value::String(timestamp));
        }
        
        Ok(serde_json::Value::Object(activity))
    }).map_err(|e| e.to_string())?;
    
    let mut activities: Vec<serde_json::Value> = Vec::new();
    for row in rows {
        activities.push(row.unwrap());
    }
    
    Ok(activities)
}

// Check if file is being used by another user
#[tauri::command]
pub fn check_file_usage(
    file_id: i64,
    current_user_id: i64
) -> Result<Option<String>, String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    
    // Look for recent activity (last 30 minutes) from other users
    let thirty_mins_ago = (Utc::now() - chrono::Duration::minutes(30)).to_rfc3339();
    
    let result = conn.query_row(
        "SELECT u.username FROM user_activity a 
         JOIN users u ON a.user_id = u.id 
         WHERE a.file_id = ? AND a.user_id != ? AND a.activity_type = 'open_file' 
         AND a.timestamp > ? 
         ORDER BY a.timestamp DESC 
         LIMIT 1",
        params![file_id, current_user_id, thirty_mins_ago],
        |row| row.get::<_, String>(0)
    );
    
    match result {
        Ok(username) => Ok(Some(username)),
        Err(_) => Ok(None) // No recent activity from other users
    }
}

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use crate::db::ProjectFile;
use crate::logger;
use chrono::Utc;
use rusqlite::{params, Connection};
use regex::Regex;

// Scan project directory for files
#[tauri::command]
pub fn scan_project(project_id: i64, project_path: String, include_patterns: Vec<String>, scan_dirs: Vec<String>) -> Result<Vec<ProjectFile>, String> {
    logger::info(&format!("Starting scan for project ID: {}", project_id));
    logger::info(&format!("Project path: {}", project_path));
    logger::info(&format!("Include patterns: {:?}", include_patterns));
    logger::info(&format!("Scan directories: {:?}", scan_dirs));
    
    let mut found_files: Vec<ProjectFile> = Vec::new();
    let path = Path::new(&project_path);
    
    if !path.exists() {
        let err_msg = format!("Project path does not exist: {}", project_path);
        logger::error(&err_msg);
        return Err(err_msg);
    }
    
    // Compile regex patterns for file types
    let patterns: Vec<Regex> = include_patterns.iter()
        .map(|pattern| {
            let pattern = pattern.replace("*", ".*").replace(".", "\\.");
            match Regex::new(&format!("^{}$", pattern)) {
                Ok(regex) => regex,
                Err(e) => {
                    logger::error(&format!("Invalid regex pattern '{}': {}", pattern, e));
                    // Fallback to a pattern that won't match anything
                    Regex::new("^$").unwrap()
                }
            }
        })
        .collect();
    
    // If scan_dirs is empty or contains "." or "*", scan the entire project directory
    let dirs_to_scan: Vec<PathBuf> = if scan_dirs.is_empty() || scan_dirs.iter().any(|d| d == "." || d == "*") {
        logger::info("Scanning entire project directory");
        vec![path.to_path_buf()]
    } else {
        scan_dirs.iter()
            .map(|dir_name| path.join(dir_name))
            .filter(|scan_path| {
                let exists = scan_path.exists();
                let is_dir = exists && scan_path.is_dir();
                if !exists {
                    logger::warn(&format!("Directory does not exist: {}", scan_path.display()));
                } else if !is_dir {
                    logger::warn(&format!("Path is not a directory: {}", scan_path.display()));
                }
                is_dir
            })
            .collect()
    };
    
    logger::info(&format!("Directories to scan: {}", dirs_to_scan.len()));
    
    for scan_path in dirs_to_scan {
        logger::info(&format!("Scanning directory: {}", scan_path.display()));
        
        // Walk directory recursively
        if let Err(e) = walk_dir(&scan_path, path, &patterns, project_id, &mut found_files) {
            let err_msg = format!("Error scanning directory {}: {}", scan_path.display(), e);
            logger::error(&err_msg);
        }
    }
    
    logger::info(&format!("Found {} files", found_files.len()));
    
    // Store files in database
    match store_files(project_id, &found_files) {
        Ok(_) => logger::info(&format!("Successfully stored {} files in database", found_files.len())),
        Err(e) => {
            let err_msg = format!("Error storing files in database: {}", e);
            logger::error(&err_msg);
            return Err(err_msg);
        }
    }
    
    logger::info("Scan completed successfully");
    Ok(found_files)
}

fn walk_dir(
    dir: &Path, 
    project_root: &Path, 
    patterns: &[Regex],
    project_id: i64,
    found_files: &mut Vec<ProjectFile>
) -> Result<(), String> {
    logger::debug(&format!("Walking directory: {}", dir.display()));
    
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            let err_msg = format!("Failed to read directory {}: {}", dir.display(), e);
            logger::error(&err_msg);
            return Err(err_msg);
        }
    };
    
    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(e) => {
                logger::warn(&format!("Failed to read directory entry: {}", e));
                continue;
            }
        };
        
        let path = entry.path();
        
        if path.is_dir() {
            // Recursively scan subdirectories
            logger::debug(&format!("Found subdirectory: {}", path.display()));
            if let Err(e) = walk_dir(&path, project_root, patterns, project_id, found_files) {
                logger::warn(&format!("Error scanning subdirectory {}: {}", path.display(), e));
                // Continue with other directories even if one fails
            }
        } else if path.is_file() {
            // Process file
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                logger::debug(&format!("Checking file: {}", file_name));
                
                // Check if file matches any pattern
                let mut matched = false;
                for pattern in patterns {
                    if pattern.is_match(file_name) {
                        matched = true;
                        logger::debug(&format!("File {} matches pattern", file_name));
                        
                        // Get relative path from project root
                        let relative_path = match path.strip_prefix(project_root) {
                            Ok(rel_path) => rel_path.to_string_lossy().to_string(),
                            Err(e) => {
                                logger::warn(&format!("Failed to get relative path for {}: {}", path.display(), e));
                                continue;
                            }
                        };
                        
                        // Get parent folder
                        let parent_folder = path.parent()
                            .and_then(|p| p.strip_prefix(project_root).ok())
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();
                        
                        // Extract file type from extension
                        let file_type = path.extension()
                            .and_then(|ext| ext.to_str())
                            .unwrap_or("unknown")
                            .to_lowercase();
                        
                        // Get file metadata
                        let metadata = match fs::metadata(&path) {
                            Ok(meta) => meta,
                            Err(e) => {
                                logger::warn(&format!("Failed to get metadata for {}: {}", path.display(), e));
                                continue;
                            }
                        };
                        
                        let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                        
                        // Extract filename without extension
                        let filename_without_ext = path.file_stem()
                            .and_then(|n| n.to_str())
                            .unwrap_or(file_name)
                            .to_string();
                        
                        // Extract version from filename (if present)
                        let version_regex = Regex::new(r"v(\d+)$").unwrap();
                        let version = version_regex.captures(&filename_without_ext)
                            .and_then(|caps| caps.get(1))
                            .map(|m| m.as_str().to_string())
                            .unwrap_or_else(|| "1".to_string());
                        
                        // Extract shot name from parent folder (if available)
                        let shot_name = if parent_folder.contains("shot") || parent_folder.contains("shots") {
                            // Try to extract shot name from folder structure
                            let shot_regex = Regex::new(r"(?i)shots?[/\\]([^/\\]+)").unwrap();
                            shot_regex.captures(&parent_folder)
                                .and_then(|caps| caps.get(1))
                                .map(|m| m.as_str().to_string())
                        } else {
                            None
                        };
                        
                        // Create ProjectFile
                        let project_file = ProjectFile {
                            id: 0, // Will be set by database
                            project_id,
                            filename: filename_without_ext,
                            version,
                            file_type,
                            path: path.to_string_lossy().to_string(),
                            relative_path,
                            parent_folder,
                            shot_name,
                            last_modified: chrono::NaiveDateTime::from_timestamp_opt(
                                modified.duration_since(SystemTime::UNIX_EPOCH)
                                    .map(|d| d.as_secs() as i64)
                                    .unwrap_or(0), 0
                            )
                            .unwrap_or_else(|| chrono::NaiveDateTime::from_timestamp_opt(0, 0).unwrap())
                            .to_string(),
                            created_at: Utc::now().to_string(),
                        };
                        
                        logger::debug(&format!("Adding file: {} ({})", filename_without_ext, file_type));
                        found_files.push(project_file);
                        break; // No need to check other patterns
                    }
                }
                
                if !matched {
                    logger::debug(&format!("File {} did not match any patterns", file_name));
                }
            }
        }
    }
    
    Ok(())
}

fn store_files(project_id: i64, files: &[ProjectFile]) -> Result<(), String> {
    logger::info(&format!("Storing {} files for project {}", files.len(), project_id));
    
    if files.is_empty() {
        logger::info("No files to store");
        return Ok(());
    }
    
    let conn = Connection::open("vfx_launcher.db").map_err(|e| e.to_string())?;
    
    // Begin transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // First, clear existing files for this project
    logger::debug(&format!("Clearing existing files for project {}", project_id));
    tx.execute(
        "DELETE FROM project_files WHERE project_id = ?",
        params![project_id],
    ).map_err(|e| format!("Failed to clear existing files: {}", e))?;
    
    // Prepare statement for inserting files
    let mut stmt = tx.prepare(
        "INSERT INTO project_files (project_id, filename, version, file_type, path, relative_path, parent_folder, shot_name, last_modified, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).map_err(|e| format!("Failed to prepare insert statement: {}", e))?;
    
    // Insert each file
    for file in files {
        logger::debug(&format!("Storing file: {} ({})", file.filename, file.file_type));
        stmt.execute(params![
            file.project_id,
            file.filename,
            file.version,
            file.file_type,
            file.path,
            file.relative_path,
            file.parent_folder,
            file.shot_name,
            file.last_modified,
            file.created_at
        ]).map_err(|e| format!("Failed to insert file {}: {}", file.filename, e))?;
    }
    
    // Commit transaction
    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;
    
    logger::info(&format!("Successfully stored {} files for project {}", files.len(), project_id));
    Ok(())
}

// Open file in appropriate application
#[tauri::command]
pub fn open_file(file_path: String, app_path: String) -> Result<(), String> {
    logger::info(&format!("Opening file: {}", file_path));
    logger::info(&format!("Using application: {}", app_path));
    
    if app_path.is_empty() {
        let err_msg = "Application path is empty";
        logger::error(err_msg);
        return Err(err_msg.to_string());
    }
    
    if !Path::new(&file_path).exists() {
        let err_msg = format!("File does not exist: {}", file_path);
        logger::error(&err_msg);
        return Err(err_msg);
    }
    
    // Execute the command to open the file
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new(&app_path)
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg("-a")
            .arg(&app_path)
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new(&app_path)
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    logger::info(&format!("Successfully opened file: {}", file_path));
    Ok(())
}

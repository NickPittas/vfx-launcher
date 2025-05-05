use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use crate::db::ProjectFile;
use crate::logger;
use crate::paths;
use chrono::Utc;
use rusqlite::{params, Connection};
use regex::Regex;

// Scan project directory for files
#[tauri::command]
pub fn scan_project(project_id: i64, project_path: String, include_patterns: Vec<String>, scan_dirs: Vec<String>) -> Result<Vec<ProjectFile>, String> {
    let path = Path::new(&project_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Project path does not exist or is not a directory: {}", project_path));
    }
    
    logger::info(&format!("Scanning project at: {}", project_path));
    
    // Compile regex patterns
    let mut patterns = Vec::new();
    let mut has_nk = false;
    let mut has_aep = false;
    
    // Process include patterns
    for pattern_str in &include_patterns {
        logger::info(&format!("Processing include pattern: {}", pattern_str));
        
        // Check if pattern includes .nk or .aep files
        if pattern_str.contains(".nk") {
            has_nk = true;
        }
        if pattern_str.contains(".aep") {
            has_aep = true;
        }
        
        // Compile regex
        match Regex::new(pattern_str) {
            Ok(regex) => {
                logger::info(&format!("Added pattern: {}", pattern_str));
                patterns.push(regex);
            }
            Err(e) => {
                logger::warn(&format!("Invalid regex pattern {}: {}", pattern_str, e));
                // Continue with other patterns
            }
        }
    }
    
    // Add default patterns if not already included
    if !has_nk {
        logger::info("Adding default pattern for .nk files");
        if let Ok(regex) = Regex::new(r"\.nk$") {
            patterns.push(regex);
        }
    }
    
    if !has_aep {
        logger::info("Adding default pattern for .aep files");
        if let Ok(regex) = Regex::new(r"\.aep$") {
            patterns.push(regex);
        }
    }
    
    // Print all patterns for debugging
    for (i, pattern) in patterns.iter().enumerate() {
        logger::info(&format!("Pattern {}: {}", i, pattern));
    }
    
    logger::info(&format!("Using {} file patterns", patterns.len()));
    
    // Use provided scan_dirs or default to common VFX directories if empty
    let scan_dirs = if scan_dirs.is_empty() {
        vec![
            "project".to_string(),
            "projects".to_string(),
            "comp".to_string(),
            "animation".to_string(),
            "anim".to_string(),
            "05_comp".to_string(),
            "04_animation".to_string()
        ]
    } else {
        scan_dirs
    };
    
    logger::info(&format!("Looking for these target directories: {:?}", scan_dirs));
    
    // Find all target folders in the directory structure based on scan_dirs
    let mut project_folders = Vec::new();
    if let Err(e) = find_project_folders(path, &mut project_folders, &scan_dirs) {
        logger::warn(&format!("Error finding project folders: {}", e));
        // Continue anyway with empty project_folders
    }
    
    // Scan each project folder for files - but don't recurse into subdirectories
    // since we've already identified the specific target folders
    let mut found_files = Vec::new();
    let project_folders_empty = project_folders.is_empty();
    
    for project_folder in &project_folders {
        logger::info(&format!("Scanning project folder: {}", project_folder.display()));
        
        if let Err(e) = walk_dir(project_folder, path, &patterns, project_id, &mut found_files) {
            logger::warn(&format!("Error scanning directory {}: {}", project_folder.display(), e));
            // Continue with other folders even if one fails
        }
    }
    
    // If no project folders were found, scan the root directory as fallback
    // but log a warning since this is less efficient
    if project_folders_empty {
        logger::warn("No project folders found, scanning root directory as fallback. This is less efficient.");
        logger::warn("Consider adding appropriate target directories to scan_dirs in settings.");
        if let Err(e) = walk_dir(path, path, &patterns, project_id, &mut found_files) {
            logger::warn(&format!("Error walking root directory: {}", e));
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

// Find specific folder names at the root level, then only scan for files inside those folders
fn find_project_folders(dir: &Path, project_folders: &mut Vec<PathBuf>, scan_dirs: &[String]) -> Result<(), String> {
    logger::info(&format!("Searching for target folders at root level: {}", dir.display()));
    
    if !dir.is_dir() {
        return Ok(());
    }
    
    // Create a list of target folder names to look for (case-insensitive)
    let target_folder_names: Vec<String> = scan_dirs.iter()
        .map(|s| s.to_lowercase())
        .collect();
    
    logger::info(&format!("Looking for these specific folders at root level: {:?}", target_folder_names));
    
    // Only search at the root level for the specified folder names
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            let err_msg = format!("Failed to read directory {}: {}", dir.display(), e);
            logger::warn(&err_msg);
            return Err(err_msg);
        }
    };
    
    // First pass: Look for exact matches of target folders at root level
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
            // Check if this directory matches one of our target folder names
            if let Some(dir_name) = path.file_name() {
                let dir_name_str = dir_name.to_string_lossy().to_lowercase();
                
                // Check if this directory is one of our target folders
                if target_folder_names.contains(&dir_name_str) || dir_name_str == "project" || dir_name_str == "projects" {
                    logger::info(&format!("Found target folder at root level: {}", path.display()));
                    project_folders.push(path.clone());
                }
            }
        }
    }
    
    // Log the number of target folders found at root level
    if !project_folders.is_empty() {
        logger::info(&format!("Found {} target folders at root level", project_folders.len()));
    }
    
    // Also look for shot folders with project subfolders
    logger::info("Looking for shot folders with project subfolders");
    
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            let err_msg = format!("Failed to read directory {}: {}", dir.display(), e);
            logger::warn(&err_msg);
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
            // Only check for shot folders at the first level
            if let Some(dir_name) = path.file_name() {
                let dir_name_str = dir_name.to_string_lossy().to_lowercase();
                
                // Look for shot folders (e.g., SHOT_0010)
                if dir_name_str.contains('_') && dir_name_str.chars().any(|c| c.is_numeric()) {
                    logger::info(&format!("Found potential shot folder: {}", path.display()));
                    
                    // Check if this shot folder has any of our target subfolders
                    for target_name in &target_folder_names {
                        let potential_target = path.join(target_name);
                        if potential_target.exists() && potential_target.is_dir() {
                            logger::info(&format!("Found target subfolder in shot: {}", potential_target.display()));
                            project_folders.push(potential_target);
                        }
                    }
                    
                    // Also check for "project" folder
                    let project_subdir = path.join("project");
                    if project_subdir.exists() && project_subdir.is_dir() {
                        logger::info(&format!("Found project subfolder in shot: {}", project_subdir.display()));
                        project_folders.push(project_subdir);
                    }
                }
            }
        }
    }
    
    Ok(())
}



fn walk_dir(
    dir: &Path, 
    project_root: &Path, 
    patterns: &[Regex],
    project_id: i64,
    found_files: &mut Vec<ProjectFile>
) -> Result<(), String> {
    logger::info(&format!("Scanning for VFX files in target directory: {}", dir.display()));
    
    // Recursive function to scan directories and process files
    fn scan_directory(dir: &Path, project_root: &Path, patterns: &[Regex], project_id: i64, found_files: &mut Vec<ProjectFile>) -> Result<(), String> {
        logger::debug(&format!("Scanning directory: {}", dir.display()));
        
        // First, check if this directory contains more than one .exr file
        // If it does, skip it as it's likely a render output folder
        let mut exr_count = 0;
        if let Ok(entries) = fs::read_dir(dir) {
            for entry_result in entries {
                if let Ok(entry) = entry_result {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(extension) = path.extension() {
                            if extension.to_string_lossy().to_lowercase() == "exr" {
                                exr_count += 1;
                                if exr_count > 1 {
                                    logger::info(&format!("Skipping directory with multiple EXR files: {}", dir.display()));
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
            }
        }
        
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(e) => {
                logger::warn(&format!("Failed to read directory {}: {}", dir.display(), e));
                return Ok(());
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
            
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    // Process file if it matches any pattern
                    logger::info(&format!("Checking file: {}", file_name));
                    
                    // Check if file ends with .nk or .aep directly
                    if file_name.ends_with(".nk") || file_name.ends_with(".aep") {
                        logger::info(&format!("Found VFX file by direct extension check: {}", file_name));
                        
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
                        
                        // Normalize filename by removing version information
                        let normalized_filename = version_regex.replace(&filename_without_ext, "").trim_end_matches('_').to_string();
                        
                        // Try to extract shot name from parent folder structure
                        let shot_name = extract_shot_name(&parent_folder);
                        
                        // Store version for logging before moving it to the struct
                        let version_for_log = version.clone();
                        
                        // Create ProjectFile
                        let project_file = ProjectFile {
                            id: 0, // Will be set by database
                            project_id,
                            filename: normalized_filename.clone(), // Use normalized filename without version
                            version,
                            file_type: file_type.clone(),
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
                        
                        logger::info(&format!("Adding file: {} (version: {}) ({})", normalized_filename, version_for_log, file_type));
                        found_files.push(project_file);
                    }
                }
            } else if path.is_dir() {
                // Skip any folders named render, renders, Render, or Renders
                if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                    let dir_name_lower = dir_name.to_lowercase();
                    if dir_name_lower == "render" || dir_name_lower == "renders" {
                        logger::info(&format!("Skipping render directory: {}", path.display()));
                        continue;
                    }
                }
                
                // Recursively scan subdirectories
                scan_directory(&path, project_root, patterns, project_id, found_files)?;
            }
        }
        
        Ok(())
    }
    
    // Start the recursive scan from the target directory
    scan_directory(dir, project_root, patterns, project_id, found_files)
}

// Helper function to extract shot name from folder path
fn extract_shot_name(folder_path: &str) -> Option<String> {
    // Try to extract shot name from folder structure
    // Common patterns: SHOT_0010, shot/SHOT_0010, shots/SHOT_0010
    
    // First, check if the path contains "shot" or "shots"
    if folder_path.to_lowercase().contains("shot") {
        let shot_regex = Regex::new(r"(?i)shots?[/\\]?([A-Za-z0-9_]+)").unwrap();
        if let Some(caps) = shot_regex.captures(folder_path) {
            if let Some(m) = caps.get(1) {
                return Some(m.as_str().to_string());
            }
        }
    }
    
    // If no shot folder found, try to extract from the path itself
    // Look for patterns like SHOT_0010, BALA_0010
    let direct_shot_regex = Regex::new(r"([A-Z]{2,}[A-Z0-9]*_\d{3,4})").unwrap();
    if let Some(caps) = direct_shot_regex.captures(folder_path) {
        if let Some(m) = caps.get(1) {
            return Some(m.as_str().to_string());
        }
    }
    
    None
}

fn store_files(project_id: i64, files: &[ProjectFile]) -> Result<(), String> {
    logger::info(&format!("Storing {} files for project {}", files.len(), project_id));
    
    if files.is_empty() {
        logger::info("No files to store");
        return Ok(());
    }
    
    // Use the database path from the paths module for consistency across the application
    let mut conn = crate::db::get_connection().map_err(|e| e.to_string())?;
    
    // First verify the project exists to avoid foreign key constraint errors
    let project_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?)",
        params![project_id],
        |row| row.get(0)
    ).map_err(|e| format!("Failed to check if project exists: {}", e))?;
    
    if !project_exists {
        let err_msg = format!("Project with ID {} does not exist. Cannot store files.", project_id);
        logger::error(&err_msg);
        return Err(err_msg);
    }
    
    logger::info(&format!("Project {} exists, proceeding with file storage", project_id));
    
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
    {
        for file in files {
            logger::debug(&format!("Storing file: {} ({})", file.filename, file.file_type));
            stmt.execute(params![
                file.project_id,
                file.filename.clone(),
                file.version.clone(),
                file.file_type.clone(),
                file.path.clone(),
                file.relative_path.clone(),
                file.parent_folder.clone(),
                file.shot_name.clone(),
                file.last_modified.clone(),
                file.created_at.clone()
            ]).map_err(|e| format!("Failed to insert file {}: {}", file.filename, e))?;
        }
    }
    
    // Drop the statement before committing the transaction
    drop(stmt);
    
    // Commit transaction
    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;
    
    logger::info(&format!("Successfully stored {} files for project {}", files.len(), project_id));
    Ok(())
}

// Open file in appropriate application
#[tauri::command]
pub fn open_file(file_path: String, app_path: String) -> Result<(), String> {
    // Convert the file path to the correct format for the current OS
    let normalized_file_path = paths::normalize_path(&file_path);
    let normalized_app_path = paths::normalize_path(&app_path);
    
    logger::info(&format!("Opening file: {} with application: {}", normalized_file_path, normalized_app_path));
    
    // Log file extension for debugging
    if let Some(extension) = Path::new(&file_path).extension() {
        if let Some(ext_str) = extension.to_str() {
            logger::info(&format!("File extension: {}", ext_str));
        }
    }
    
    if app_path.is_empty() {
        let err_msg = "Application path is empty";
        logger::error(err_msg);
        return Err(err_msg.to_string());
    }
    
    // Check if file exists
    if !Path::new(&normalized_file_path).exists() {
        let err_msg = format!("File does not exist: {}", file_path);
        logger::error(&err_msg);
        return Err(err_msg);
    }
    
    // Execute the command to open the file
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let result = if !normalized_app_path.is_empty() {
            // If app_path is specified, use it directly
            Command::new(&normalized_app_path)
                .arg(&normalized_file_path)
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string())
        } else {
            // Use the default association through cmd /c start
            Command::new("cmd")
                .args(["/c", "start", "", &normalized_file_path])
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string())
        };
        match result {
            Ok(_) => (),
            Err(e) => {
                let err_msg = format!("Failed to open file: {}", e);
                logger::error(&err_msg);
                return Err(err_msg);
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // On macOS, use 'open' command
        logger::info("Using macOS 'open' command");
        
        let mut args = Vec::new();
        
        if !normalized_app_path.is_empty() {
            // If app_path is specified, use it
            args.push("-a");
            args.push(&normalized_app_path);
        }
        
        args.push(&normalized_file_path);
        
        match Command::new("open").args(&args).output() {
            Ok(_) => (),
            Err(e) => {
                let err_msg = format!("Failed to open file: {}", e);
                logger::error(&err_msg);
                return Err(err_msg);
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let result = if !normalized_app_path.is_empty() {
            // If app_path is specified, use it
            Command::new(&normalized_app_path)
                .arg(&normalized_file_path)
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string())
        } else {
            // If no app_path is specified, use the xdg-open command
            Command::new("xdg-open")
                .arg(&normalized_file_path)
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string())
        };
        match result {
            Ok(_) => (),
            Err(e) => {
                let err_msg = format!("Failed to open file: {}", e);
                logger::error(&err_msg);
                return Err(err_msg);
            }
        }
    }
    
    logger::info(&format!("Successfully opened file: {}", file_path));
    Ok(())
}
// Simple echo function for testing frontend-backend communication
#[tauri::command]
pub fn test_echo(message: String) -> Result<String, String> {
    println!("BACKEND RECEIVED: {}", message);
    logger::info(&format!("test_echo command received: {}", message));
    
    // Log that we're about to return a response
    let response = format!("ECHO REPLY: {}", message);
    println!("BACKEND RESPONDING WITH: {}", response);
    logger::info(&format!("test_echo responding with: {}", response));
    
    // Return success result
    Ok(response)
}

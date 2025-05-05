use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};
use notify::{Watcher, RecursiveMode, EventKind}; // Removed unused imports
use crate::files;

// Store active watchers
lazy_static::lazy_static! {
    static ref WATCHERS: Arc<Mutex<HashMap<i64, ProjectWatcher>>> = Arc::new(Mutex::new(HashMap::new()));
}

struct ProjectWatcher {
    watcher: Box<dyn Watcher + Send + Sync>,
    project_id: i64,
    project_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct WatcherStatus {
    project_id: i64,
    is_watching: bool,
    path: String,
}

// Start watching a project
#[tauri::command]
pub fn start_watching_project(project_id: i64, project_path: String, scan_dirs: Vec<String>) -> Result<bool, String> {
    let mut watchers = WATCHERS.lock().map_err(|e| e.to_string())?;
    
    // Check if already watching
    if watchers.contains_key(&project_id) {
        return Ok(true); // Already watching
    }
    
    // Create watcher configuration
    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    
    // Watch each scan directory
    let project_path_buf = PathBuf::from(&project_path);
    for dir in &scan_dirs {
        let watch_path = project_path_buf.join(dir);
        if watch_path.exists() && watch_path.is_dir() {
            watcher.watch(&watch_path, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
        }
    }
    
    // Start background thread to handle events
    let project_id_clone = project_id;
    let project_path_clone = project_path.clone();
    let scan_dirs_clone = scan_dirs.clone();
    
    std::thread::spawn(move || {
        for res in rx {
            match res {
                Ok(event) => {
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                            // Debounce: Wait a moment to group multiple changes
                            std::thread::sleep(std::time::Duration::from_secs(2));
                            
                            // Get current settings for scan configuration
                            if let Ok(settings) = crate::db::get_settings() {
                                // Trigger a scan when files change
                                if let Err(e) = files::scan_project(
                                    project_id_clone,
                                    project_path_clone.clone(),
                                    settings.default_include_patterns,
                                    scan_dirs_clone.clone()
                                ) {
                                    eprintln!("Error rescanning project {}: {}", project_id_clone, e);
                                }
                            }
                            
                            // Stop after first event to avoid rescanning multiple times
                            break;
                        },
                        _ => {} // Ignore other events
                    }
                },
                Err(e) => eprintln!("Watch error: {:?}", e),
            }
        }
    });
    
    // Store the watcher
    watchers.insert(project_id, ProjectWatcher {
        watcher: Box::new(watcher),
        project_id,
        project_path,
    });
    
    Ok(true)
}

// Stop watching a project
#[tauri::command]
pub fn stop_watching_project(project_id: i64) -> Result<bool, String> {
    let mut watchers = WATCHERS.lock().map_err(|e| e.to_string())?;
    
    if watchers.remove(&project_id).is_some() {
        Ok(true)
    } else {
        Ok(false) // Not watching
    }
}

// Get all watching projects
#[tauri::command]
pub fn get_watching_projects() -> Result<Vec<WatcherStatus>, String> {
    let watchers = WATCHERS.lock().map_err(|e| e.to_string())?;
    
    let status: Vec<WatcherStatus> = watchers.iter().map(|(id, watcher)| {
        WatcherStatus {
            project_id: *id,
            is_watching: true,
            path: watcher.project_path.clone(),
        }
    }).collect();
    
    Ok(status)
}

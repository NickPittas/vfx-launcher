use std::path::{Path, PathBuf};
use std::env;
use crate::logger;
use crate::config;

// Enum to represent the current operating system
#[derive(Debug, PartialEq)]
pub enum OsType {
    Windows,
    MacOS,
    Linux,
    Unknown,
}

// Get the current operating system
pub fn get_os_type() -> OsType {
    #[cfg(target_os = "windows")]
    {
        return OsType::Windows;
    }
    
    #[cfg(target_os = "macos")]
    {
        return OsType::MacOS;
    }
    
    #[cfg(target_os = "linux")]
    {
        return OsType::Linux;
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return OsType::Unknown;
    }
    
    // This line is actually unreachable but needed to satisfy the compiler
    // as it can't determine that the cfg attributes cover all cases
    OsType::Unknown
}

// Convert a path to the platform-specific format
pub fn normalize_path(path: &str) -> String {
    let os = get_os_type();
    let cfg = config::get_config();
    let network_base = &cfg.paths.network_base;
    let windows_drive = &cfg.paths.windows_mapped_drive;
    
    match os {
        OsType::Windows => {
            // Convert UNC path to Windows drive letter if applicable
            if path.starts_with(network_base) {
                let relative_path = path.strip_prefix(network_base).unwrap_or("");
                format!("{}{}", windows_drive, relative_path.replace("/", "\\"))
            } else {
                // Just ensure Windows path separators
                path.replace("/", "\\")
            }
        },
        OsType::MacOS | OsType::Linux => {
            // Convert Windows drive letter path to UNC if applicable
            if path.starts_with(windows_drive) {
                let relative_path = path.strip_prefix(windows_drive).unwrap_or("");
                format!("{}{}", network_base, relative_path.replace("\\", "/"))
            } else {
                // Just ensure Unix path separators
                path.replace("\\", "/")
            }
        },
        OsType::Unknown => {
            logger::warn(&format!("Unknown OS detected, using path as-is: {}", path));
            path.to_string()
        }
    }
}

// Get the appropriate database path based on deployment mode
pub fn get_network_database_path() -> PathBuf {
    // For network deployment, we'll use the network path
    let cfg = config::get_config();
    let db_path = format!("{}/vfx_launcher.db", cfg.database.network_path);
    
    // Check if this is a UNC path that needs to be converted to a mounted path
    if get_os_type() == OsType::MacOS && db_path.starts_with("//") {
        // Convert UNC path to mounted volume path
        let path_parts: Vec<&str> = db_path.trim_start_matches("//").split('/').collect();
        if path_parts.len() >= 2 {
            // Format as /Volumes/<server-name>/<share-name>/rest/of/path
            let server = path_parts[0];
            let share = path_parts[1];
            let remaining_path = if path_parts.len() > 2 {
                path_parts[2..].join("/")
            } else {
                String::new()
            };
            
            let mounted_path = format!("/Volumes/{}/{}", share, remaining_path);
            logger::info(&format!("Converted UNC path {} to mounted path: {}", db_path, mounted_path));
            return PathBuf::from(mounted_path);
        }
    }
    
    // Fall back to the configured path
    let path = PathBuf::from(db_path);
    logger::info(&format!("Using network database path: {}", path.display()));
    path
}

// Get the local database path (for local testing)
pub fn get_local_database_path() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("vfx_launcher.db");
    path
}

// Convert a path from network to local format for application launching
#[tauri::command]
pub fn convert_to_local_path(path: String) -> String {
    normalize_path(&path)
}

// Check if a path exists and is readable
pub fn check_path_access(path: &str) -> bool {
    Path::new(path).exists()
}

// Get DB configuration from environment, defaulting to config file setting
pub fn get_database_mode() -> String {
    match env::var("VFX_DB_MODE") {
        Ok(mode) => mode,
        Err(_) => {
            // Default to config file setting
            let cfg = config::get_config();
            cfg.database.mode.clone()
        }
    }
}

// Get the appropriate database path based on mode
pub fn get_database_path() -> PathBuf {
    let mode = get_database_mode();
    match mode.as_str() {
        "local" => get_local_database_path(),
        _ => get_network_database_path(),
    }
}

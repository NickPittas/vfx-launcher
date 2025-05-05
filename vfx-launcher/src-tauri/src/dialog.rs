use std::path::PathBuf;

#[tauri::command]
pub fn select_project_folder() -> Result<String, String> {
    // Default folder for macOS
    let default_folder = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/"))
        .to_string_lossy()
        .to_string();
    
    // Use native dialog from the opener plugin
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Temporary AppleScript to open folder picker dialog
        let apple_script = r#"
            tell application "System Events"
                activate
                set folderPath to POSIX path of (choose folder with prompt "Select Project Folder")
            end tell
        "#;
        
        // Run AppleScript and get result
        let output = Command::new("osascript")
            .arg("-e")
            .arg(apple_script)
            .output()
            .map_err(|e| format!("Failed to run folder dialog: {}", e))?;
        
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }
    }
    
    // Fallback or non-macOS platforms
    Ok(default_folder)
}

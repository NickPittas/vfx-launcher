use crate::files;
use crate::logger;

pub fn run_test_scan() {
    // Initialize logger if needed
    let _ = logger::init();
    
    logger::info("=== STARTING TEST SCAN ===");
    
    // Project settings for test
    let project_id = 2; // Use project ID 2 (our Test Project 2)
    let project_path = "/tmp/vfx-naboo/projects/test_project".to_string();
    
    // Include patterns for Nuke files
    let include_patterns = vec![r"\.nk$".to_string()];
    
    // Scan directories - standard VFX directories
    let scan_dirs = vec![
        "comp".to_string(),
        "animation".to_string(),
        "05_comp".to_string()
    ];
    
    // Log scan parameters
    logger::info(&format!("Testing scan for project ID: {}", project_id));
    logger::info(&format!("Project path: {}", project_path));
    logger::info(&format!("Scan directories: {:?}", scan_dirs));
    logger::info(&format!("Include patterns: {:?}", include_patterns));
    
    // Run the scan
    match files::scan_project(project_id, project_path, include_patterns, scan_dirs) {
        Ok(files) => {
            logger::info(&format!("Scan successful! Found {} files", files.len()));
            for file in files {
                logger::info(&format!("Found file: {} ({})", file.filename, file.path));
            }
        },
        Err(e) => {
            logger::error(&format!("Scan failed: {}", e));
        }
    }
    
    logger::info("=== TEST SCAN COMPLETE ===");
}

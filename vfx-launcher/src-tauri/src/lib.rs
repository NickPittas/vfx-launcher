// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod db;
mod templates;
mod files;
mod watcher;
mod auth;
mod dialog;
mod logger;
mod paths;
mod config;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn debug_test() -> String {
    println!("Debug test command was called!");
    String::from("Debug test successful")
}

// NEW Command to print messages from frontend to terminal
#[tauri::command]
fn log_to_terminal(message: String) {
    println!("FRONTEND_LOG: {}", message);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger first
    if let Err(e) = logger::init() {
        eprintln!("Error initializing logger: {}", e);
    }
    
    logger::info("Application starting");
    
    // Load configuration
    let cfg = config::load_config();
    logger::info("Configuration loaded");
    logger::info(&format!("Database mode: {}", cfg.database.mode));
    logger::info(&format!("Network path: {}", cfg.paths.network_base));
    
    // Check for network connectivity if in network mode
    if cfg.database.mode == "network" {
        let db_path = paths::get_network_database_path();
        logger::info(&format!("Checking network database access: {}", db_path.display()));
        
        if paths::check_path_access(db_path.to_str().unwrap_or("")) {
            logger::info("Network database is accessible");
        } else {
            logger::warn("Network database is not accessible. Will create local fallback.");
        }
    }
    
    // Initialize project templates YAML
    if let Err(e) = templates::init_templates() {
        logger::error(&format!("Error initializing templates YAML: {}", e));
    } else {
        logger::info("Templates initialized successfully");
    }
    
    // Initialize database and create tables if needed
    if let Err(e) = db::init_db() {
        logger::error(&format!("Error initializing database: {}", e));
    } else {
        logger::info("Database initialized successfully");
    }
    
    // Initialize users (create admin if none exists)
    if let Err(e) = auth::init_users() {
        logger::error(&format!("Error initializing users: {}", e));
    } else {
        logger::info("Users initialized successfully");
    }
    tauri::Builder::default()
        // Removed dialog plugin to fix build issues
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            debug_test,
            log_to_terminal, // Register the new command
            db::get_projects,
            db::add_project,
            db::delete_project,
            db::remove_project,
            db::emergency_delete_project,
            db::get_project_details,
            db::get_project_files,
            db::get_settings,
            db::save_settings,
            db::get_users,
            db::get_recent_projects,
            db::get_favorite_projects,
            db::toggle_favorite_project,
            templates::get_project_templates,
            templates::create_project_from_template,
            files::scan_project,
            files::open_file,
            files::test_echo,
            watcher::start_watching_project,
            watcher::stop_watching_project,
            watcher::get_watching_projects,
            auth::login,
            auth::add_user,
            auth::update_user,
            auth::delete_user,
            dialog::select_project_folder,
            auth::log_activity,
            auth::get_activity_logs,
            auth::check_file_usage,
            paths::convert_to_local_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use chrono::Local;
use once_cell::sync::Lazy;

// Global logger instance
static LOGGER: Lazy<Mutex<Logger>> = Lazy::new(|| {
    Mutex::new(Logger::new("vfx_launcher.log").unwrap_or_else(|e| {
        eprintln!("Failed to initialize logger: {}", e);
        Logger::null_logger()
    }))
});

pub struct Logger {
    file: Option<File>,
}

impl Logger {
    pub fn new(filename: &str) -> Result<Self, String> {
        let log_path = Path::new("logs");
        if !log_path.exists() {
            std::fs::create_dir_all(log_path).map_err(|e| format!("Failed to create log directory: {}", e))?;
        }
        
        let log_file_path = log_path.join(filename);
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file_path)
            .map_err(|e| format!("Failed to open log file: {}", e))?;
            
        Ok(Logger { file: Some(file) })
    }
    
    pub fn null_logger() -> Self {
        Logger { file: None }
    }
    
    fn write_log(&mut self, level: &str, message: &str) -> Result<(), String> {
        if let Some(file) = &mut self.file {
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
            let log_line = format!("[{}] [{}] {}\n", timestamp, level, message);
            
            file.write_all(log_line.as_bytes())
                .map_err(|e| format!("Failed to write to log file: {}", e))?;
                
            file.flush()
                .map_err(|e| format!("Failed to flush log file: {}", e))?;
        }
        
        // Also print to console for development
        match level {
            "ERROR" => eprintln!("[{}] {}", level, message),
            _ => println!("[{}] {}", level, message),
        }
        
        Ok(())
    }
}

// Public logging functions
pub fn info(message: &str) {
    if let Ok(mut logger) = LOGGER.lock() {
        if let Err(e) = logger.write_log("INFO", message) {
            eprintln!("Logging error: {}", e);
        }
    }
}

pub fn warn(message: &str) {
    if let Ok(mut logger) = LOGGER.lock() {
        if let Err(e) = logger.write_log("WARN", message) {
            eprintln!("Logging error: {}", e);
        }
    }
}

pub fn error(message: &str) {
    if let Ok(mut logger) = LOGGER.lock() {
        if let Err(e) = logger.write_log("ERROR", message) {
            eprintln!("Logging error: {}", e);
        }
    }
}

pub fn debug(message: &str) {
    if let Ok(mut logger) = LOGGER.lock() {
        if let Err(e) = logger.write_log("DEBUG", message) {
            eprintln!("Logging error: {}", e);
        }
    }
}

// Initialize the logger
pub fn init() -> Result<(), String> {
    info("Logger initialized");
    Ok(())
}

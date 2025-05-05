use std::fs;
use std::path::Path;
use serde::{Serialize, Deserialize};
use crate::logger;
use std::sync::OnceLock;

// Static configuration that gets loaded once
static CONFIG: OnceLock<Config> = OnceLock::new();

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NetworkConfig {
    pub server_ip: String,
    pub server_port: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DatabaseConfig {
    pub mode: String,
    pub network_path: String, 
    pub windows_drive: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PathsConfig {
    pub network_base: String,
    pub windows_mapped_drive: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub network: NetworkConfig,
    pub database: DatabaseConfig,
    pub paths: PathsConfig,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            network: NetworkConfig {
                server_ip: "192.168.100.9".to_string(),
                server_port: 8080,
            },
            database: DatabaseConfig {
                mode: "network".to_string(),
                network_path: "//192.168.100.9/Naboo/DB".to_string(),
                windows_drive: "U:".to_string(),
            },
            paths: PathsConfig {
                network_base: "//192.168.100.9/Naboo".to_string(),
                windows_mapped_drive: "U:".to_string(),
            },
        }
    }
}

// Load configuration from file
pub fn load_config() -> &'static Config {
    CONFIG.get_or_init(|| {
        let config_path = Path::new("config.toml");
        
        if config_path.exists() {
            match fs::read_to_string(config_path) {
                Ok(content) => {
                    match toml::from_str::<Config>(&content) {
                        Ok(config) => {
                            logger::info("Configuration loaded successfully from config.toml");
                            config
                        },
                        Err(e) => {
                            logger::error(&format!("Error parsing config.toml: {}", e));
                            Config::default()
                        }
                    }
                },
                Err(e) => {
                    logger::error(&format!("Error reading config.toml: {}", e));
                    Config::default()
                }
            }
        } else {
            logger::warn("config.toml not found, using default configuration");
            let default_config = Config::default();
            
            // Try to write default config for future use
            match toml::to_string_pretty(&default_config) {
                Ok(content) => {
                    let _ = fs::write(config_path, content);
                },
                Err(e) => {
                    logger::error(&format!("Error creating default config.toml: {}", e));
                }
            }
            
            default_config
        }
    })
}

// Get the current configuration
pub fn get_config() -> &'static Config {
    load_config()
}

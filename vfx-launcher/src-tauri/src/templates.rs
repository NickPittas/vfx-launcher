use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use crate::db;

#[derive(Serialize, Deserialize)]
pub struct ProjectTemplate {
    pub name: String,
    pub description: Option<String>,
    pub structure: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct TemplatesFile {
    templates: Vec<ProjectTemplate>,
}

fn get_templates_path() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("project_templates.yaml");
    path
}

/// Create default YAML file if missing
pub fn init_templates() -> Result<(), String> {
    let path = get_templates_path();
    if !path.exists() {
        let default = TemplatesFile {
            templates: vec![
                ProjectTemplate {
                    name: "Standard Shot".to_string(),
                    description: Some("Sequence and Shot folders".to_string()),
                    structure: vec![
                        "sequences".to_string(),
                        "sequences/{sequence}/shots".to_string(),
                    ],
                },
                ProjectTemplate {
                    name: "Flat".to_string(),
                    description: Some("Flat project structure".to_string()),
                    structure: vec![
                        "assets".to_string(),
                        "renders".to_string(),
                    ],
                },
            ],
        };
        let yaml = serde_yaml::to_string(&default).map_err(|e| e.to_string())?;
        fs::write(&path, yaml).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_project_templates() -> Result<Vec<ProjectTemplate>, String> {
    let path = get_templates_path();
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let file: TemplatesFile = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    Ok(file.templates)
}

#[tauri::command]
pub fn create_project_from_template(
    name: String,
    client: Option<String>,
    rootPath: String,
    templateName: String,
) -> Result<i64, String> {
    // Load templates and find selected
    let templates = get_project_templates()?;
    let tpl = templates.into_iter()
        .find(|t| t.name == templateName)
        .ok_or_else(|| "Template not found".to_string())?;
    // Build project directory
    let project_path = PathBuf::from(&rootPath).join(&name);
    fs::create_dir_all(&project_path).map_err(|e| e.to_string())?;
    // Create subdirectories (skip placeholders)
    for pattern in tpl.structure {
        if pattern.contains('{') { continue; }
        let dir = project_path.join(&pattern);
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // Insert into DB
    let id = db::add_project(name, project_path.to_string_lossy().into_owned(), client)?;
    Ok(id)
}

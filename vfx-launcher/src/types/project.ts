export interface Project {
  id: number;
  name: string;
  client?: string | null; // Optional client field
  path: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  scan_config?: ProjectScanConfig | null; // Assuming a scan config relationship
  is_favorite?: boolean; // Whether the project is favorited by current user
  last_accessed?: string | null; // When the project was last accessed by current user
}

// Interface for scan configuration (adjust as needed based on final Rust implementation)
export interface ProjectScanConfig {
  id: number;
  project_id: number;
  include_patterns: string[]; // e.g., ["*.nk", "*.aep"]
  exclude_patterns: string[]; // e.g., ["_autosave/*", "*tmp*"]
  scan_subdirs: string[]; // e.g., ["nuke", "ae", "comp"]
  last_scan_time?: string | null;
}

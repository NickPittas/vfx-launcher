export interface ProjectFile {
  id: number;
  project_id: number;
  filename: string; // Base filename (e.g., 'shot010_comp')
  version: string; // Extracted version (e.g., 'v001')
  file_type: 'nk' | 'aep' | 'other'; // Determined from extension
  path: string; // Full absolute path to the specific version file
  relative_path: string; // Path relative to the project root
  parent_folder: string;
  shot_name?: string | null; // Extracted shot name, if applicable
  last_modified: string; // ISO date string
  created_at: string; // ISO date string
  // Add fields for locking/user later
  is_locked?: boolean;
  locked_by_user_id?: number | null;
}

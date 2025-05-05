export interface AppSettings {
  nuke_executable_path?: string | null;
  ae_executable_path?: string | null;
  default_scan_subdirs: string[];
  default_include_patterns: string[];
  default_exclude_patterns: string[];
}

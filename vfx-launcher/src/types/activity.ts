export interface UserActivity {
  id: number;
  user_id: number;
  username?: string; // Join with user data
  activity_type: string;
  project_id?: number | null;
  project_name?: string | null; // Join with project data
  file_id?: number | null;
  file_name?: string | null; // Join with file data
  details?: string | null;
  timestamp: string;
}

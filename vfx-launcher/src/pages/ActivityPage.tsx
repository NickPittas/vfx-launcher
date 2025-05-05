import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import { UserActivity } from '../types/activity';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';

const ActivityPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = useAuth().isAdmin();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<number | null>(null);
  
  // Activity filters for dropdown
  const activityTypes = [
    { value: null, label: 'All Activities' },
    { value: 'login', label: 'Login' },
    { value: 'open_file', label: 'Open File' },
    { value: 'add_project', label: 'Add Project' },
    { value: 'delete_project', label: 'Delete Project' },
    { value: 'add_favorite', label: 'Add Favorite' },
    { value: 'remove_favorite', label: 'Remove Favorite' },
    { value: 'add_user', label: 'Add User' },
    { value: 'update_user', label: 'Update User' },
    { value: 'delete_user', label: 'Delete User' }
  ];

  useEffect(() => {
    fetchActivities();
  }, [activityFilter, userFilter]);

  const fetchActivities = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // If admin, can see all activities or filter by user
      // If regular user, can only see their own
      const fetchedActivities = await invoke('get_activity_logs', {
        userId: !isAdmin ? user?.id : userFilter,
        limit: 100,
        activityType: activityFilter
      }) as UserActivity[];
      
      setActivities(fetchedActivities);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError(`Failed to load activity logs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get appropriate icon for each activity type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login': return '🔐';
      case 'open_file': return '📂';
      case 'add_project': return '➕';
      case 'delete_project': return '🗑️';
      case 'add_favorite': return '⭐';
      case 'remove_favorite': return '☆';
      case 'add_user': return '👤';
      case 'update_user': return '✏️';
      case 'delete_user': return '❌';
      default: return '📝';
    }
  };
  
  // Get appropriate text color for each activity type
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'login': return 'text-green-600 dark:text-green-400';
      case 'open_file': return 'text-blue-600 dark:text-blue-400';
      case 'add_project': 
      case 'add_favorite': 
      case 'add_user': return 'text-teal-600 dark:text-teal-400';
      case 'delete_project': 
      case 'remove_favorite': 
      case 'delete_user': return 'text-red-600 dark:text-red-400';
      case 'update_user': return 'text-amber-600 dark:text-amber-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Format the activity description
  const getActivityDescription = (activity: UserActivity) => {
    const { activity_type, project_name, file_name, details, username } = activity;
    
    switch (activity_type) {
      case 'login':
        return `${username || 'User'} logged in`;
      case 'open_file':
        return `${username || 'User'} opened file ${file_name}${project_name ? ` in project ${project_name}` : ''}`;
      case 'add_project':
        return `${username || 'User'} created project "${project_name}"`;
      case 'delete_project':
        return `${username || 'User'} deleted project "${project_name}"`;
      case 'add_favorite':
        return `${username || 'User'} added ${project_name} to favorites`;
      case 'remove_favorite':
        return `${username || 'User'} removed ${project_name} from favorites`;
      case 'add_user':
        return `${username || 'User'} created a new user account`;
      case 'update_user':
        return `${username || 'User'} updated a user account`;
      case 'delete_user':
        return `${username || 'User'} deleted a user account`;
      default:
        return details || `${activity_type} activity`;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        
        <div className="flex space-x-4">
          {/* Activity Type Filter */}
          <select
            value={activityFilter || ''}
            onChange={(e) => setActivityFilter(e.target.value === '' ? null : e.target.value)}
            className="rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {activityTypes.map(type => (
              <option key={type.value || 'all'} value={type.value || ''}>
                {type.label}
              </option>
            ))}
          </select>
          
          {/* User Filter (Admin only) */}
          {isAdmin && (
            <button
              onClick={() => setUserFilter(userFilter === null ? user?.id || null : null)}
              className={`px-4 py-2 rounded-md ${
                userFilter !== null 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              } transition-colors`}
            >
              {userFilter !== null ? 'My Activities' : 'All Users'}
            </button>
          )}
        </div>
      </div>
      
      {isLoading && <p>Loading activity logs...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {!isLoading && !error && (
        <>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No activities found for the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start">
                    <div className="text-2xl mr-3">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className={`font-medium ${getActivityColor(activity.activity_type)}`}>
                          {getActivityDescription(activity)}
                        </p>
                        
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {/* Project link if available */}
                      {activity.project_id && (
                        <p className="text-sm mt-1">
                          Project: <Link to={`/projects/${activity.project_id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {activity.project_name}
                          </Link>
                        </p>
                      )}
                      
                      {/* Extra details if available */}
                      {activity.details && activity.details !== getActivityDescription(activity) && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {activity.details}
                        </p>
                      )}
                      
                      {/* Timestamp */}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActivityPage;

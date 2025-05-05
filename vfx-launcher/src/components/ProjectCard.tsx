import React from 'react';
import { Project } from '../types/project';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import Button from './Button';
import Badge from './Badge';

interface ProjectCardProps {
  project: Project;
  onToggleFavorite: (projectId: number, isFavorite: boolean) => void;
  onDelete: (projectId: number) => void;
  currentUserId?: number; // Needed to toggle favorites
}

// Simple and direct function to delete a project
function directDelete(id: number, name: string) {
  if (!id) {
    alert('Error: Invalid project ID');
    return;
  }
  
  const confirmed = window.confirm(`Really delete project: ${name}?`);
  if (!confirmed) return;
  
  console.log(`Deleting project ${id}...`);
  alert(`Starting deletion of project ${id}...`);
  
  // Try basic API call first
  invoke('debug_test')
    .then(response => {
      console.log('Debug test response:', response);
      alert(`Debug test response: ${response}`);
      
      // If debug test works, try actual deletion
      return invoke('remove_project', { project_id: id });
    })
    .then(result => {
      console.log('Delete result:', result);
      alert(`Project ${name} deleted successfully!`);
      window.location.reload();
    })
    .catch(err => {
      console.error('Delete error:', err);
      alert(`Error: ${err}`);
    });
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onDelete,
  onToggleFavorite,
  currentUserId
}) => {
  const navigate = useNavigate();

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onToggleFavorite && currentUserId) {
      onToggleFavorite(project.id, !project.is_favorite);
    } else if (currentUserId) {
      try {
        // If no callback provided but we have a user ID, toggle directly
        await invoke('toggle_favorite_project', {
          userId: currentUserId,
          projectId: project.id
        });
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    // IMMEDIATELY show alert to confirm the button is working
    alert(`DELETE DEBUG: Button clicked for project: ${project.name} (ID: ${project.id})`);
    
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Simple confirmation dialog
    if (window.confirm(`Are you sure you want to delete project: ${project.name}?`)) {
      try {
        console.log(`Attempting to delete project ID: ${project.id}`);
        // Use our new simpler remove_project function
        const result = await invoke('remove_project', { project_id: project.id });
        console.log(`Delete result:`, result);
        alert(`Project ${project.name} deleted successfully!`);
        onDelete(project.id);
      } catch (err) {
        console.error('Failed to delete project:', err);
        alert(`Error deleting project: ${err}`);
      }
    }
  };

  const handleCardClick = () => {
    navigate(`/projects/${project.id}`);
  };

  const lastAccessedText = project.last_accessed 
    ? `Last accessed ${formatDistanceToNow(new Date(project.last_accessed), { addSuffix: true })}`
    : '';

  return (
    <div 
      className="bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:bg-gray-700 transition cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-grow">
            <div className="flex items-center">
              {currentUserId && (
                <button 
                  onClick={handleToggleFavorite}
                  className="mr-1.5 text-sm focus:outline-none"
                  aria-label={project.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  {project.is_favorite 
                    ? <span className="text-yellow-500">★</span> 
                    : <span className="text-gray-400 hover:text-yellow-500">☆</span>}
                </button>
              )}
              <h3 className="text-lg font-medium hover:text-blue-400">
                {project.name}
              </h3>
            </div>
            {project.client && (
              <div className="text-sm text-gray-400 mt-1">
                Client: {project.client}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Created: {new Date(project.created_at).toLocaleDateString()}
            </div>
            {project.last_accessed && (
              <div className="text-xs text-gray-500 mt-1">
                {lastAccessedText}
              </div>
            )}
          </div>
          
          <div className="ml-4 flex flex-col items-end">
            {project.is_favorite && (
              <Badge variant="primary" className="mb-2">
                Favorite
              </Badge>
            )}
            <div className="flex mt-2 space-x-2">
              {/* Original delete button */}
              <Button 
                variant="danger" 
                size="small"
                onClick={(e) => {
                  console.log('ProjectCard delete button clicked!');
                  alert('ProjectCard delete button clicked!');
                  handleDelete(e);
                }}
                style={{ border: '3px solid lime', padding: '2px 8px' }}
              >
                Delete 🛑
              </Button>
              
              {/* Emergency debug button that bypasses normal flow */}
              <button 
                style={{ 
                  marginTop: '5px', 
                  background: 'red', 
                  color: 'white', 
                  padding: '3px 8px', 
                  border: '1px solid darkred',
                  borderRadius: '4px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  directDelete(project.id, project.name);
                }}
              >
                EMERGENCY DELETE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;

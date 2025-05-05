import React from 'react';
import { Project } from '../../types/project';
import Button from '../Button';
import { invoke } from '@tauri-apps/api/core'; // Add import for invoke

interface ProjectsListProps {
  projects: Project[];
  loadingProjects: boolean;
  projError: string | null;
  projFilter: string;
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
  onFilterChange: (filter: string) => void;
  onAddProject: () => void;
  onDeleteProject: (id: number) => void;
}

const ProjectsList: React.FC<ProjectsListProps> = ({
  projects,
  loadingProjects,
  projError,
  projFilter,
  selectedProject,
  onProjectSelect,
  onFilterChange,
  onAddProject,
  onDeleteProject
}) => {
  // Filter projects based on the search term
  const filteredProjects = projFilter 
    ? projects.filter(p => p.name.toLowerCase().includes(projFilter.toLowerCase()))
    : projects;
  
  return (
    <div className="h-full bg-gray-800 border-r border-gray-700 flex flex-col w-64">
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <input
            type="text"
            value={projFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search projects..."
          />
          <svg
            className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
      
      <div className="p-2 flex space-x-2">
        <button
          onClick={onAddProject}
          className="flex-1 flex items-center justify-center py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-150"
        >
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 01-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add
        </button>
        
        <button
          disabled={!selectedProject}
          onClick={() => {
            const message = `[ProjectsList] Delete button clicked. Current selectedProject ID: ${selectedProject ? selectedProject.id : 'null'}`;
            console.log(message); // Keep browser console log
            invoke('log_to_terminal', { message }); // Send log to backend/terminal
            
            // Call the original prop
            onDeleteProject(selectedProject ? selectedProject.id : -1); 
          }}
          className="flex-1 py-1.5 flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white rounded-md transition-colors duration-150"
        >
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Delete Project 
        </button>
      </div>
      
      {/* Loading State */}
      {loadingProjects && (
        <div className="flex items-center justify-center flex-grow">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 mx-auto text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400">Loading projects...</p>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {!loadingProjects && projError && (
        <div className="flex items-center justify-center flex-grow">
          <div className="text-center p-6">
            <svg className="h-10 w-10 mx-auto text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 mb-2">Error loading projects</p>
            <p className="text-gray-500 text-sm">{projError}</p>
            <Button 
              type="button" 
              variant="primary" 
              className="mt-4" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!loadingProjects && !projError && filteredProjects.length === 0 && (
        <div className="flex items-center justify-center flex-grow">
          <div className="text-center p-6">
            <svg className="h-10 w-10 mx-auto text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            {projFilter ? (
              <>
                <p className="text-gray-400 mb-1">No matching projects</p>
                <p className="text-sm text-gray-500">No projects match your search criteria.</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 mb-1">No projects found</p>
                <p className="text-sm text-gray-500">Get started by creating a new project.</p>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Project List */}
      {!loadingProjects && !projError && filteredProjects.length > 0 && (
        <div className="overflow-y-auto flex-grow p-2">
          <div className="space-y-1">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-150 ${
                  selectedProject?.id === project.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-200 hover:bg-gray-700'
                }`}
                onClick={() => onProjectSelect(project)}
              >
                <div className="flex items-center">
                  <svg
                    className={`w-4 h-4 mr-2 ${
                      selectedProject?.id === project.id ? 'text-blue-200' : 'text-blue-400'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                  </svg>
                  <span className="truncate">{project.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsList;

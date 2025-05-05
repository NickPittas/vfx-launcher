import React from 'react';

interface ProjectControlsProps {
  showNk: boolean;
  showAep: boolean;
  groupByName: boolean;
  onShowNkChange: (show: boolean) => void;
  onShowAepChange: (show: boolean) => void;
  onGroupByNameChange: (group: boolean) => void;
  onRefreshFiles: () => void;
}

const ProjectControls: React.FC<ProjectControlsProps> = ({
  showNk,
  showAep,
  groupByName,
  onShowNkChange,
  onShowAepChange,
  onGroupByNameChange,
  onRefreshFiles
}) => {
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Side Controls */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* Refresh Files Button */}
          <button
            onClick={onRefreshFiles}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors duration-150"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Refresh Files
          </button>
          
          {/* Group by Name Toggle */}
          <div className="flex items-center">
            <input
              id="group-by-name"
              type="checkbox"
              checked={groupByName}
              onChange={(e) => onGroupByNameChange(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-600 focus:ring-0 focus:ring-offset-0"
            />
            <label htmlFor="group-by-name" className="ml-2 text-sm text-gray-300">
              Group by Name
            </label>
          </div>
        </div>
        
        {/* Right Side Filters */}
        <div className="flex items-center bg-gray-750 rounded-md border border-gray-700 divide-x divide-gray-700">
          <div className="px-3 py-1.5 text-sm font-medium text-gray-400">
            Show:
          </div>
          
          <div className="flex divide-x divide-gray-700">
            <label className="flex items-center px-3 py-1.5 rounded-md cursor-pointer transition-colors duration-200 hover:bg-gray-700">
              <input 
                type="checkbox" 
                checked={showNk} 
                onChange={e => onShowNkChange(e.target.checked)} 
                className="form-checkbox h-4 w-4 text-purple-500 rounded border-gray-600 focus:ring-0 focus:ring-offset-0"
              />
              <span className="ml-2 text-sm font-medium">Nuke</span>
            </label>
            
            <label className="flex items-center px-3 py-1.5 rounded-md cursor-pointer transition-colors duration-200 hover:bg-gray-700">
              <input 
                type="checkbox" 
                checked={showAep} 
                onChange={e => onShowAepChange(e.target.checked)} 
                className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-600 focus:ring-0 focus:ring-offset-0"
              />
              <span className="ml-2 text-sm font-medium">After Effects</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectControls;

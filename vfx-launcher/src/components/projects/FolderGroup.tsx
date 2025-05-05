import React from 'react';
import { ProjectFile } from '../../types/projectFile';
import ShotGroup from './ShotGroup';

interface FolderGroupProps {
  folder: string;
  fileType: string;
  shotGroups: Record<string, Record<string, ProjectFile[]>>;
  expanded: Record<string, boolean>;
  toggleFolder: (key: string) => void;
  versions: Record<string, string>;
  onVersionChange: (fileType: string, folder: string, shotGroup: string, name: string, version: string) => void;
  onOpenFile: (file: ProjectFile) => void;
}

const FolderGroup: React.FC<FolderGroupProps> = ({
  folder,
  fileType,
  shotGroups,
  expanded,
  toggleFolder,
  versions,
  onVersionChange,
  onOpenFile
}) => {
  const keyF = `${fileType}-${folder}`;
  
  // Count total number of files in all shot groups
  const totalFiles = Object.values(shotGroups).reduce(
    (total, shotGroup) => total + Object.keys(shotGroup).length, 0
  );
  
  const colorClass = fileType === 'nk' 
    ? 'bg-purple-900/30 text-purple-300 border-purple-800' 
    : 'bg-blue-900/30 text-blue-300 border-blue-800';

  return (
    <div className="bg-gray-800">
      {/* Folder Header */}
      <div 
        className="px-6 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-750 transition-colors duration-150" 
        onClick={() => toggleFolder(keyF)}
      >
        <div className="flex items-center">
          <svg 
            className={`w-4 h-4 mr-2 transition-transform duration-200 ${expanded[keyF] ? 'transform rotate-90' : ''}`} 
            fill="currentColor" 
            viewBox="0 0 20 20" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className="font-medium">{folder}</span>
        </div>
        <div className="flex items-center">
          <span className={`text-sm px-2 py-1 rounded-full ${colorClass}`}>
            {totalFiles} file{totalFiles !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {/* Shot Groups in Folder */}
      {expanded[keyF] && (
        <div className="bg-gray-800 border-t border-gray-700">
          {Object.entries(shotGroups).map(([shotGroup, files]) => (
            <ShotGroup
              key={`${fileType}-${folder}-${shotGroup}`}
              shotGroup={shotGroup}
              fileType={fileType}
              folder={folder}
              files={files}
              expanded={expanded}
              toggleFolder={toggleFolder}
              versions={versions}
              onVersionChange={onVersionChange}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FolderGroup;

import React from 'react';
import { ProjectFile } from '../../types/projectFile';
import FileEntry from './FileEntry';

interface ShotGroupProps {
  shotGroup: string;
  fileType: string;
  folder: string;
  files: Record<string, ProjectFile[]>;
  expanded: Record<string, boolean>;
  toggleFolder: (key: string) => void;
  versions: Record<string, string>;
  onVersionChange: (fileType: string, folder: string, shotGroup: string, name: string, version: string) => void;
  onOpenFile: (file: ProjectFile) => void;
}

const ShotGroup: React.FC<ShotGroupProps> = ({
  shotGroup,
  fileType,
  folder,
  files,
  expanded,
  toggleFolder,
  versions,
  onVersionChange,
  onOpenFile
}) => {
  const keySG = `${fileType}-${folder}-${shotGroup}`;
  const filesCount = Object.keys(files).length;
  
  const colorClass = fileType === 'nk' 
    ? 'text-purple-400 bg-purple-900/20 border-purple-800/50' 
    : 'text-blue-400 bg-blue-900/20 border-blue-800/50';
  
  return (
    <div className="border-t border-gray-700 first:border-t-0">
      {/* Shot Group Header */}
      <div 
        className="px-6 py-2 flex justify-between items-center cursor-pointer hover:bg-gray-750 transition-colors duration-150 bg-gray-800/50" 
        onClick={() => toggleFolder(keySG)}
      >
        <div className="flex items-center">
          <svg 
            className={`w-3.5 h-3.5 mr-2 ${fileType === 'nk' ? 'text-purple-400' : 'text-blue-400'} transition-transform duration-200 ${expanded[keySG] ? 'transform rotate-90' : ''}`} 
            fill="currentColor" 
            viewBox="0 0 20 20" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className={`font-medium text-sm ${fileType === 'nk' ? 'text-purple-200' : 'text-blue-200'}`}>
            {shotGroup}
          </span>
        </div>
        <div className="flex items-center">
          <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
            {filesCount} file{filesCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {/* Files in Shot Group */}
      {expanded[keySG] && (
        <div className="bg-gray-800/30 border-t border-gray-700/50">
          {/* Table Header */}
          <div className="flex flex-row flex-nowrap px-6 py-3 text-xs font-medium text-gray-400 border-b border-gray-700 bg-gray-800/50">
            <div className="flex-[5] min-w-0">Name</div>
            <div className="flex-[3] min-w-0">Version</div>
            <div className="flex-[2] min-w-0">Action</div>
            <div className="flex-[2] min-w-0">Modified</div>
          </div>
          
          {/* File Rows */}
          {Object.entries(files).map(([name, fileArr]) => {
            const versionKey = `${fileType}:${folder}:${shotGroup}:${name}`;
            return (
              <FileEntry
                key={versionKey}
                name={name}
                files={fileArr}
                fileType={fileType}
                folder={folder}
                shotGroup={shotGroup}
                versionKey={versionKey}
                currentVersion={versions[versionKey] || (fileArr[0] && fileArr[0].version) || ''}
                onVersionChange={onVersionChange}
                onOpenFile={onOpenFile}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShotGroup;

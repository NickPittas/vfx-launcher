import React from 'react';
import { ProjectFile } from '../../types/projectFile';
import FolderGroup from './FolderGroup';

interface FileSectionProps {
  fileType: 'nk' | 'aep'; // Limit to our supported file types
  groupedFiles: Record<string, Record<string, Record<string, ProjectFile[]>>>;
  expanded: Record<string, boolean>;
  toggleFolder: (key: string) => void;
  versions: Record<string, string>;
  onVersionChange: (fileType: string, folder: string, shotGroup: string, name: string, version: string) => void;
  onOpenFile: (file: ProjectFile) => void;
}

const FileSection: React.FC<FileSectionProps> = ({
  fileType,
  groupedFiles,
  expanded,
  toggleFolder,
  versions,
  onVersionChange,
  onOpenFile
}) => {
  // Determine colors and text based on file type
  const isNuke = fileType === 'nk';
  const headerClass = isNuke 
    ? 'from-purple-900 to-purple-800'
    : 'from-blue-900 to-blue-800';
  const iconClass = isNuke ? 'text-purple-300' : 'text-blue-300';
  const headerText = isNuke ? 'Nuke Files' : 'After Effects Files';
  
  // Get icon path based on file type
  const iconPath = isNuke
    ? "M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"
    : "M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z";
  
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700 mb-8">
      {/* Header */}
      <div className={`px-6 py-4 bg-gradient-to-r ${headerClass} flex items-center`}>
        <svg className={`w-4 h-4 mr-3 ${iconClass}`} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path d={iconPath}></path>
        </svg>
        <h3 className="text-lg font-bold text-white">{headerText}</h3>
      </div>
      
      {/* File List */}
      <div className="divide-y divide-gray-700">
        {Object.entries(groupedFiles).map(([folder, shotGroups]) => (
          <FolderGroup
            key={`${fileType}-${folder}`}
            folder={folder}
            fileType={fileType}
            shotGroups={shotGroups}
            expanded={expanded}
            toggleFolder={toggleFolder}
            versions={versions}
            onVersionChange={onVersionChange}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    </div>
  );
};

export default FileSection;

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ProjectFile } from '../../types/projectFile';

interface FileEntryProps {
  name: string;
  files: ProjectFile[];
  fileType: string;
  folder: string;
  shotGroup: string;
  versionKey: string;
  currentVersion: string;
  onVersionChange: (fileType: string, folder: string, shotGroup: string, name: string, version: string) => void;
  onOpenFile: (file: ProjectFile) => void;
}

const FileEntry: React.FC<FileEntryProps> = ({ 
  name, 
  files, 
  fileType, 
  folder, 
  shotGroup,
  versionKey, 
  currentVersion, 
  onVersionChange, 
  onOpenFile 
}) => {
  const file = files.find(f => f.version === currentVersion) || files[0];
  
  return (
    <div className="flex flex-row flex-nowrap px-6 py-3 items-center border-b border-gray-700/50 last:border-b-0 hover:bg-gray-800/50 transition-colors duration-150">
      <div className="flex-[5] min-w-0 font-medium text-sm truncate flex items-center">
        <svg 
          className={`w-4 h-4 mr-2 ${fileType === 'nk' ? 'text-purple-400' : 'text-blue-400'} flex-shrink-0`} 
          fill="currentColor" 
          viewBox="0 0 20 20" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
        </svg>
        {name}
      </div>
      <div className="flex-[3] min-w-0 pr-2">
        <select 
          value={currentVersion || (files[0] && files[0].version) || ''} 
          onChange={e => onVersionChange(fileType, folder, shotGroup, name, e.target.value)} 
          className={`w-full py-1.5 px-3 text-sm bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-1 ${
            fileType === 'nk' ? 'focus:ring-purple-500 focus:border-purple-500' : 'focus:ring-blue-500 focus:border-blue-500'
          }`}
        >
          {files.map(f => <option key={f.version} value={f.version}>v{f.version}</option>)}
        </select>
      </div>
      <div className="flex-[2] min-w-0 pr-2">
        <button 
          onClick={() => {
            // Extreme simplicity for debugging
            alert("BUTTON CLICKED");
            console.log("BUTTON CLICKED");
            
            if (file) {
              onOpenFile(file);
            }
          }}
          className={`w-full py-1.5 px-3 ${
            fileType === 'nk' 
              ? 'bg-purple-600 hover:bg-purple-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white rounded-md text-sm font-medium transition-colors duration-150 flex items-center justify-center`}
        >
          <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"></path>
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"></path>
          </svg>
          Open
        </button>
      </div>
      <div className="flex-[2] min-w-0 text-xs text-gray-400">
        {file && formatDistanceToNow(new Date(file.last_modified), {addSuffix: true})}
      </div>
    </div>
  );
};

export default FileEntry;

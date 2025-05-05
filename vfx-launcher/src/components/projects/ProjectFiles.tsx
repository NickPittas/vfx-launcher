import React from 'react';
import { ProjectFile } from '../../types/projectFile';
import FileSection from './FileSection';

interface ProjectFilesProps {
  files: ProjectFile[];
  loadingFiles: boolean;
  fileError: string | null;
  showNk: boolean;
  showAep: boolean;
  grouped: {
    nk: Record<string, Record<string, Record<string, ProjectFile[]>>>;
    aep: Record<string, Record<string, Record<string, ProjectFile[]>>>;
    other: Record<string, Record<string, Record<string, ProjectFile[]>>>;
  };
  expanded: Record<string, boolean>;
  toggleFolder: (key: string) => void;
  versions: Record<string, string>;
  changeVersion: (fileType: string, folder: string, shotGroup: string, name: string, version: string) => void;
  handleOpenFile: (file: ProjectFile) => void;
}

const ProjectFiles: React.FC<ProjectFilesProps> = ({
  files,
  loadingFiles,
  fileError,
  showNk,
  showAep,
  grouped,
  expanded,
  toggleFolder,
  versions,
  changeVersion,
  handleOpenFile
}) => {
  // Loading state
  if (loadingFiles) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Loading files...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (fileError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <svg className="h-12 w-12 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-medium mb-2 text-red-400">Error Loading Files</h3>
          <p className="text-gray-500">{fileError}</p>
        </div>
      </div>
    );
  }

  // No files selected state
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <svg className="h-12 w-12 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-medium mb-2">No Files Found</h3>
          <p className="text-gray-500">Select a project or use the "Refresh Files" button to scan for files.</p>
        </div>
      </div>
    );
  }

  // Empty filters state
  const hasNkFiles = Object.keys(grouped.nk).length > 0;
  const hasAepFiles = Object.keys(grouped.aep).length > 0;
  const noFilesToShow = (!showNk || !hasNkFiles) && (!showAep || !hasAepFiles);

  if (noFilesToShow) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg className="w-8 h-8 mb-4 text-gray-700" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
        </svg>
        <h3 className="text-xl font-medium mb-2">No files to display</h3>
        <p className="text-gray-600 text-center max-w-md">
          {!showNk && !showAep ? "Enable Nuke or After Effects filters to view files" : "No files found in the selected categories"}
        </p>
      </div>
    );
  }

  // Display files
  return (
    <div className="overflow-y-auto flex-grow p-6 space-y-8">
      {/* Nuke Files Section */}
      {showNk && Object.keys(grouped.nk).length > 0 && (
        <FileSection
          fileType="nk"
          groupedFiles={grouped.nk}
          expanded={expanded}
          toggleFolder={toggleFolder}
          versions={versions}
          onVersionChange={changeVersion}
          onOpenFile={handleOpenFile}
        />
      )}
      
      {/* After Effects Files Section */}
      {showAep && Object.keys(grouped.aep).length > 0 && (
        <FileSection
          fileType="aep"
          groupedFiles={grouped.aep}
          expanded={expanded}
          toggleFolder={toggleFolder}
          versions={versions}
          onVersionChange={changeVersion}
          onOpenFile={handleOpenFile}
        />
      )}
    </div>
  );
};

export default ProjectFiles;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types/project';
import { ProjectFile } from '../types/projectFile';
import { AppSettings } from '../types/settings';
import Button from '../components/Button';
import Card from '../components/Card';
import { formatDistanceToNow } from 'date-fns';
// Removed unused toast import

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  
  // State for the selected file version in each group (fileType:folder:fileName -> version)
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  // State for showing file type filters
  const [showNuke, setShowNuke] = useState<boolean>(true);
  const [showAfterEffects, setShowAfterEffects] = useState<boolean>(true);
  // State for tracking expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log(`Fetching details for project ${projectId}`);
        // Fetch project details and files from Rust backend
        const projectIdNum = parseInt(projectId, 10);
        const fetchedProject: Project = await invoke('get_project_details', { 
          projectId: projectIdNum,
          userId: user?.id
        });
        
        console.log('Project details received:', fetchedProject);
        setProject(fetchedProject);
        
        // Fetch the project files
        console.log(`Fetching files for project ${projectId}`);
        const fetchedFiles: ProjectFile[] = await invoke('get_project_files', { projectId: projectIdNum });
        console.log(`Received ${fetchedFiles.length} files`);
        
        // If no files were found and project path exists, trigger a scan
        if (fetchedFiles.length === 0 && fetchedProject && fetchedProject.path) {
          console.log(`No files found, scanning project at ${fetchedProject.path}`);
          try {
            const settings: AppSettings = await invoke('get_settings');
            await invoke('scan_project', {
              projectId: projectIdNum,
              projectPath: fetchedProject.path,
              includePatterns: settings.default_include_patterns || ["*.nk", "*.nuke", "*.aep"],
              scanDirs: settings.default_scan_subdirs || [".", "comp", "comps", "shots"]
            });
            
            // Fetch files again after scanning
            const rescannedFiles: ProjectFile[] = await invoke('get_project_files', { projectId: projectIdNum });
            console.log(`After scan: found ${rescannedFiles.length} files`);
            setFiles(rescannedFiles);
          } catch (scanErr) {
            console.error('Error scanning project:', scanErr);
            // Still set the original empty files array
            setFiles(fetchedFiles);
          }
        } else {
          setFiles(fetchedFiles);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(`Failed to fetch project details: ${errorMsg}`);
        console.error('Error fetching project data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId, user?.id]);

  // Open file in Nuke or After Effects based on file type
  const handleOpenFile = async (file: ProjectFile) => {
    try {
      console.log(`Opening file: ${file.filename} (${file.file_type}) at path: ${file.path}`);
      
      // Get app settings to retrieve configured paths
      const settings: AppSettings = await invoke('get_settings');
      
      // Log the activity if user is logged in
      if (user) {
        await invoke('log_activity', {
          userId: user.id,
          activityType: 'open_file',
          projectId: project?.id,
          fileId: file.id,
          details: `Opened ${file.file_type} file: ${file.filename}`
        });
      }
      
      // Determine which application to use
      let appPath = '';
      if (file.file_type === 'nk' && settings.nuke_executable_path) {
        appPath = settings.nuke_executable_path;
        await invoke('open_file', { app_path: appPath, file_path: file.path });
      } else if (file.file_type === 'aep' && settings.ae_executable_path) {
        appPath = settings.ae_executable_path;
        await invoke('open_file', { app_path: appPath, file_path: file.path });
      } else {
        // Fallback to OS default application
        await open(file.path);
      }
      
      console.log('File opened successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Failed to open file: ${errorMsg}`);
      console.error('Error opening file:', err);
    }
  };

  // Group files by file type, parent folder, and filename with version tracking
  const groupedFiles = React.useMemo(() => {
    // Structure will be: fileType -> parentFolder -> baseName -> [files]
    const byType: Record<string, Record<string, Record<string, ProjectFile[]>>> = {
      'nuke': {},
      'aep': {},
      'other': {}
    };
    
    files.forEach(file => {
      const fileType = file.file_type || 'other';
      const parentFolder = file.parent_folder || 'Other';
      const fileName = file.filename;
      
      // Initialize file type group if it doesn't exist
      if (!byType[fileType]) {
        byType[fileType] = {};
      }
      
      // Initialize parent folder group if it doesn't exist
      if (!byType[fileType][parentFolder]) {
        byType[fileType][parentFolder] = {};
      }
      
      // Initialize filename group if it doesn't exist
      if (!byType[fileType][parentFolder][fileName]) {
        byType[fileType][parentFolder][fileName] = [];
      }
      
      // Add file to its group
      byType[fileType][parentFolder][fileName].push(file);
    });
    
    // Sort versions within each group (newest first)
    Object.keys(byType).forEach(fileType => {
      Object.keys(byType[fileType]).forEach(folder => {
        Object.keys(byType[fileType][folder]).forEach(fileName => {
          const fileGroup = byType[fileType][folder][fileName];
          fileGroup.sort((a, b) => {
            // Remove 'v' prefix and convert to number for proper numeric sorting
            const aVersion = parseInt(a.version.replace(/^v/i, '')) || 0;
            const bVersion = parseInt(b.version.replace(/^v/i, '')) || 0;
            return bVersion - aVersion; // Sort descending (newest first)
          });
        });
      });
    });
    
    return byType;
  }, [files]);

  // Initialize selectedVersions for new file groups
  useEffect(() => {
    Object.keys(groupedFiles).forEach(fileType => {
      Object.keys(groupedFiles[fileType]).forEach(folder => {
        Object.keys(groupedFiles[fileType][folder]).forEach(fileName => {
          const fileGroup = groupedFiles[fileType][folder][fileName];
          const fileKey = `${fileType}:${folder}:${fileName}`;
          if (fileGroup.length > 0 && !selectedVersions[fileKey]) {
            setSelectedVersions(prev => ({
              ...prev,
              [fileKey]: fileGroup[0].version
            }));
          }
        });
      });
    });
  }, [groupedFiles]);

  // Get the selected file version for a specific file
  const getSelectedFile = (fileType: string, folder: string, filename: string): ProjectFile | undefined => {
    const fileKey = `${fileType}:${folder}:${filename}`;
    const selectedVersion = selectedVersions[fileKey];
    
    if (!selectedVersion || !groupedFiles[fileType]?.[folder]?.[filename]) {
      return undefined;
    }
    
    // Find the file that matches the selected version
    return groupedFiles[fileType][folder][filename].find(
      file => file.version === selectedVersion
    );
  };

  // Handle version selection change
  const handleVersionChange = (fileType: string, folder: string, filename: string, version: string) => {
    const fileKey = `${fileType}:${folder}:${filename}`;
    setSelectedVersions(prev => ({
      ...prev,
      [fileKey]: version
    }));
  };
  
  // Toggle a folder expansion state
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };
  
  // Check if a folder is expanded
  const isFolderExpanded = (folderPath: string): boolean => {
    return !!expandedFolders[folderPath];
  };
  
  // Toggle file type visibility
  const toggleFileTypeVisibility = (fileType: 'nuke' | 'aep') => {
    if (fileType === 'nuke') {
      setShowNuke(prev => !prev);
    } else {
      setShowAfterEffects(prev => !prev);
    }
  };
  

  
  // Handle manual refresh of project files
  const handleRefresh = async () => {
    if (!projectId || !project) return;
    setIsLoading(true);
    try {
      console.log(`Scanning project ${project.id} at path ${project.path}`);
      
      // Get settings for scan directories
      const settings: AppSettings = await invoke('get_settings');
      
      // Scan the project directory first
      await invoke('scan_project', {
        projectId: project.id,
        projectPath: project.path,
        includePatterns: ["*.nk", "*.nuke", "*.aep"],
        scanDirs: settings.default_scan_subdirs || [".", "comp", "comps", "shots"]
      });
      
      // Then get the updated files
      const refreshedFiles: ProjectFile[] = await invoke('get_project_files', { 
        projectId: parseInt(projectId, 10) 
      });
      
      console.log(`Found ${refreshedFiles.length} files`);
      setFiles(refreshedFiles);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to refresh files: ${errorMsg}`);
      console.error('Refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start or stop watching for file changes
  const toggleWatcher = async () => {
    if (!projectId || !project) return;
    
    try {
      if (isWatching) {
        // Stop watching
        await invoke('stop_watching_project', { projectId: parseInt(projectId, 10) });
        setIsWatching(false);
      } else {
        // Start watching
        const settings: AppSettings = await invoke('get_settings');
        const started = await invoke<boolean>('start_watching_project', {
          projectId: parseInt(projectId, 10),
          projectPath: project.path,
          scanDirs: settings.default_scan_subdirs
        });
        setIsWatching(started);
      }
    } catch (err) {
      console.error('Error toggling file watcher:', err);
    }
  };
  
  // Check if this project is already being watched when component mounts
  useEffect(() => {
    if (!projectId) return;
    
    const checkWatchStatus = async () => {
      try {
        const watchingProjects = await invoke<Array<{project_id: number, is_watching: boolean}>>('get_watching_projects');
        const isBeingWatched = watchingProjects.some(p => p.project_id === parseInt(projectId, 10));
        setIsWatching(isBeingWatched);
      } catch (err) {
        console.error('Error checking watch status:', err);
      }
    };
    
    checkWatchStatus();
  }, [projectId]);

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    if (!user || !project) return;
    
    try {
      // Toggle in the backend
      const newIsFavorite: boolean = await invoke('toggle_favorite_project', {
        userId: user.id,
        projectId: project.id
      });
      
      // Update local state
      setProject(prevProject => {
        if (!prevProject) return null;
        return { ...prevProject, is_favorite: newIsFavorite };
      });
      
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 py-12">
        <div className="animate-pulse text-center">
          <svg className="animate-spin h-10 w-10 mx-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-3 text-gray-600 dark:text-gray-300">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 my-4 rounded">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-200">Error: {error}</p>
            <Link to="/" className="mt-2 text-sm font-medium text-red-700 dark:text-red-200 hover:underline">
              &larr; Return to projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <svg className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">Project not found</h3>
        <p className="mt-1 text-gray-500 dark:text-gray-400">The project you're looking for doesn't exist or was deleted.</p>
        <div className="mt-6">
          <button onClick={() => navigate('/')} className="text-blue-400 hover:text-blue-300 ml-2">
            <span>&larr; Back to Projects</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center mb-4">
        <button 
          onClick={() => navigate('/')} 
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center mr-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Projects
        </button>
        <span className="text-gray-500 dark:text-gray-400">|</span>
        <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">Last modified {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
      </div>
      
      <Card className="mb-6">
        <div className="flex justify-between items-start p-4">
          <div className="flex-1">
            <div className="flex items-center">
              {user && project && (
                <button 
                  onClick={handleToggleFavorite}
                  className="mr-2 text-xl focus:outline-none"
                  aria-label={project.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  {project.is_favorite 
                    ? <span className="text-yellow-500">★</span> 
                    : <span className="text-gray-400 hover:text-yellow-500">☆</span>}
                </button>
              )}
              <h1 className="text-xl font-semibold">
                {project?.name || 'Project Details'}
              </h1>
            </div>
            {project?.client && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Client: <span className="font-medium">{project.client}</span>
              </p>
            )}
            <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate">{project?.path}</span>
            </div>
          </div>

          <div className="flex gap-2 items-start">
            <Button 
              variant={isWatching ? "warning" : "success"}
              size="small"
              onClick={toggleWatcher}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {isWatching ? 'Stop Watch' : 'Watch Files'}
              </div>
            </Button>
            <Button 
              variant="primary"
              size="small"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </div>
            </Button>
          </div>
        </div>
      </Card>

      {/* File type filters */}
      {!isLoading && files.length > 0 && (
        <div className="flex items-center mb-4 space-x-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Show files:</div>
          <div className="flex space-x-2">
            <Button 
              variant={showNuke ? "primary" : "secondary"} 
              size="small"
              onClick={() => toggleFileTypeVisibility('nuke')}
            >
              <span className="flex items-center">
                <span className="inline-block h-2 w-2 rounded-full bg-purple-500 mr-1.5"></span>
                Nuke
              </span>
            </Button>
            <Button 
              variant={showAfterEffects ? "primary" : "secondary"} 
              size="small"
              onClick={() => toggleFileTypeVisibility('aep')}
            >
              <span className="flex items-center">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-1.5"></span>
                After Effects
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* Files section */}
      {!isLoading && files.length > 0 ? (
        <div className="space-y-6">
          {/* Nuke files */}
          {showNuke && Object.keys(groupedFiles.nuke || {}).length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-100 dark:border-purple-800">
                <h3 className="font-medium text-purple-800 dark:text-purple-200 flex items-center">
                  <span className="inline-block h-3 w-3 rounded-full bg-purple-500 mr-2"></span>
                  Nuke Files
                </h3>
              </div>
              
              {/* Group by parent folder */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {Object.keys(groupedFiles.nuke || {}).sort().map(folder => (
                  <div key={`nuke-${folder}`}>
                    {/* Folder header (collapsible) */}
                    <div 
                      className="px-4 py-2 bg-gray-50 dark:bg-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
                      onClick={() => toggleFolder(`nuke-${folder}`)}
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-transform ${isFolderExpanded(`nuke-${folder}`) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-sm">{folder}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.keys(groupedFiles.nuke[folder]).length} files
                      </span>
                    </div>
                    
                    {/* Files in folder (collapsible content) */}
                    {isFolderExpanded(`nuke-${folder}`) && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {Object.keys(groupedFiles.nuke[folder]).sort().map(fileName => {
                          const selectedFile = getSelectedFile('nuke', folder, fileName);
                          const fileVersions = groupedFiles.nuke[folder][fileName];
                          const fileKey = `nuke:${folder}:${fileName}`;
                          
                          return (
                            <div key={fileKey} className="px-4 py-3">
                              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                <div className="flex items-center">
                                  {/* File type icon */}
                                  <span className="text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded mr-2">NK</span>
                                  
                                  {/* Filename */}
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{fileName}</h4>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {/* Version selector */}
                                  <div className="flex items-center text-xs">
                                    <span className="mr-1 text-gray-500 dark:text-gray-400">v:</span>
                                    <select
                                      value={selectedVersions[fileKey] || ''}
                                      onChange={(e) => handleVersionChange('nuke', folder, fileName, e.target.value)}
                                      className="border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded px-1 py-0.5 text-xs"
                                    >
                                      {fileVersions.map(file => (
                                        <option key={file.id} value={file.version}>
                                          {file.version}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  {/* Open button */}
                                  <Button
                                    variant="primary"
                                    size="small"
                                    onClick={() => {
                                      if (selectedFile) {
                                        handleOpenFile(selectedFile);
                                      }
                                    }}
                                  >
                                    Open
                                  </Button>
                                </div>
                              </div>
                              
                              {selectedFile && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Modified {formatDistanceToNow(new Date(selectedFile.last_modified), { addSuffix: true })}
                                  <span className="mx-1">•</span>
                                  <span className="truncate">{selectedFile.path}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
          
          {/* After Effects files */}
          {showAfterEffects && Object.keys(groupedFiles.aep || {}).length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 flex items-center">
                  <span className="inline-block h-3 w-3 rounded-full bg-blue-500 mr-2"></span>
                  After Effects Files
                </h3>
              </div>
              {/* Group by parent folder */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {Object.keys(groupedFiles.aep || {}).sort().map(folder => (
                  <div key={`aep-${folder}`}>
                    {/* Folder header (collapsible) */}
                    <div 
                      className="px-4 py-2 bg-gray-50 dark:bg-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
                      onClick={() => toggleFolder(`aep-${folder}`)}
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-transform ${isFolderExpanded(`aep-${folder}`) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-sm">{folder}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.keys(groupedFiles.aep[folder]).length} files
                      </span>
                    </div>
                    
                    {/* Files in folder (collapsible content) */}
                    {isFolderExpanded(`aep-${folder}`) && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {Object.keys(groupedFiles.aep[folder]).sort().map(fileName => {
                          const selectedFile = getSelectedFile('aep', folder, fileName);
                          const fileVersions = groupedFiles.aep[folder][fileName];
                          const fileKey = `aep:${folder}:${fileName}`;
                          
                          return (
                            <div key={fileKey} className="px-4 py-3">
                              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                <div className="flex items-center">
                                  {/* File type icon */}
                                  <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded mr-2">AE</span>
                                  
                                  {/* Filename */}
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{fileName}</h4>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {/* Version selector */}
                                  <div className="flex items-center text-xs">
                                    <span className="mr-1 text-gray-500 dark:text-gray-400">v:</span>
                                    <select
                                      value={selectedVersions[fileKey] || ''}
                                      onChange={(e) => handleVersionChange('aep', folder, fileName, e.target.value)}
                                      className="border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded px-1 py-0.5 text-xs"
                                    >
                                      {fileVersions.map(file => (
                                        <option key={file.id} value={file.version}>
                                          {file.version}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  {/* Open button */}
                                  <Button
                                    variant="primary"
                                    size="small"
                                    onClick={() => {
                                      if (selectedFile) {
                                        handleOpenFile(selectedFile);
                                      }
                                    }}
                                  >
                                    Open
                                  </Button>
                                </div>
                              </div>
                              
                              {selectedFile && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Modified {formatDistanceToNow(new Date(selectedFile.last_modified), { addSuffix: true })}
                                  <span className="mx-1">•</span>
                                  <span className="truncate">{selectedFile.path}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
          
          {/* Other files */}
          {Object.keys(groupedFiles.other || {}).length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-medium text-gray-800 dark:text-gray-200 flex items-center">
                  <span className="inline-block h-3 w-3 rounded-full bg-gray-500 mr-2"></span>
                  Other Files
                </h3>
              </div>
              {/* Group by parent folder */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {Object.keys(groupedFiles.other).sort().map(folder => (
                  <div key={`other-${folder}`}>             
                    {/* Folder header */}
                    <div
                      className="px-4 py-2 bg-gray-50 dark:bg-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
                      onClick={() => toggleFolder(`other-${folder}`)}
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-transform ${isFolderExpanded(`other-${folder}`) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-sm">{folder}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.keys(groupedFiles.other[folder]).length} files
                      </span>
                    </div>

                    {/* Files in folder */}
                    {isFolderExpanded(`other-${folder}`) && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {Object.keys(groupedFiles.other[folder]).sort().map(fileName => {
                          const fileGroup = groupedFiles.other[folder][fileName];
                          const selectedFile = getSelectedFile('other', folder, fileName) || fileGroup[0];
                          const fileKey = `other:${folder}:${fileName}`;

                          return (
                            <div key={fileKey} className="px-4 py-3">
                              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                <div className="flex items-center">
                                  <span className="text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 px-1.5 py-0.5 rounded mr-2">
                                    {selectedFile.filename.split('.').pop()?.toUpperCase() || 'OT'}
                                  </span>
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{fileName}</h4>
                                </div>
                                <Button variant="primary" size="small" onClick={() => handleOpenFile(selectedFile)}>
                                  Open
                                </Button>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Modified {formatDistanceToNow(new Date(selectedFile.last_modified), { addSuffix: true })}
                                <span className="mx-1">•</span>
                                <span className="truncate">{selectedFile.path}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden text-center py-8 bg-gray-50 dark:bg-gray-800">
          <svg className="w-12 h-12 mx-auto text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-gray-100">No files found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">This project doesn't have any files yet.</p>
          <div className="mt-3">
            <Button 
              variant="primary"
              size="small"
              onClick={handleRefresh}
            >
              <div className="flex items-center">
                <svg className="mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scan Files
              </div>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ProjectDetailPage;

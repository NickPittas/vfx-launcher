import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// Import types
import { Project } from '../types/project';
import { ProjectFile } from '../types/projectFile';
import { AppSettings } from '../types/settings';

// Type for grouped files
type GroupedFiles = {
  nk: Record<string, Record<string, Record<string, ProjectFile[]>>>;
  aep: Record<string, Record<string, Record<string, ProjectFile[]>>>;
  other: Record<string, Record<string, Record<string, ProjectFile[]>>>;
};

// Import components
import ProjectsList from '../components/projects/ProjectsList';
import ProjectControls from '../components/projects/ProjectControls';
import ProjectFiles from '../components/projects/ProjectFiles';

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [projError, setProjError] = useState<string | null>(null);
  const [projFilter, setProjFilter] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Files state
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // UI controls
  const [groupByName, setGroupByName] = useState<boolean>(true);
  const [showNk, setShowNk] = useState<boolean>(true);
  const [showAep, setShowAep] = useState<boolean>(true);
  const [versions, setVersions] = useState<Record<string,string>>({});
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  
  // Delete confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

  // Fetch projects function (defined inside component to access state)
  const loadProjects = async () => {
    setLoadingProjects(true);
    setProjError(null);
    try {
      const ps: Project[] = await invoke('get_projects', { userId: user?.id });
      setProjects(ps);
      // Automatically select the first project if none is selected or the selected one was deleted
      if (ps.length && (!selectedProject || !ps.find(p => p.id === selectedProject.id))) {
        setSelectedProject(ps[0]);
      } 
      // If the selected project was deleted and there are no projects left, set selected to null
      else if (!ps.length && selectedProject) { // Only update if selectedProject exists
        setSelectedProject(null);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjError('Failed to load projects');
      toast.error('Failed to load projects.');
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => { loadProjects(); }, [user]); // Initial load

  // Fetch files when project changes - only load from DB, don't scan
  const loadFiles = async () => {
    if (!selectedProject) { 
      setFiles([]); 
      return; 
    }
    
    setLoadingFiles(true);
    setFileError(null);
    
    try {
      const fsRaw: Array<Omit<ProjectFile,'file_type'> & { file_type: string }> = 
        await invoke('get_project_files', { projectId: selectedProject.id });
      
      // Don't automatically scan if no files found - user must explicitly refresh
      // This prevents unnecessary scanning when opening the app
      
      const fsNorm: ProjectFile[] = fsRaw.map(f => {
        const ft = f.file_type.toLowerCase();
        const file_type = (ft === 'nuke' || ft === 'nk') ? 'nk' : (ft === 'aep') ? 'aep' : 'other';
        return { ...f, file_type };
      });
      
      setFiles(fsNorm);
      
      // If no files found, show a message to the user
      if (fsRaw.length === 0) {
        toast.custom('No files found. Click "Refresh Files" to scan for files.');
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      setFileError('Failed to load files');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => { loadFiles(); }, [selectedProject]);

  // Group files by type -> folder -> shot group -> name
  const grouped = useMemo<GroupedFiles>(() => {
    const byType: GroupedFiles = {
      nk: {},
      aep: {},
      other: {}
    };
    
    files.forEach(f => {
      const t = ['nk','aep'].includes(f.file_type) ? f.file_type : 'other';
      if (!byType[t]) byType[t] = {};
      
      // group using top-level subfolder of parent_folder
      const folder = (f.parent_folder || 'Root').split('/')[0] || 'Root';
      if (!byType[t][folder]) byType[t][folder] = {};
      
      // Extract shot group from filename (e.g., "BALA" from "BALA_BALA_0010_comp")
      // Look for patterns like BALA_, BALB_, etc.
      const name = f.filename;
      const shotGroupMatch = name.match(/^([A-Z0-9]+)_/i);
      const shotGroup = shotGroupMatch ? shotGroupMatch[1] : 'Other';
      
      if (!byType[t][folder][shotGroup]) byType[t][folder][shotGroup] = {};
      if (!byType[t][folder][shotGroup][name]) byType[t][folder][shotGroup][name] = [];
      byType[t][folder][shotGroup][name].push(f);
    });
    
    // sort versions desc
    Object.values(byType).forEach(folders => {
      Object.values(folders).forEach(shotGroups => {
        Object.values(shotGroups).forEach(names => {
          Object.values(names).forEach(arr => 
            arr.sort((a,b) => parseInt(b.version.replace(/^v/i,'')) - parseInt(a.version.replace(/^v/i,'')))
          );
        });
      });
    });
    
    return byType;
  }, [files]);

  // Set initial versions
  useEffect(() => {
    const v:Record<string,string> = {};
    Object.entries(grouped).forEach(([t,folders]) => {
      Object.entries(folders).forEach(([folder,shotGroups]) => {
        Object.entries(shotGroups).forEach(([shotGroup,names]) => {
          Object.entries(names).forEach(([name,arr]) => {
            if (arr.length) v[`${t}:${folder}:${shotGroup}:${name}`] = arr[0].version;
          });
        });
      });
    });
    setVersions(v);
  }, [grouped]);

  const changeVersion = (t:string, folder:string, shotGroup:string, name:string, v:string) => {
    setVersions(prev => ({ ...prev, [`${t}:${folder}:${shotGroup}:${name}`]: v }));
  };

  const toggleFolder = (key:string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // Project actions
  // This step has been integrated into the deleteProject function
  
  // The function called by the delete button - shows the confirmation UI
  const deleteProject = (id: number) => {
    const startMessage = `[ProjectsPage] deleteProject started for ID: ${id}`;
    console.log(startMessage);
    invoke('log_to_terminal', { message: startMessage });
    
    // Set the project to delete and show the confirmation dialog
    setProjectToDelete(id);
    setConfirmDialogOpen(true);
  };
  
  // Handle actual deletion when user confirms
  const handleConfirmDelete = async () => {
    // Ensure we have a project ID to delete
    if (projectToDelete === null) {
      console.error('No project ID set for deletion');
      return;
    }
    
    const id = projectToDelete;
    const toastId = toast.loading('Deleting project...');
    
    try {
      const invokingMessage = `[ProjectsPage] Invoking 'emergency_delete_project' for ID: ${id}`;
      console.log(invokingMessage);
      await invoke('log_to_terminal', { message: invokingMessage });

      await invoke('emergency_delete_project', { projectId: id });
      
      const successMessage = `[ProjectsPage] Successfully deleted project ID: ${id}. Refreshing list.`;
      console.log(successMessage);
      await invoke('log_to_terminal', { message: successMessage });
      
      toast.dismiss(toastId);
      toast.success('Project deleted successfully');
      
      // Clear dialog state
      setConfirmDialogOpen(false);
      setProjectToDelete(null);
      
      // Refresh UI
      await loadProjects();

    } catch (error) {
      const errorMessage = `DELETE ERROR: Failed to delete project ID ${id}: ${error}`;
      console.error(errorMessage);
      await invoke('log_to_terminal', { message: `ERROR: ${errorMessage}` });
      
      toast.dismiss(toastId);
      
      // Provide a specific error message
      const errorMessageToDisplay = error instanceof Error ? error.message : String(error);
      toast.error(`Delete failed: ${errorMessageToDisplay}`);
      
      // Clear dialog
      setConfirmDialogOpen(false);
      setProjectToDelete(null);
    }
  };
  
  // Cancel delete operation
  const handleCancelDelete = () => {
    console.log(`[ProjectsPage] Delete cancelled for project ID: ${projectToDelete}`);
    invoke('log_to_terminal', { message: `[ProjectsPage] Delete cancelled for project ID: ${projectToDelete}` });
    setConfirmDialogOpen(false);
    setProjectToDelete(null);
  };

  const addProject = () => {
    navigate('/add-project');
  };

  // Refresh files for current project
  const refreshFiles = async () => {
    if (!selectedProject) return;
    
    setLoadingFiles(true);
    setFileError(null);
    
    try {
      const project = await invoke<Project>('get_project_details', { projectId: selectedProject.id });
      
      await invoke('scan_project', { 
        projectId: selectedProject.id,
        projectPath: project.path,
        includePatterns: ["\\.nk$", "\\.aep$"], 
        scanDirs: [] 
      });
      
      await loadFiles();
      toast.success('Files refreshed');
    } catch (error) {
      console.error('Failed to scan files:', error);
      setFileError('Failed to scan files');
      toast.error('Failed to scan files');
    } finally {
      setLoadingFiles(false);
    }
  };

  // Open a file using appropriate application
  const handleOpenFile = async (file: ProjectFile) => {
    try {
      const settings = await invoke<AppSettings>('get_settings');
      
      let appPath = '';
      
      if (file.file_type === 'nk') {
        appPath = settings.nuke_executable_path || '';
        if (!appPath) {
          throw new Error('Nuke executable path is not set in settings');
        }
      } else if (file.file_type === 'aep') {
        appPath = settings.ae_executable_path || '';
        if (!appPath) {
          throw new Error('After Effects executable path is not set in settings');
        }
      } else {
        // Don't attempt to open unsupported types
        toast.error(`Cannot open unsupported file type: ${file.file_type}`);
        return;
      }
      
      await invoke('open_file', {
        filePath: file.path,
        appPath: appPath
      });
      
      try {
        await invoke('log_activity', {
          user_id: user?.id, 
          activity_type: 'open_file', 
          project_id: selectedProject?.id, 
          file_id: file.id,
          details: `Opened ${file.filename}`
        });
      } catch (activityError) {
        console.error('Failed to log activity:', activityError);
      }
      
      toast.success(`Opening ${file.filename}`);
    } catch (error) {
      console.error('Failed to open file:', error);
      toast.error(`Failed to open file: ${error}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Delete Confirmation Dialog */}
      {confirmDialogOpen && projectToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto shadow-xl border border-gray-600">
            <h3 className="text-xl font-semibold text-red-500 mb-2">Confirm Delete</h3>
            <div className="my-4 text-white">
              Are you sure you want to delete this project?
              <br /><br />
              <span className="font-bold">This action cannot be undone.</span>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-grow overflow-hidden">
        {/* Project Sidebar */}
        <ProjectsList
          projects={projects}
          loadingProjects={loadingProjects}
          projError={projError}
          projFilter={projFilter}
          selectedProject={selectedProject}
          onProjectSelect={setSelectedProject}
          onFilterChange={setProjFilter}
          onAddProject={addProject}
          onDeleteProject={deleteProject}
        />
        
        {/* Main Content Area */}
        <div className="flex flex-col flex-grow overflow-hidden">
          {/* Project Title */}
          {selectedProject && (
            <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
              <h1 className="text-xl font-bold text-white">{selectedProject.name}</h1>
            </div>
          )}

          {/* Project Controls */}
          {selectedProject && (
            <ProjectControls
              showNk={showNk}
              showAep={showAep}
              groupByName={groupByName}
              onShowNkChange={setShowNk}
              onShowAepChange={setShowAep}
              onGroupByNameChange={setGroupByName}
              onRefreshFiles={refreshFiles}
            />
          )}

          {/* Project Files */}
          <ProjectFiles
            files={files}
            loadingFiles={loadingFiles}
            fileError={fileError}
            showNk={showNk}
            showAep={showAep}
            grouped={grouped}
            expanded={expanded}
            toggleFolder={toggleFolder}
            versions={versions}
            changeVersion={changeVersion}
            handleOpenFile={handleOpenFile}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;

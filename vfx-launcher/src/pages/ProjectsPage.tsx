import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

// Import types
import { Project } from '../types/project';
import { ProjectFile } from '../types/projectFile';
import { AppSettings } from '../types/settings';

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

  // Fetch projects
  const loadProjects = async () => {
    setLoadingProjects(true);
    setProjError(null);
    try {
      const ps: Project[] = await invoke('get_projects', { userId: user?.id });
      setProjects(ps);
      if (ps.length && !selectedProject) setSelectedProject(ps[0]);
    } catch {
      setProjError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => { loadProjects(); }, [user]);

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
  const grouped = useMemo(() => {
    const byType: Record<string,Record<string,Record<string,Record<string,ProjectFile[]>>>> = { 
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
  const deleteProject = async (id:number) => {
    if (!window.confirm('Are you sure you want to delete this project?')) {
      return;
    }
    
    try {
      await invoke('delete_project', { project_id: id });
      
      setSelectedProject(null);
      setFiles([]);
      refreshProjects();
      
      toast.success('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error(`Delete failed: ${error}`);
    }
  };

  // on project refresh, reload projects and files
  const refreshProjects = async () => { 
    await loadProjects(); 
    if (selectedProject) await loadFiles(); 
  };

  // Refresh files for current project
  const refreshFiles = async () => {
    if (!selectedProject) return;
    
    setLoadingFiles(true);
    setFileError(null);
    
    try {
      // Get project details to get path and any existing settings
      const project = await invoke<Project>('get_project_details', { projectId: selectedProject.id });
      
      // This time we want to force a scan
      // The scan_project command requires more parameters than scan_project_files
      await invoke('scan_project', { 
        projectId: selectedProject.id,
        projectPath: project.path,
        includePatterns: ["\\.nk$", "\\.aep$"], // Find Nuke and AE files
        scanDirs: [] // Empty array means scan all directories
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
      // First fetch application settings to get the executable paths
      console.log('Fetching settings for file:', file.filename);
      const settings = await invoke<AppSettings>('get_settings');
      console.log('Settings retrieved:', settings);
      
      let appPath = '';
      
      // Determine which executable path to use based on the file type
      if (file.file_type === 'nk') {
        appPath = settings.nuke_executable_path || '';
        console.log('Using Nuke path:', appPath);
        if (!appPath) {
          throw new Error('Nuke executable path is not set in settings');
        }
      } else if (file.file_type === 'aep') {
        appPath = settings.ae_executable_path || '';
        console.log('Using After Effects path:', appPath);
        if (!appPath) {
          throw new Error('After Effects executable path is not set in settings');
        }
      } else {
        throw new Error(`Unsupported file type: ${file.file_type}`);
      }
      
      // Now call the open_file command with the correct camelCase parameter names for Tauri
      console.log('Calling open_file with parameters:', {
        filePath: file.path,
        appPath: appPath
      });
      
      // CRITICAL: Use camelCase parameter names when calling Tauri commands from JavaScript
      await invoke('open_file', {
        filePath: file.path,
        appPath: appPath
      });
      
      console.log('File opening command executed successfully');
      
      // Record activity
      try {
        console.log('Logging activity...');
        await invoke('log_activity', {
          user_id: user?.id, 
          activity_type: 'open_file', 
          project_id: selectedProject?.id, 
          file_id: file.id,
          details: `Opened ${file.filename}`
        });
      } catch (activityError) {
        // Don't fail the whole operation if activity logging fails
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
          onAddProject={() => navigate('/add-project')}
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

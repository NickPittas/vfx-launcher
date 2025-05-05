import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ProjectTemplate } from '../types/projectTemplate';

const AddProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState<string>('');
  const [projectPath, setProjectPath] = useState<string>('');
  const [clientName, setClientName] = useState<string>(''); // Optional client
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const fetched: ProjectTemplate[] = await invoke('get_project_templates');
        setTemplates(fetched);
      } catch (err) {
        console.error('Error loading templates:', err);
      }
    };
    loadTemplates();
  }, []);

  // Open folder selection dialog to choose project location
  const handleSelectFolder = async () => {
    try {
      // Use the invoke API directly to call Rust function for folder selection
      const folderPath = await invoke('select_project_folder');
      
      if (folderPath && typeof folderPath === 'string') {
        setProjectPath(folderPath);
        
        // If project name is empty, suggest a name based on the folder name
        if (!projectName) {
          // Extract folder name from path
          const parts = folderPath.split(/[\\/]/);
          const folderName = parts[parts.length - 1];
          if (folderName) {
            setProjectName(folderName);
          }
        }
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
      setError('Failed to open folder selection dialog: ' + String(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!projectName || !projectPath) {
      setError('Project Name and Path are required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      let projectId;
      if (selectedTemplate) {
        // Create project from template
        projectId = await invoke<number>('create_project_from_template', {
          name: projectName,
          client: clientName || null,
          rootPath: projectPath,  // Changed from root_path to match backend parameter name
          templateName: selectedTemplate  // Changed from template_name to match backend parameter name
        });
      } else {
        // Add existing project
        projectId = await invoke<number>('add_project', {
          name: projectName,
          path: projectPath,
          client: clientName || null
        });
      }
      
      // If we got a project ID, scan it
      if (projectId) {
        try {
          // Get current settings for scan configuration
          const settings = await invoke<any>('get_settings');
          // Scan the project directory for files
          await invoke('scan_project', {
            project_id: projectId,
            project_path: projectPath,
            include_patterns: settings.default_include_patterns,
            scan_dirs: settings.default_scan_subdirs
          });
        } catch (scanErr) {
          console.error('Warning: Project added but scan failed:', scanErr);
        }
      }

      // Navigate back to projects list on success
      navigate('/'); 

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to add project: ${errorMsg}`);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Existing Project Folder</h1>

      <div className="mb-4">
        <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project Template</label>
        <select
          id="template"
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">None (Add Existing)</option>
          {templates.map((tpl) => (
            <option key={tpl.name} value={tpl.name}>
              {tpl.name}{tpl.description ? ` - ${tpl.description}` : ''}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label>
          <input
            type="text"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client Name (Optional)</label>
          <input
            type="text"
            id="clientName"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="projectPath" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project Path</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              id="projectPath"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              required
              placeholder="e.g., /Users/yourname/Projects/Client/Show001"
              className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button 
              type="button"
              onClick={handleSelectFolder}
              className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-500"
            >
              Browse...
            </button>
          </div>
           <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Use the Browse button to select a project folder, or paste the full path manually.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800`}
        >
          {isSubmitting ? 'Adding...' : 'Add Project'}
        </button>
      </form>
    </div>
  );
};

export default AddProjectPage;

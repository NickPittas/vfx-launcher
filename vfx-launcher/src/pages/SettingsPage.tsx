import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from '../types/settings';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    default_scan_subdirs: [],
    default_include_patterns: [],
    default_exclude_patterns: []
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // raw inputs for comma-separated settings
  const [rawScanSubdirs, setRawScanSubdirs] = useState<string>('');
  const [rawIncludePatterns, setRawIncludePatterns] = useState<string>('');
  const [rawExcludePatterns, setRawExcludePatterns] = useState<string>('');

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch settings from Rust backend
        const fetchedSettings: AppSettings = await invoke('get_settings');
        setSettings(fetchedSettings);
        // initialize raw inputs
        setRawScanSubdirs(fetchedSettings.default_scan_subdirs.join(', '));
        setRawIncludePatterns(fetchedSettings.default_include_patterns.join(', '));
        setRawExcludePatterns(fetchedSettings.default_exclude_patterns.join(', '));
      } catch (err) {
        setError(`Failed to load settings: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // handlers for settings fields
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value } as any));
    setSuccessMessage(null);
  };
  const handleRawScanSubdirsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawScanSubdirs(e.target.value);
    setSuccessMessage(null);
  };
  const handleRawIncludePatternsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawIncludePatterns(e.target.value);
    setSuccessMessage(null);
  };
  const handleRawExcludePatternsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawExcludePatterns(e.target.value);
    setSuccessMessage(null);
  };

  // Save settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // parse raw comma-separated fields
      const newSettings: AppSettings = {
        ...settings,
        default_scan_subdirs: rawScanSubdirs.split(',').map(s => s.trim()).filter(Boolean),
        default_include_patterns: rawIncludePatterns.split(',').map(s => s.trim()).filter(Boolean),
        default_exclude_patterns: rawExcludePatterns.split(',').map(s => s.trim()).filter(Boolean),
      };
      // Save settings to Rust backend
      await invoke('save_settings', { settings: newSettings });
      setSettings(newSettings);
      setSuccessMessage('Settings saved successfully!');
    } catch (err) {
      setError(`Failed to save settings: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p>Loading settings...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Application Settings</h1>
      {error && <p className="mb-4 text-red-600 dark:text-red-400">Error: {error}</p>}
      {successMessage && <p className="mb-4 text-green-600 dark:text-green-400">{successMessage}</p>}

      <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
        <div>
          <label htmlFor="nuke_executable_path" className="block text-sm font-medium">Nuke Executable Path</label>
          <input
            type="text"
            id="nuke_executable_path"
            name="nuke_executable_path"
            value={settings.nuke_executable_path || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full input-field"
            placeholder="/Path/to/Nuke"
          />
        </div>
        <div>
          <label htmlFor="ae_executable_path" className="block text-sm font-medium">After Effects Executable Path</label>
          <input
            type="text"
            id="ae_executable_path"
            name="ae_executable_path"
            value={settings.ae_executable_path || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full input-field"
            placeholder="/Path/to/AfterEffects"
          />
        </div>
        <div>
          <label htmlFor="default_scan_subdirs" className="block text-sm font-medium">Default Scan Subdirectories (comma-separated)</label>
          <input
            type="text"
            id="default_scan_subdirs"
            value={rawScanSubdirs}
            onChange={handleRawScanSubdirsChange}
            className="mt-1 block w-full input-field"
            placeholder="e.g., nuke, ae, comp"
          />
        </div>
        <div>
          <label htmlFor="default_include_patterns" className="block text-sm font-medium">Default Include Patterns (comma-separated)</label>
          <input
            type="text"
            id="default_include_patterns"
            value={rawIncludePatterns}
            onChange={handleRawIncludePatternsChange}
            className="mt-1 block w-full input-field"
            placeholder="e.g., *.nk, *.aep"
          />
        </div>
        <div>
          <label htmlFor="default_exclude_patterns" className="block text-sm font-medium">Default Exclude Patterns (comma-separated)</label>
          <input
            type="text"
            id="default_exclude_patterns"
            value={rawExcludePatterns}
            onChange={handleRawExcludePatternsChange}
            className="mt-1 block w-full input-field"
            placeholder="e.g., _autosave, *tmp*"
          />
        </div>

        {/* Add more settings fields here as needed */}

        <button
          type="submit"
          disabled={isSaving}
          className={`px-4 py-2 rounded-md text-white ${isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};

// Helper styling - could move to index.css later
const styles = `
  .input-field {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db; /* gray-300 */
    border-radius: 0.375rem; /* rounded-md */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
  }
  .dark .input-field {
    background-color: #374151; /* dark:bg-gray-700 */
    border-color: #4b5563; /* dark:border-gray-600 */
    color: #f3f4f6; /* dark:text-white */
  }
  .input-field:focus {
    outline: none;
    border-color: #4f46e5; /* focus:border-indigo-500 */
    box-shadow: 0 0 0 1px #4f46e5; /* focus:ring-indigo-500 */
  }
`;

// Inject styles - simple way for component-specific styles
const styleSheet = document.createElement("style")
styleSheet.innerText = styles
document.head.appendChild(styleSheet)

export default SettingsPage;

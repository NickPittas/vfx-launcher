import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';

// Basic user interface (adjust based on Rust implementation)
interface User {
  id: number;
  username: string;
  email?: string | null;
  role: 'admin' | 'user';
  created_at: string;
  // Add last login, activity count etc. later
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  role: string;
}

const initialFormData: UserFormData = {
  username: '',
  email: '',
  password: '',
  role: 'user'
};

const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth(); // Removed unused isAdmin variable
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedUsers: User[] = await invoke('get_users');
        setUsers(fetchedUsers);
      } catch (err) {
        setError(`Failed to load users: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);
  
  // Reset form data
  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      role: 'user',
      password: '',
    });
    setEditingUser(null);
    setShowForm(false);
  };

  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle form submission (create/update user)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      if (editingUser) {
        // Update existing user
        await invoke('update_user', {
          id: editingUser.id,
          email: formData.email || null,
          role: formData.role,
          new_password: formData.password ? formData.password : null
        });
        setSuccess(`User ${editingUser.username} updated successfully`);
      } else {
        // Create new user
        if (!formData.username || !formData.password) {
          setError('Username and password are required');
          setIsLoading(false);
          return;
        }
        
        // Create user
        await invoke('add_user', {
          username: formData.username,
          password: formData.password,
          email: formData.email || null,
          role: formData.role
        });
        setSuccess(`User ${formData.username} created successfully`);
      }
      
      // Refresh user list
      const updatedUsers: User[] = await invoke('get_users');
      setUsers(updatedUsers);
      resetForm();
    } catch (err) {
      setError(`Failed to ${editingUser ? 'update' : 'create'} user: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start editing a user
  const handleEdit = (user: User) => {
    setFormData({
      username: user.username,
      email: user.email || '',
      role: user.role,
      password: '', // Don't populate password field when editing
    });
    setEditingUser(user);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };
  
  // Delete a user
  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user ${username}?`)) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await invoke('delete_user', { id: userId });
      setSuccess(`User ${username} deleted successfully`);
      
      // Refresh user list
      const updatedUsers: User[] = await invoke('get_users');
      setUsers(updatedUsers);
    } catch (err) {
      setError(`Failed to delete user: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <p>Loading users...</p>;
  }

  return (
    <div>
      {/* Success and Error Messages */}
      {success && (
        <div className="p-4 mb-4 bg-green-100 text-green-800 rounded-lg dark:bg-green-800 dark:text-green-200">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-800 rounded-lg dark:bg-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        {!showForm && (
          <button 
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            disabled={isLoading}
          >
            Add User
          </button>
        )}
      </div>

      {/* User Add/Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingUser ? `Edit User: ${editingUser.username}` : 'Add New User'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  disabled={!!editingUser} // Can't change username when editing
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required={!editingUser} // Only required for new users
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 dark:focus:ring-offset-gray-800 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="py-3 px-6">Username</th>
              <th scope="col" className="py-3 px-6">Email</th>
              <th scope="col" className="py-3 px-6">Role</th>
              <th scope="col" className="py-3 px-6">Created</th>
              <th scope="col" className="py-3 px-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" className="py-4 px-6 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                  {user.username} {currentUser?.id === user.id && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded">
                      You
                    </span>
                  )}
                </th>
                <td className="py-4 px-6">
                  {user.email || 'N/A'}
                </td>
                <td className="py-4 px-6">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-4 px-6">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="py-4 px-6 text-right flex justify-end space-x-3">
                  <button
                    onClick={() => handleEdit(user)}
                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                    disabled={isLoading}
                  >
                    Edit
                  </button>
                  {/* Prevent deleting your own account */}
                  {currentUser?.id !== user.id && (
                    <button
                      onClick={() => handleDelete(user.id, user.username)}
                      className="font-medium text-red-600 dark:text-red-500 hover:underline"
                      disabled={isLoading}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <p className="mt-4">No users found.</p>}
    </div>
  );
};

export default UserManagementPage;

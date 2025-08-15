import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'

export default function UserManagement() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all' or 'pending'
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'learner',
    work_type: 'Operations'
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchPendingUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users')
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingUsers = async () => {
    try {
      const response = await api.get('/users/pending-approval')
      setPendingUsers(response.data.pendingUsers || [])
    } catch (error) {
      console.error('Failed to fetch pending users:', error)
      toast.error('Failed to load pending approval requests')
    }
  }

  const handleApproveUser = async (userId) => {
    try {
      await api.put(`/users/${userId}`, { approval_status: 'approved' })
      toast.success('User approved successfully!')
      fetchUsers()
      fetchPendingUsers()
    } catch (error) {
      console.error('Failed to approve user:', error)
      toast.error('Failed to approve user')
    }
  }

  const handleRejectUser = async (userId) => {
    try {
      await api.put(`/users/${userId}`, { approval_status: 'rejected' })
      toast.success('User rejected successfully!')
      fetchUsers()
      fetchPendingUsers()
    } catch (error) {
      console.error('Failed to reject user:', error)
      toast.error('Failed to reject user')
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      role: 'learner',
      work_type: 'Operations'
    })
    setEditingUser(null)
    setShowCreateForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Client-side validation
    if (!editingUser) {
      // For new user creation, all fields are required
      if (!formData.first_name.trim() || formData.first_name.trim().length < 2) {
        toast.error('First name must be at least 2 characters long')
        return
      }
      if (!formData.last_name.trim() || formData.last_name.trim().length < 2) {
        toast.error('Last name must be at least 2 characters long')
        return
      }
      if (!formData.email.trim() || !formData.email.includes('@')) {
        toast.error('Please provide a valid email address')
        return
      }
      if (!formData.password.trim() || formData.password.length < 6) {
        toast.error('Password must be at least 6 characters long')
        return
      }
      if (!formData.role) {
        toast.error('Please select a role')
        return
      }
    } else {
      // For user updates, only filled fields are validated
      if (formData.first_name.trim() && formData.first_name.trim().length < 2) {
        toast.error('First name must be at least 2 characters long')
        return
      }
      if (formData.last_name.trim() && formData.last_name.trim().length < 2) {
        toast.error('Last name must be at least 2 characters long')
        return
      }
      if (formData.email.trim() && !formData.email.includes('@')) {
        toast.error('Please provide a valid email address')
        return
      }
      if (formData.password.trim() && formData.password.length < 6) {
        toast.error('Password must be at least 6 characters long')
        return
      }
    }
    
    try {
      if (editingUser) {
        // Update existing user
        const updateData = { ...formData }
        if (!updateData.password) {
          delete updateData.password
        }
        
        await api.put(`/users/${editingUser.id}`, updateData)
        toast.success('User updated successfully!')
      } else {
        // Create new user
        await api.post('/users', formData)
        toast.success('User created successfully!')
      }
      
      resetForm()
      fetchUsers()
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save user'
      toast.error(message)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      password: '',
      role: user.role
    })
    setShowCreateForm(true)
  }

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      await api.delete(`/users/${userId}`)
      toast.success('User deleted successfully!')
      fetchUsers()
    } catch (error) {
      toast.error('Failed to delete user')
    }
  }

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      trainer: 'bg-blue-100 text-blue-800',
      learner: 'bg-green-100 text-green-800'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[role]}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    )
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
        <p className="text-sm text-gray-500">You need admin privileges to manage users.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all users in the system
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Create/Edit User Form */}
      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingUser ? 'Edit User' : 'Create New User'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  type="text"
                  name="first_name"
                  required
                  minLength="2"
                  className="input mt-1"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Enter first name (min 2 characters)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="last_name"
                  required
                  minLength="2"
                  className="input mt-1"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Enter last name (min 2 characters)"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email *
              </label>
              <input
                type="email"
                name="email"
                required
                className="input mt-1"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter valid email address"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password {editingUser ? '(leave blank to keep current)' : '*'}
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required={!editingUser}
                  minLength={!editingUser ? "6" : undefined}
                  className="input pr-10"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={editingUser ? "Leave blank to keep current password" : "Enter password (min 6 characters)"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Role *
              </label>
              <select
                name="role"
                required
                className="input mt-1"
                value={formData.role}
                onChange={handleInputChange}
              >
                <option value="learner">Learner</option>
                <option value="trainer">Trainer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Work Type *
              </label>
              <select
                name="work_type"
                required
                className="input mt-1"
                value={formData.work_type}
                onChange={handleInputChange}
              >
                          <option value="Operations">Operations</option>
          <option value="Sales">Sales</option>
          <option value="Marketing">Marketing</option>
          <option value="Tech">Tech</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Approval ({pendingUsers.length})
          </button>
        </nav>
      </div>

      {/* Pending Approval Section */}
      {activeTab === 'pending' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Pending Approval Requests ({pendingUsers.length})
            </h3>
            
            {pendingUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No pending approval requests.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-yellow-600">
                                  {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {user.first_name} {user.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="text-primary-600 hover:text-primary-900"
                              title="Edit user details"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Approve user"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleRejectUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Reject user"
                            >
                              ✗ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Users Table */}
      {activeTab === 'all' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              All Users ({users.length})
            </h3>
          
          {users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No users found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-600">
                                {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.approval_status === 'pending' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        ) : user.approval_status === 'rejected' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

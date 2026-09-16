import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../axiosInstance';
import './Register.css';

const Register = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // ==========================
  // Form Data State
  // ==========================
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    Role: 'citizen', // Default role matching Django ROLES ('citizen' or 'organizer')
    citizenship_number: '',
    ngo_number: '',
    password1: '',
    password2: '',
  });

  // ==========================
  // Component States
  // ==========================
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading2, setLoading] = useState(false);

  // ==========================
  // Auth Loading
  // ==========================
  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // ==========================
  // Already Logged In Redirect
  // ==========================
  if (user) {
    return <Navigate to="/" replace />;
  }

  // ==========================
  // Client-Side Validation
  // ==========================
  const validateForm = () => {
    const newErrors = {};

    // Email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email address is invalid';
    }

    // Username
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    // Conditional ID validation based on Selected Role
    if (formData.Role === 'citizen') {
      if (!formData.citizenship_number.trim()) {
        newErrors.citizenship_number = 'Citizenship number is required';
      }
    } else if (formData.Role === 'organizer') {
      if (!formData.ngo_number.trim()) {
        newErrors.ngo_number = 'NGO number is required';
      }
    }

    // Password
    if (!formData.password1) {
      newErrors.password1 = 'Password is required';
    } else if (formData.password1.length < 4) {
      newErrors.password1 = 'Password must be at least 4 characters';
    }

    // Confirm Password
    if (!formData.password2) {
      newErrors.password2 = 'Confirm password is required';
    } else if (formData.password1 !== formData.password2) {
      newErrors.password2 = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==========================
  // Field Change Handler
  // ==========================
  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear active error for edited field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    // Clear general alert error
    if (errors.general) {
      setErrors((prev) => ({
        ...prev,
        general: '',
      }));
    }

    if (successMessage) {
      setSuccessMessage('');
    }
  };

  // ==========================
  // Submit Handler
  // ==========================
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    // Payload mapped to support Django model standards
    const payload = {
      email: formData.email.trim().toLowerCase(),
      username: formData.username.trim(),
      Role: formData.Role, // Capitalized 'Role' matching Django User model field
      password: formData.password1,
      password1: formData.password1,
      password2: formData.password2,
      confirm_password: formData.password2,
    };

    // Attach conditional identification mapped to backend database fields
    if (formData.Role === 'citizen') {
      payload.citizenship_number = formData.citizenship_number.trim();
      payload.pan_number = null;
    } else if (formData.Role === 'organizer') {
      // Mapping 'ngo_number' input directly to Django's 'pan_number' field
      payload.pan_number = formData.ngo_number.trim();
      payload.citizenship_number = null;
    }

    try {
      const response = await axiosInstance.post('/accounts/register/', payload);

      setSuccessMessage(
        response.data?.message || 'Registration successful! Redirecting to login...'
      );

      // Reset Form State
      setFormData({
        email: '',
        username: '',
        Role: 'citizen',
        citizenship_number: '',
        ngo_number: '',
        password1: '',
        password2: '',
      });

      // Redirect to login page after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error) {
      console.error('Registration API Error:', error.response?.data);

      const data = error.response?.data;

      // Capture Django REST Framework field validation errors
      setErrors({
        email: data?.email?.[0] || '',
        username: data?.username?.[0] || '',
        citizenship_number: data?.citizenship_number?.[0] || '',
        ngo_number: data?.pan_number?.[0] || data?.ngo_number?.[0] || '', // Map error back to ngo_number UI field
        password1: data?.password?.[0] || data?.password1?.[0] || '',
        password2: data?.confirm_password?.[0] || data?.password2?.[0] || data?.non_field_errors?.[0] || '',
        general:
          data?.detail ||
          data?.error ||
          (typeof data === 'string' ? data : null) ||
          'Registration failed. Please check your credentials and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h1 className="register-title">Welcome to Hamro Nepal</h1>
        <p className="register-subtitle">
          Create an account to access portal services
        </p>

        <form onSubmit={handleRegister} className="register-form">
          {/* SUCCESS MESSAGE ALERT */}
          {successMessage && (
            <div className="success-message">
              <span className="success-icon">✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* GENERAL ERROR ALERT */}
          {errors.general && <div className="error-message">{errors.general}</div>}

          {/* EMAIL */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleFormChange}
              className={errors.email ? 'input-error' : ''}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          {/* USERNAME */}
          <div className="form-group">
            <label htmlFor="username">Username/Organization</label>
            <input
              id="username"
              type="text"
              name="username"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleFormChange}
              className={errors.username ? 'input-error' : ''}
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>

          {/* ROLE DROPDOWN SELECTOR */}
          <div className="form-group">
            <label htmlFor="Role">Account Role</label>
            <select
              id="Role"
              name="Role"
              value={formData.Role}
              onChange={handleFormChange}
            >
              <option value="citizen">Citizen</option>
              <option value="organizer">Organization / NGO</option>
            </select>
          </div>

          {/* CONDITIONAL INPUT: CITIZENSHIP NUMBER */}
          {formData.Role === 'citizen' && (
            <div className="form-group">
              <label htmlFor="citizenship_number">Citizenship Number</label>
              <input
                id="citizenship_number"
                type="text"
                name="citizenship_number"
                placeholder="Enter citizenship number"
                value={formData.citizenship_number}
                onChange={handleFormChange}
                className={errors.citizenship_number ? 'input-error' : ''}
              />
              {errors.citizenship_number && (
                <span className="field-error">{errors.citizenship_number}</span>
              )}
            </div>
          )}

          {/* CONDITIONAL INPUT: NGO NUMBER */}
          {formData.Role === 'organizer' && (
            <div className="form-group">
              <label htmlFor="ngo_number">NGO Registration Number</label>
              <input
                id="ngo_number"
                type="text"
                name="ngo_number"
                placeholder="Enter NGO registration number"
                value={formData.ngo_number}
                onChange={handleFormChange}
                className={errors.ngo_number ? 'input-error' : ''}
              />
              {errors.ngo_number && (
                <span className="field-error">{errors.ngo_number}</span>
              )}
            </div>
          )}

          {/* PASSWORD */}
          <div className="form-group">
            <label htmlFor="password1">Password</label>
            <input
              id="password1"
              type="password"
              name="password1"
              placeholder="Enter password"
              value={formData.password1}
              onChange={handleFormChange}
              className={errors.password1 ? 'input-error' : ''}
            />
            {errors.password1 && <span className="field-error">{errors.password1}</span>}
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="form-group">
            <label htmlFor="password2">Confirm Password</label>
            <input
              id="password2"
              type="password"
              name="password2"
              placeholder="Confirm password"
              value={formData.password2}
              onChange={handleFormChange}
              className={errors.password2 ? 'input-error' : ''}
            />
            {errors.password2 && <span className="field-error">{errors.password2}</span>}
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading2}
          >
            {loading2 ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* FOOTER */}
        <div className="register-footer">
          Already have an account?{' '}
          <button
            type="button"
            className="login-link"
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
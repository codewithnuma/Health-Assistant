
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../axiosInstance';
import './Register.css';

const Register = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // ============================================================
  // FORM DATA
  // ============================================================

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    role: 'patient',

    phone_number: '',

    // Patient fields
    citizenship_number: '',
    citizenship_front: null,
    citizenship_back: null,

    // Pharmacy fields
    pharmacy_license_number: '',
    pharmacy_license_document: null,

    // Password
    password: '',
    password2: '',
  });

  // ============================================================
  // COMPONENT STATES
  // ============================================================

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading2, setLoading] = useState(false);

  // ============================================================
  // AUTH LOADING
  // ============================================================

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // ============================================================
  // ALREADY LOGGED IN
  // ============================================================

  if (user) {
    return <Navigate to="/" replace />;
  }

  // ============================================================
  // FORM VALIDATION
  // ============================================================

  const validateForm = () => {
    const newErrors = {};

    // ----------------------------------------------------------
    // Email
    // ----------------------------------------------------------

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
      newErrors.email = 'Email address is invalid';
    }

    // ----------------------------------------------------------
    // Username
    // ----------------------------------------------------------

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    // ----------------------------------------------------------
    // PHONE - OPTIONAL IN BACKEND
    // ----------------------------------------------------------

    // Phone is optional according to the backend,
    // so we don't make it required here.

    // ==========================================================
    // PATIENT VALIDATION
    // ==========================================================

    if (formData.role === 'patient') {
      if (!formData.citizenship_number.trim()) {
        newErrors.citizenship_number =
          'Citizenship number is required';
      }

      if (!formData.citizenship_front) {
        newErrors.citizenship_front =
          'Front citizenship photo is required';
      }

      if (!formData.citizenship_back) {
        newErrors.citizenship_back =
          'Back citizenship photo is required';
      }
    }

    // ==========================================================
    // PHARMACY VALIDATION
    // ==========================================================

    if (formData.role === 'pharmacy') {
      if (!formData.pharmacy_license_number.trim()) {
        newErrors.pharmacy_license_number =
          'Pharmacy licence number is required';
      }

      if (!formData.pharmacy_license_document) {
        newErrors.pharmacy_license_document =
          'Pharmacy licence document is required';
      }
    }

    // ----------------------------------------------------------
    // PASSWORD
    // ----------------------------------------------------------

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password =
        'Password must be at least 6 characters';
    }

    // ----------------------------------------------------------
    // CONFIRM PASSWORD
    // ----------------------------------------------------------

    if (!formData.password2) {
      newErrors.password2 =
        'Confirm password is required';
    } else if (formData.password !== formData.password2) {
      newErrors.password2 =
        'Passwords do not match';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ============================================================
  // NORMAL INPUT CHANGE
  // ============================================================

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear field error
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    // Clear general error
    if (errors.general) {
      setErrors((prev) => ({
        ...prev,
        general: '',
      }));
    }

    // Clear success message
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  // ============================================================
  // ROLE CHANGE
  // ============================================================

  const handleRoleChange = (e) => {
    const newRole = e.target.value;

    setFormData((prev) => ({
      ...prev,
      role: newRole,

      // Clear patient fields when switching to pharmacy
      citizenship_number:
        newRole === 'pharmacy'
          ? ''
          : prev.citizenship_number,

      citizenship_front:
        newRole === 'pharmacy'
          ? null
          : prev.citizenship_front,

      citizenship_back:
        newRole === 'pharmacy'
          ? null
          : prev.citizenship_back,

      // Clear pharmacy fields when switching to patient
      pharmacy_license_number:
        newRole === 'patient'
          ? ''
          : prev.pharmacy_license_number,

      pharmacy_license_document:
        newRole === 'patient'
          ? null
          : prev.pharmacy_license_document,
    }));

    // Clear role-specific errors
    setErrors((prev) => ({
      ...prev,
      role: '',
      citizenship_number: '',
      citizenship_front: '',
      citizenship_back: '',
      pharmacy_license_number: '',
      pharmacy_license_document: '',
      general: '',
    }));

    setSuccessMessage('');
  };

  // ============================================================
  // FILE CHANGE
  // ============================================================

  const handleFileChange = (e) => {
    const { name, files } = e.target;

    const file = files && files.length > 0
      ? files[0]
      : null;

    setFormData((prev) => ({
      ...prev,
      [name]: file,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    if (errors.general) {
      setErrors((prev) => ({
        ...prev,
        general: '',
      }));
    }

    setSuccessMessage('');
  };

  // ============================================================
  // REGISTER
  // ============================================================

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      // ========================================================
      // IMPORTANT:
      // Backend has ImageField/FileField, therefore we use
      // multipart/form-data through FormData.
      // ========================================================

      const payload = new FormData();

      // --------------------------------------------------------
      // COMMON FIELDS
      // --------------------------------------------------------

      payload.append(
        'email',
        formData.email.trim().toLowerCase()
      );

      payload.append(
        'username',
        formData.username.trim()
      );

      payload.append(
        'role',
        formData.role
      );

      payload.append(
        'password',
        formData.password
      );

      // Phone is optional, so only send it if entered
      if (formData.phone_number.trim()) {
        payload.append(
          'phone_number',
          formData.phone_number.trim()
        );
      }

      // ========================================================
      // PATIENT
      // ========================================================

      if (formData.role === 'patient') {
        payload.append(
          'citizenship_number',
          formData.citizenship_number.trim()
        );

        payload.append(
          'citizenship_front',
          formData.citizenship_front
        );

        payload.append(
          'citizenship_back',
          formData.citizenship_back
        );
      }

      // ========================================================
      // PHARMACY
      // ========================================================

      if (formData.role === 'pharmacy') {
        payload.append(
          'pharmacy_license_number',
          formData.pharmacy_license_number.trim()
        );

        payload.append(
          'pharmacy_license_document',
          formData.pharmacy_license_document
        );
      }

      // ========================================================
      // HIT BACKEND REGISTRATION API
      // ========================================================

      const response = await axiosInstance.post(
        '/accounts/register/',
        payload
      );

      console.log(
        'Registration successful:',
        response.data
      );

      setSuccessMessage(
        response.data?.message ||
          'Registration submitted successfully! Your account is waiting for admin approval.'
      );

      // ========================================================
      // RESET FORM
      // ========================================================

      setFormData({
        email: '',
        username: '',
        role: 'patient',

        phone_number: '',

        citizenship_number: '',
        citizenship_front: null,
        citizenship_back: null,

        pharmacy_license_number: '',
        pharmacy_license_document: null,

        password: '',
        password2: '',
      });

      // ========================================================
      // REDIRECT TO LOGIN
      // ========================================================

      setTimeout(() => {
        navigate('/login');
      }, 2500);

    } catch (error) {
      console.error(
        'Registration API Error:',
        error.response?.data || error
      );

      const data = error.response?.data || {};

      // ========================================================
      // HANDLE DJANGO REST FRAMEWORK ERRORS
      // ========================================================

      setErrors({
        email:
          data?.email?.[0] || '',

        username:
          data?.username?.[0] || '',

        role:
          data?.role?.[0] || '',

        phone_number:
          data?.phone_number?.[0] || '',

        citizenship_number:
          data?.citizenship_number?.[0] || '',

        citizenship_front:
          data?.citizenship_front?.[0] || '',

        citizenship_back:
          data?.citizenship_back?.[0] || '',

        pharmacy_license_number:
          data?.pharmacy_license_number?.[0] || '',

        pharmacy_license_document:
          data?.pharmacy_license_document?.[0] || '',

        password:
          data?.password?.[0] || '',

        password2:
          data?.password2?.[0] ||
          data?.confirm_password?.[0] ||
          data?.non_field_errors?.[0] ||
          '',

        general:
          data?.detail ||
          data?.error ||
          data?.non_field_errors?.[0] ||
          (typeof data === 'string'
            ? data
            : '') ||
          'Registration failed. Please check the information you entered.',
      });

    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="register-container">
      <div className="register-card">

        <h1 className="register-title">
          Welcome to Hamro Nepal
        </h1>

        <p className="register-subtitle">
          Create an account to access portal services
        </p>

        <form
          onSubmit={handleRegister}
          className="register-form"
          encType="multipart/form-data"
        >

          {/* ================================================== */}
          {/* SUCCESS MESSAGE */}
          {/* ================================================== */}

          {successMessage && (
            <div className="success-message">
              <span className="success-icon">✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* ================================================== */}
          {/* GENERAL ERROR */}
          {/* ================================================== */}

          {errors.general && (
            <div className="error-message">
              {errors.general}
            </div>
          )}

          {/* ================================================== */}
          {/* EMAIL */}
          {/* ================================================== */}

          <div className="form-group">
            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleFormChange}
              className={
                errors.email
                  ? 'input-error'
                  : ''
              }
            />

            {errors.email && (
              <span className="field-error">
                {errors.email}
              </span>
            )}
          </div>

          {/* ================================================== */}
          {/* USERNAME */}
          {/* ================================================== */}

          <div className="form-group">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              name="username"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleFormChange}
              className={
                errors.username
                  ? 'input-error'
                  : ''
              }
            />

            {errors.username && (
              <span className="field-error">
                {errors.username}
              </span>
            )}
          </div>

          {/* ================================================== */}
          {/* PHONE */}
          {/* ================================================== */}

          <div className="form-group">
            <label htmlFor="phone_number">
              Phone Number
              <span className="optional-label">
                {' '} (Optional)
              </span>
            </label>

            <input
              id="phone_number"
              type="tel"
              name="phone_number"
              placeholder="Enter phone number"
              value={formData.phone_number}
              onChange={handleFormChange}
              className={
                errors.phone_number
                  ? 'input-error'
                  : ''
              }
            />

            {errors.phone_number && (
              <span className="field-error">
                {errors.phone_number}
              </span>
            )}
          </div>

          {/* ================================================== */}
          {/* ROLE */}
          {/* ================================================== */}

          <div className="form-group">
            <label htmlFor="role">
              Account Role
            </label>

            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleRoleChange}
              className={
                errors.role
                  ? 'input-error'
                  : ''
              }
            >
              <option value="patient">
                Patient
              </option>

              <option value="pharmacy">
                Pharmacy
              </option>
            </select>

            {errors.role && (
              <span className="field-error">
                {errors.role}
              </span>
            )}
          </div>

          {/* ================================================== */}
          {/* PATIENT ONLY */}
          {/* ================================================== */}

          {formData.role === 'patient' && (
            <>
              {/* Citizenship Number */}

              <div className="form-group">
                <label htmlFor="citizenship_number">
                  Citizenship Number
                </label>

                <input
                  id="citizenship_number"
                  type="text"
                  name="citizenship_number"
                  placeholder="Enter citizenship number"
                  value={formData.citizenship_number}
                  onChange={handleFormChange}
                  className={
                    errors.citizenship_number
                      ? 'input-error'
                      : ''
                  }
                />

                {errors.citizenship_number && (
                  <span className="field-error">
                    {errors.citizenship_number}
                  </span>
                )}
              </div>

              {/* Citizenship Front */}

              <div className="form-group">
                <label htmlFor="citizenship_front">
                  Citizenship Front Photo
                </label>

                <input
                  id="citizenship_front"
                  type="file"
                  name="citizenship_front"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={
                    errors.citizenship_front
                      ? 'input-error'
                      : ''
                  }
                />

                {formData.citizenship_front && (
                  <small>
                    Selected:{' '}
                    {formData.citizenship_front.name}
                  </small>
                )}

                {errors.citizenship_front && (
                  <span className="field-error">
                    {errors.citizenship_front}
                  </span>
                )}
              </div>

              {/* Citizenship Back */}

              <div className="form-group">
                <label htmlFor="citizenship_back">
                  Citizenship Back Photo
                </label>

                <input
                  id="citizenship_back"
                  type="file"
                  name="citizenship_back"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={
                    errors.citizenship_back
                      ? 'input-error'
                      : ''
                  }
                />

                {formData.citizenship_back && (
                  <small>
                    Selected:{' '}
                    {formData.citizenship_back.name}
                  </small>
                )}

                {errors.citizenship_back && (
                  <span className="field-error">
                    {errors.citizenship_back}
                  </span>
                )}
              </div>
            </>
          )}

          {/* ================================================== */}
          {/* PHARMACY ONLY */}
          {/* ================================================== */}

          {formData.role === 'pharmacy' && (
            <>
              {/* Pharmacy Licence Number */}

              <div className="form-group">
                <label htmlFor="pharmacy_license_number">
                  Pharmacy Licence Number
                </label>

                <input
                  id="pharmacy_license_number"
                  type="text"
                  name="pharmacy_license_number"
                  placeholder="Enter pharmacy licence number"
                  value={
                    formData.pharmacy_license_number
                  }
                  onChange={handleFormChange}
                  className={
                    errors.pharmacy_license_number
                      ? 'input-error'
                      : ''
                  }
                />

                {errors.pharmacy_license_number && (
                  <span className="field-error">
                    {errors.pharmacy_license_number}
                  </span>
                )}
              </div>

              {/* Pharmacy Licence Document */}

              <div className="form-group">
                <label htmlFor="pharmacy_license_document">
                  Pharmacy Licence Document
                </label>

                <input
                  id="pharmacy_license_document"
                  type="file"
                  name="pharmacy_license_document"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className={
                    errors.pharmacy_license_document
                      ? 'input-error'
                      : ''
                  }
                />

                {formData.pharmacy_license_document && (
                  <small>
                    Selected:{' '}
                    {formData.pharmacy_license_document.name}
                  </small>
                )}

                {errors.pharmacy_license_document && (
                  <span className="field-error">
                    {errors.pharmacy_license_document}
                  </span>
                )}
              </div>
            </>
          )}

          {/* ================================================== */}
          {/* PASSWORD */}
          {/* ================================================== */}

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={handleFormChange}
              className={
                errors.password
                  ? 'input-error'
                  : ''
              }
            />

            {errors.password && (
              <span className="field-error">
                {errors.password}
              </span>
            )}
          </div>

          {/* ================================================== */}
          {/* CONFIRM PASSWORD */}
          {/* ================================================== */}

          <div className="form-group">
            <label htmlFor="password2">
              Confirm Password
            </label>

            <input
              id="password2"
              type="password"
              name="password2"
              placeholder="Confirm password"
              value={formData.password2}
              onChange={handleFormChange}
              className={
                errors.password2
                  ? 'input-error'
                  : ''
              }
            />

            {errors.password2 && (
              <span className="field-error">
                {errors.password2}
              </span>
            )}
          </div>

          {/* ================================================== */}
          {/* SUBMIT */}
          {/* ================================================== */}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading2}
          >
            {loading2
              ? 'Submitting Registration...'
              : 'Create Account'}
          </button>

        </form>

        {/* ==================================================== */}
        {/* FOOTER */}
        {/* ==================================================== */}

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


import React, { useState } from "react"
import axiosInstance from "../../axiosInstance"
import "./forgot-password.css"

export default function ForgotPassword() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // STEP 1 — SEND OTP
  const handleSendOTP = async () => {
    setError("")
    setIsLoading(true)
    try {
      const res = await axiosInstance.post("accounts/forgot-password/", { email })
      setMessage(res.data.message || "OTP sent to your email")
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.email || "Failed to send OTP")
    } finally {
      setIsLoading(false)
    }
  }

  // STEP 2 — VERIFY OTP + CHANGE PASSWORD
  const handleResetPassword = async () => {
    setError("")
    setIsLoading(true)
    try {
      const res = await axiosInstance.post("accounts/reset-password/", {
        email,
        otp,
        new_password: newPassword,
      })
      setMessage(res.data.message || "Password changed successfully")
      setStep(3)
    } catch (err) {
      setError("Invalid OTP or error resetting password")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToLogin = () => {
    window.location.href = "/login"
  }

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        {/* HEADER */}
        <div className="forgot-password-header">
          <h1>Reset Password</h1>
          <p className="subtitle">
            {step === 1 && "Enter your email to receive a verification code"}
            {step === 2 && "Verify your code and create a new password"}
            {step === 3 && "Your password has been successfully reset"}
          </p>
        </div>

        {/* PROGRESS INDICATOR */}
        <div className="progress-indicator">
          <div className={`progress-step ${step >= 1 ? "active" : ""}`}>
            <span className="step-number">1</span>
            <span className="step-label">Email</span>
          </div>
          <div className="progress-line" style={{ opacity: step > 1 ? 1 : 0.3 }}></div>
          <div className={`progress-step ${step >= 2 ? "active" : ""}`}>
            <span className="step-number">2</span>
            <span className="step-label">Verify</span>
          </div>
          <div className="progress-line" style={{ opacity: step > 2 ? 1 : 0.3 }}></div>
          <div className={`progress-step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">✓</span>
            <span className="step-label">Done</span>
          </div>
        </div>

        {/* MESSAGES */}
        {message && <div className="message success-message">{message}</div>}
        {error && <div className="message error-message">{error}</div>}

        {/* STEP 1 — EMAIL */}
        {step === 1 && (
          <div className="form-section fade-in">
            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>
            <button
              onClick={handleSendOTP}
              disabled={isLoading || !email}
              className="primary-button"
            >
              {isLoading ? "Sending..." : "Send Verification Code"}
            </button>
          </div>
        )}

        {/* STEP 2 — OTP + NEW PASSWORD */}
        {step === 2 && (
          <div className="form-section fade-in">
            <div className="input-group">
              <label htmlFor="otp">Verification Code</label>
              <input
                id="otp"
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="form-input"
                maxLength="6"
              />
              <p className="input-hint">Enter the 6-digit code sent to your email</p>
            </div>

            <div className="input-group">
              <label htmlFor="password">New Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
              />
              <p className="input-hint">Password must be at least 8 characters</p>
            </div>

            <button
              onClick={handleResetPassword}
              disabled={isLoading || !otp || !newPassword}
              className="primary-button"
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        )}

        {/* STEP 3 — SUCCESS */}
        {step === 3 && (
          <div className="form-section success-section fade-in">
            <div className="success-icon">✓</div>
            <h2>Password Reset Successful</h2>
            <p>Your password has been updated. You can now log in with your new password.</p>
            <button onClick={handleBackToLogin} className="primary-button">
              Return to Login
            </button>
          </div>
        )}

        {/* BACK TO LOGIN LINK */}
        {step < 3 && (
          <div className="back-to-login">
            <a href="/login">Back to Login</a>
          </div>
        )}
      </div>

      {/* DECORATIVE ELEMENT */}
      <div className="decoration"></div>
    </div>
  )
}

"use client"

import React, { useEffect, useState } from "react"
import { useFormik } from "formik"
import * as Yup from "yup"
import { Form, Input, Button, Checkbox, message } from "antd"
import {
  MailOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  BookOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import "./Login.css"

const disasterStories = [
  {
    image:
      "https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=1600&auto=format&fit=crop",
    eyebrow: "Climate report",
    title: "When the water rises, communities rise too.",
    description:
      "Discover reports, share what you see, and help Nepal prepare for what comes next.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1547036967-23d11aacaee0?q=80&w=1600&auto=format&fit=crop",
    eyebrow: "Earthquake watch",
    title: "Prepared communities recover faster.",
    description:
      "Turn local observations into useful action with stories from people on the ground.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1500534623283-312aade485b7?q=80&w=1600&auto=format&fit=crop",
    eyebrow: "Landslide report",
    title: "Every warning can protect a neighbor.",
    description:
      "Read, learn, and contribute reports that make Nepal safer for everyone.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=1600&auto=format&fit=crop",
    eyebrow: "Resilience stories",
    title: "Small contributions create lasting change.",
    description:
      "Join a growing network documenting disasters and solutions across Nepal.",
  },
]

const Login = () => {
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [activeStory, setActiveStory] = useState(0)

  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStory((current) => (current + 1) % disasterStories.length)
    }, 5500)

    return () => window.clearInterval(timer)
  }, [])

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },

    validationSchema: Yup.object({
      email: Yup.string()
        .email("Invalid email")
        .required("Email is required"),

      password: Yup.string()
        .min(4, "Password must be at least 4 characters")
        .required("Password is required"),
    }),

    onSubmit: async (values) => {
      setLoading(true)

      try {
        const result = await login(values.email, values.password)

        if (!result.success) {
          message.error(result.error)
          return
        }

        const loggedInUser = result.user

        if (!loggedInUser) {
          message.error("Failed to fetch user data")
          return
        }

        message.success("Login successful!")

        const role = (
          loggedInUser.role ||
          loggedInUser.Role ||
          "citizen"
        )
          .toString()
          .toLowerCase()

        if (["admin", "organizer", "employee"].includes(role)) {
          navigate("/dashboard", { replace: true })
        } else if (["citizen", "user"].includes(role)) {
          navigate("/user-dashboard", { replace: true })
        } else {
          navigate("/", { replace: true })
        }
      } catch (error) {
        console.error(error)
        message.error("Invalid email or password")
      } finally {
        setLoading(false)
      }
    },
  })

  const getFieldStatus = (field) =>
    formik.touched[field] && formik.errors[field] ? "error" : undefined

  const story = disasterStories[activeStory]

  return (
    <main className="login-page">
      <section className="login-left">
        <div className="login-form-container">
          <div className="login-brand">
            <div className="login-logo">
              <BookOutlined />
            </div>

            <h2 className="login-brand-name">
              Hamro <span>Nepal</span>
            </h2>
          </div>

          <div className="login-heading">
            <p className="login-kicker">Welcome back</p>

            <h1 className="login-title">
              Log in to make a difference.
            </h1>

            <p className="login-subtitle">
              Sign in to manage your Hamro Nepal account and stay connected
              to your community.
            </p>
          </div>

          <Form
            layout="vertical"
            onFinish={formik.handleSubmit}
            className="login-form"
          >
            <Form.Item
              label={
                <span className="login-label">
                  Email address
                </span>
              }
              validateStatus={getFieldStatus("email")}
              help={
                formik.touched.email && formik.errors.email
              }
            >
              <Input
                name="email"
                placeholder="you@example.com"
                prefix={
                  <MailOutlined className="login-input-icon" />
                }
                size="large"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              label={
                <span className="login-label">
                  Password
                </span>
              }
              validateStatus={getFieldStatus("password")}
              help={
                formik.touched.password && formik.errors.password
              }
            >
              <Input.Password
                name="password"
                placeholder="Enter your password"
                prefix={
                  <LockOutlined className="login-input-icon" />
                }
                size="large"
                iconRender={(visible) =>
                  visible ? (
                    <EyeTwoTone />
                  ) : (
                    <EyeInvisibleOutlined />
                  )
                }
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="login-input"
              />
            </Form.Item>

            <div className="login-options">
              <Checkbox
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                className="login-checkbox"
              >
                Remember me
              </Checkbox>

              <Link
                to="/forgot-password"
                className="login-forgot"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              className="login-submit-btn"
            >
              Sign in
              <ArrowRightOutlined />
            </Button>

            <div className="login-signup-link">
              <span>Don&apos;t have an account? </span>

              <Link to="/Signup" className="login-link">
                Sign up
              </Link>
            </div>
          </Form>
        </div>
      </section>

      <section
        className="login-right"
        aria-label="Hamro Nepal stories"
      >
        {disasterStories.map((item, index) => (
          <img
            key={item.image}
            src={item.image}
            alt={`${item.eyebrow} in Nepal`}
            className={`login-hero-image ${
              index === activeStory ? "is-active" : ""
            }`}
          />
        ))}

        <div className="login-image-overlay" />

        <div className="login-image-content">
          <div className="login-story-eyebrow">
            <span className="login-live-dot" />
            {story.eyebrow}
          </div>

          <h2 className="login-image-title">
            {story.title}
          </h2>

          <p className="login-image-text">
            {story.description}
          </p>

          <div className="login-image-footer">
            <div className="login-image-stats">
              <div className="login-stat">
                <span className="login-stat-number">
                  50K+
                </span>
                <span className="login-stat-label">
                  Readers
                </span>
              </div>

              <div className="login-stat-divider" />

              <div className="login-stat">
                <span className="login-stat-number">
                  10K+
                </span>
                <span className="login-stat-label">
                  Members
                </span>
              </div>

              <div className="login-stat-divider" />

              <div className="login-stat">
                <span className="login-stat-number">
                  500+
                </span>
                <span className="login-stat-label">
                  Reports
                </span>
              </div>
            </div>

            <div
              className="login-story-dots"
              aria-label="Story selector"
            >
              {disasterStories.map((item, index) => (
                <button
                  type="button"
                  key={item.eyebrow}
                  aria-label={`Show ${item.eyebrow}`}
                  className={
                    index === activeStory ? "is-active" : ""
                  }
                  onClick={() => setActiveStory(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Login
import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../axiosInstance";
import Header from "../pages/Header/Header";
import Footer from "../pages/Footer/Footer";
import "./Dashboard.css";

const UserDashboard = () => {
  // =========================================================
  // DASHBOARD DATA
  // =========================================================

  const [userInfo, setUserInfo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [myReports, setMyReports] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =========================================================
  // FORM
  // =========================================================

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    severity: "medium",
    location: "",
    latitude: "",
    longitude: "",
    description: "",
    image: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState(null);

  // =========================================================
  // EDITING
  // =========================================================

  const [editingReport, setEditingReport] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // =========================================================
  // GPS
  // =========================================================

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  // Lets the user type a location manually if GPS is denied/unavailable
  const [manualLocation, setManualLocation] = useState(false);

  const watchIdRef = useRef(null);

  // Prevents React 18 StrictMode's mount->unmount->remount dev cycle
  // from starting the geolocation watch twice in rapid succession,
  // which can make some browsers falsely report permission as blocked.
  const gpsInitializedRef = useRef(false);

  // Guards against a slower/older reverse-geocode response overwriting
  // a newer one (relevant if you ever go back to continuous watchPosition).
  const geocodeRequestIdRef = useRef(0);
  const lastGeocodeRef = useRef({ time: 0, lat: null, lng: null });

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    fetchDashboardData();

    if (!gpsInitializedRef.current) {
      gpsInitializedRef.current = true;
      startGPSTracking();
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Safety net: if GPS detection hangs (some devices never fire either
  // callback reliably), don't leave the Submit button disabled forever.
  useEffect(() => {
    if (!gpsLoading) return;

    const timeout = setTimeout(() => {
      setGpsLoading(false);
      setGpsError(
        "Location detection is taking longer than expected. Click Refresh GPS, or enter your location manually below."
      );
    }, 15000);

    return () => clearTimeout(timeout);
  }, [gpsLoading]);

  // =========================================================
  // FETCH DASHBOARD DATA
  // =========================================================

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [profileRes, categoriesRes, reportsRes] = await Promise.all([
        axiosInstance.get("/accounts/profile/"),
        axiosInstance.get("/problem/categories/"),
        axiosInstance.get("/problem/reports/my/"),
      ]);

      const categoryData = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : categoriesRes.data.results || [];

      const reportsData = Array.isArray(reportsRes.data)
        ? reportsRes.data
        : reportsRes.data.results || [];

      setUserInfo(profileRes.data);
      setCategories(categoryData);
      setMyReports(reportsData);

      if (categoryData.length > 0) {
        setFormData((prev) => ({
          ...prev,
          category: categoryData[0].id,
        }));
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Unable to load profile data and problem reports.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // REVERSE GEOCODING
  //
  // Converts latitude + longitude into a human-readable address
  // (e.g. Kathmandu, Ward, Municipality, etc.)
  //
  // BigDataCloud's client-side reverse geocoder does not require
  // an API key for this use.
  // =========================================================

  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (!response.ok) {
        throw new Error("Reverse geocoding failed.");
      }

      const data = await response.json();

      console.log("Reverse geocoding response:", data);

      // =====================================================
      // Build readable address
      // =====================================================

      const addressParts = [];

      if (data.locality) {
        addressParts.push(data.locality);
      }

      if (data.city && data.city !== data.locality) {
        addressParts.push(data.city);
      }

      if (data.principalSubdivision) {
        addressParts.push(data.principalSubdivision);
      }

      if (data.countryName) {
        addressParts.push(data.countryName);
      }

      let address = addressParts.join(", ");

      // =====================================================
      // If above doesn't produce a useful address,
      // use localityInfo
      // =====================================================

      if (!address && data.localityInfo) {
        const administrative = data.localityInfo?.administrative;

        if (Array.isArray(administrative)) {
          const names = administrative
            .map((item) => item.name)
            .filter(Boolean);

          address = names.join(", ");
        }
      }

      // =====================================================
      // Add postcode if available
      // =====================================================

      if (data.postcode && address) {
        address += ` ${data.postcode}`;
      }

      // =====================================================
      // Final fallback
      // =====================================================

      if (!address) {
        address = `GPS Location (${latitude}, ${longitude})`;
      }

      return address;
    } catch (err) {
      console.error("Reverse geocoding error:", err);
      return `GPS Location (${latitude}, ${longitude})`;
    }
  };

  // =========================================================
  // DISTANCE HELPER (used to avoid redundant re-geocoding)
  // =========================================================

  const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // =========================================================
  // UPDATE LOCATION
  // =========================================================

  const updateGPSLocation = async (position) => {
    const { latitude, longitude, accuracy } = position.coords;

    const formattedLatitude = latitude.toFixed(6);
    const formattedLongitude = longitude.toFixed(6);

    console.log("GPS Location:", formattedLatitude, formattedLongitude);

    setGpsAccuracy(Math.round(accuracy));

    // Immediately update coordinates
    setFormData((prev) => ({
      ...prev,
      latitude: formattedLatitude,
      longitude: formattedLongitude,
    }));

    setGpsActive(true);
    setGpsLoading(false);
    setGpsError(null);

    // =======================================================
    // Only re-geocode if we've moved meaningfully or enough
    // time has passed. Prevents redundant/overlapping API calls
    // if this ever fires multiple times in quick succession.
    // =======================================================

    const last = lastGeocodeRef.current;
    const movedEnough =
      last.lat == null ||
      distanceMeters(latitude, longitude, last.lat, last.lng) > 25;
    const timeEnough = Date.now() - last.time > 10000;

    if (!movedEnough && !timeEnough) {
      return;
    }

    lastGeocodeRef.current = { time: Date.now(), lat: latitude, lng: longitude };
    const requestId = ++geocodeRequestIdRef.current;

    const address = await getAddressFromCoordinates(latitude, longitude);

    // Ignore this result if a newer GPS update has already superseded it
    if (requestId !== geocodeRequestIdRef.current) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      latitude: formattedLatitude,
      longitude: formattedLongitude,
      location: manualLocation ? prev.location : address,
    }));
  };

  // =========================================================
  // START GPS TRACKING
  //
  // Uses a single getCurrentPosition() call rather than a
  // continuous watchPosition() stream. A civic-report form only
  // needs one accurate snapshot, and continuous high-accuracy
  // watching can cause some browsers/OSes to throttle or
  // defensively revoke location access.
  // =========================================================

  const startGPSTracking = () => {
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsActive(false);
      setGpsLoading(false);
      setGpsError("GPS/location services are not supported by this browser.");
      return;
    }

    // =======================================================
    // HTTPS CHECK
    // =======================================================

    if (window.isSecureContext === false) {
      setGpsActive(false);
      setGpsLoading(false);
      setGpsError(
        "GPS requires HTTPS or localhost. Please open the application using HTTPS."
      );
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await updateGPSLocation(position);
      },

      (error) => {
        console.error("GPS error:", error.code, error.message);

        setGpsLoading(false);
        setGpsActive(false);

        if (error.code === error.PERMISSION_DENIED) {
          setGpsError(
            "Location permission was denied. Please allow location access in your browser settings, or enter your location manually below."
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGpsError(
            "Your device could not determine your location. Please enable GPS/location services."
          );
        } else if (error.code === error.TIMEOUT) {
          setGpsError("GPS request timed out. Click Refresh GPS and try again.");
        } else {
          setGpsError("Unable to determine your current location.");
        }
      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );
  };

  // =========================================================
  // REFRESH GPS (manual retry button)
  // =========================================================

  const refreshGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("GPS is not supported by this browser.");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await updateGPSLocation(position);
      },

      (error) => {
        console.error("GPS refresh error:", error);

        setGpsLoading(false);
        setGpsActive(false);

        if (error.code === error.PERMISSION_DENIED) {
          setGpsError(
            "Location permission was denied. Please allow location access and try again, or enter your location manually below."
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGpsError("Your location is currently unavailable.");
        } else if (error.code === error.TIMEOUT) {
          setGpsError("GPS request timed out.");
        } else {
          setGpsError("Unable to refresh your location.");
        }
      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );
  };

  // =========================================================
  // INPUT CHANGE
  // =========================================================

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================================================
  // FILE CHANGE
  // =========================================================

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({
        ...prev,
        image: e.target.files[0],
      }));
    }
  };

  // =========================================================
  // RESET FORM
  // =========================================================

  const resetForm = () => {
    setFormData((prev) => ({
      title: "",
      category: categories.length > 0 ? categories[0].id : "",
      severity: "medium",

      // Keep live GPS/manual location
      location: prev.location,
      latitude: prev.latitude,
      longitude: prev.longitude,

      description: "",
      image: null,
    }));

    setEditingReport(null);
    setIsEditing(false);
    setFormError(null);
  };

  // =========================================================
  // CREATE REPORT
  // =========================================================

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    // =======================================================
    // LOCATION REQUIRED (GPS or manual)
    // =======================================================

    if (!formData.location) {
      setFormError(
        "Please wait for GPS to detect your location, or enter it manually."
      );
      setIsSubmitting(false);
      return;
    }

    const payload = new FormData();

    payload.append("title", formData.title);
    payload.append("category", formData.category);
    payload.append("severity", formData.severity);
    payload.append("location", formData.location);

    if (formData.latitude) {
      payload.append("latitude", parseFloat(formData.latitude).toFixed(6));
    }

    if (formData.longitude) {
      payload.append("longitude", parseFloat(formData.longitude).toFixed(6));
    }

    payload.append("description", formData.description);

    if (formData.image instanceof File) {
      payload.append("image", formData.image);
    }

    try {
      const response = await axiosInstance.post("/problem/reports/", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMyReports((prev) => [response.data, ...prev]);
      setFormSuccess(true);

      // Clear report fields but KEEP location
      setFormData((prev) => ({
        title: "",
        category: categories.length > 0 ? categories[0].id : "",
        severity: "medium",
        location: prev.location,
        latitude: prev.latitude,
        longitude: prev.longitude,
        description: "",
        image: null,
      }));

      setTimeout(() => {
        setFormSuccess(false);
      }, 4000);
    } catch (err) {
      console.error("Submission error:", err.response?.data);
      handleAPIError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // EDIT REPORT
  // =========================================================

  const handleEditReport = (report) => {
    // =======================================================
    // Only pending reports can be edited
    // =======================================================

    if (report.status !== "pending") {
      setFormError(
        "This report can no longer be edited because it has already been processed."
      );
      return;
    }

    setEditingReport(report);
    setIsEditing(true);
    setFormError(null);
    setFormSuccess(false);

    setFormData({
      title: report.title || "",
      category: report.category || "",
      severity: report.severity || "medium",

      /*
       * Use current GPS if available.
       * Otherwise use the original location.
       */
      location: formData.location || report.location || "",
      latitude: formData.latitude || report.latitude || "",
      longitude: formData.longitude || report.longitude || "",

      description: report.description || "",
      image: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // =========================================================
  // UPDATE REPORT
  // =========================================================

  const handleUpdateReport = async (e) => {
    e.preventDefault();

    if (!editingReport) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    if (!formData.location) {
      setFormError(
        "Please wait for GPS to detect your location, or enter it manually."
      );
      setIsSubmitting(false);
      return;
    }

    const payload = new FormData();

    payload.append("title", formData.title);
    payload.append("category", formData.category);
    payload.append("severity", formData.severity);
    payload.append("location", formData.location);

    if (formData.latitude) {
      payload.append("latitude", parseFloat(formData.latitude).toFixed(6));
    }

    if (formData.longitude) {
      payload.append("longitude", parseFloat(formData.longitude).toFixed(6));
    }

    payload.append("description", formData.description);

    if (formData.image instanceof File) {
      payload.append("image", formData.image);
    }

    try {
      const response = await axiosInstance.patch(
        `/problem/reports/${editingReport.id}/`,
        payload,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setMyReports((prev) =>
        prev.map((report) =>
          report.id === editingReport.id ? response.data : report
        )
      );

      setFormSuccess(true);
      setIsEditing(false);
      setEditingReport(null);

      setFormData((prev) => ({
        title: "",
        category: categories.length > 0 ? categories[0].id : "",
        severity: "medium",
        location: prev.location,
        latitude: prev.latitude,
        longitude: prev.longitude,
        description: "",
        image: null,
      }));

      setTimeout(() => {
        setFormSuccess(false);
      }, 4000);
    } catch (err) {
      console.error("Update error:", err.response?.data);
      handleAPIError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // API ERROR
  // =========================================================

  const handleAPIError = (err) => {
    const errorData = err.response?.data;

    if (err.response?.status === 403) {
      setFormError(
        "You are not allowed to edit this report. Only the original submitter can edit it."
      );
      return;
    }

    if (err.response?.status === 404) {
      setFormError("The report could not be found.");
      return;
    }

    if (errorData && typeof errorData === "object") {
      const messages = Object.entries(errorData).map(
        ([field, msgs]) =>
          `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`
      );

      setFormError(messages.join(" | "));
    } else {
      setFormError("Failed to save report. Please try again.");
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return <div className="gov-loader">Loading Municipal Portal...</div>;
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="gov-dashboard-wrapper">
      <Header />

      {/* =====================================================
          HERO
      ===================================================== */}

      <div className="gov-hero-section">
        <img
          src="https://images.unsplash.com/photo-1763809677492-b5b23388badc?q=80&w=1274&auto=format&fit=crop"
          alt="Modern city buildings representing a smart city"
          className="gov-hero-image"
        />

        <div className="gov-hero-image-overlay"></div>

        <div className="hero-overlay-content">
          <div className="hero-text-block">
            <h1>All City in Your Hand</h1>
            <p>
              Empowering citizens to build a smarter, safer community
              together.
            </p>
          </div>

          <div className="hero-user-badge">
            <span className="user-greeting">
              Welcome, {userInfo?.username || "Citizen"}
            </span>

            {userInfo?.citizenship_number && (
              <span className="citizen-id-chip">
                ID: {userInfo.citizenship_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div className="gov-main-container">
        {error && <div className="gov-alert error">{error}</div>}

        <div className="dashboard-content-grid">
          {/* =================================================
              REPORT FORM
          ================================================= */}

          <div className="content-card">
            <div className="card-heading">
              <h3>
                {isEditing ? "Edit Your Civic Report" : "Report a Civic Issue"}
              </h3>

              <p>
                {isEditing
                  ? `Editing report #${editingReport?.id}`
                  : "Submit incidents, road problems, or infrastructure feedback directly."}
              </p>
            </div>

            {/* SUCCESS */}

            {formSuccess && (
              <div className="gov-alert success">
                ✓{" "}
                {isEditing
                  ? "Report updated successfully."
                  : "Report submitted successfully."}
              </div>
            )}

            {/* ERROR */}

            {formError && <div className="gov-alert error">{formError}</div>}

            {/* =================================================
                GPS STATUS
            ================================================= */}

            <div
              style={{
                padding: "15px",
                marginBottom: "20px",
                borderRadius: "8px",
                backgroundColor: gpsActive ? "#e8f5e9" : "#fff3cd",
                border: gpsActive ? "1px solid #81c784" : "1px solid #ffe082",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "15px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>
                    {gpsLoading
                      ? "📡 Detecting your location..."
                      : gpsActive
                      ? "📍 GPS Location Active"
                      : "⚠ GPS Location Unavailable"}
                  </strong>

                  {gpsAccuracy && (
                    <div style={{ marginTop: "5px", fontSize: "12px" }}>
                      GPS accuracy: approximately {gpsAccuracy} meters
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={refreshGPS}
                  disabled={gpsLoading}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    cursor: gpsLoading ? "not-allowed" : "pointer",
                    background: "#fff",
                  }}
                >
                  {gpsLoading ? "Locating..." : "Refresh GPS"}
                </button>
              </div>

              {/* LOCATION */}

              {formData.location && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    background: "#fff",
                    borderRadius: "6px",
                  }}
                >
                  <strong>📍 Current Location</strong>
                  <div style={{ marginTop: "5px", fontSize: "14px" }}>
                    {formData.location}
                  </div>
                </div>
              )}

              {/* COORDINATES */}

              {formData.latitude && formData.longitude && (
                <div style={{ marginTop: "10px", fontSize: "13px" }}>
                  🌐 Latitude: {formData.latitude}
                  <br />
                  🌐 Longitude: {formData.longitude}
                </div>
              )}

              {/* GPS ERROR + MANUAL FALLBACK */}

              {gpsError && (
                <div style={{ marginTop: "10px" }}>
                  <div style={{ color: "#b71c1c", fontSize: "13px" }}>
                    {gpsError}
                  </div>

                  {!manualLocation && (
                    <button
                      type="button"
                      onClick={() => setManualLocation(true)}
                      style={{
                        marginTop: "8px",
                        fontSize: "13px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Enter location manually instead
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* =================================================
                FORM
            ================================================= */}

            <form
              onSubmit={isEditing ? handleUpdateReport : handleFormSubmit}
              className="gov-clean-form"
            >
              {/* TITLE */}

              <div className="form-group">
                <label>Issue Title *</label>

                <input
                  type="text"
                  name="title"
                  placeholder="e.g., Broken streetlight near main junction"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* CATEGORY / SEVERITY */}

              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>

                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="" disabled>
                      -- Select Category --
                    </option>

                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Severity Level</label>

                  <select
                    name="severity"
                    value={formData.severity}
                    onChange={handleInputChange}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* =================================================
                  LOCATION - AUTOMATIC OR MANUAL
              ================================================= */}

              <div className="form-group">
                <label>📍 Location / Ward Address</label>

                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder={
                    gpsLoading
                      ? "Detecting location..."
                      : manualLocation
                      ? "Type your address or ward here"
                      : "GPS location will appear here"
                  }
                  readOnly={!manualLocation}
                  required
                  style={{
                    background: manualLocation ? "#fff" : "#f5f5f5",
                    cursor: manualLocation ? "text" : "not-allowed",
                  }}
                />

                <small style={{ display: "block", marginTop: "5px", color: "#666" }}>
                  {manualLocation
                    ? "Entering location manually. Click Refresh GPS above to try automatic detection again."
                    : "This address is automatically generated from your GPS location."}
                </small>
              </div>

              {/* =================================================
                  LATITUDE / LONGITUDE
              ================================================= */}

              <div className="form-row">
                <div className="form-group">
                  <label>Latitude</label>

                  <input
                    type="text"
                    value={formData.latitude}
                    placeholder="Auto-detected GPS"
                    readOnly
                    style={{ background: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>

                <div className="form-group">
                  <label>Longitude</label>

                  <input
                    type="text"
                    value={formData.longitude}
                    placeholder="Auto-detected GPS"
                    readOnly
                    style={{ background: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>
              </div>

              {/* DESCRIPTION */}

              <div className="form-group">
                <label>Description *</label>

                <textarea
                  name="description"
                  rows="3"
                  placeholder="Provide precise details about the problem..."
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* IMAGE */}

              <div className="form-group">
                <label>{isEditing ? "Replace Photo" : "Upload Photo"}</label>

                <input type="file" accept="image/*" onChange={handleFileChange} />
              </div>

              {/* BUTTONS */}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="btn-primary-green"
                  disabled={isSubmitting || gpsLoading || !formData.location}
                >
                  {isSubmitting
                    ? isEditing
                      ? "Updating..."
                      : "Submitting..."
                    : isEditing
                    ? "Update Report"
                    : "Submit Report"}
                </button>

                {isEditing && (
                  <button type="button" onClick={resetForm} disabled={isSubmitting}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* =================================================
              MY REPORTS
          ================================================= */}

          <div className="content-card">
            <div className="card-heading">
              <h3>My Submitted Reports ({myReports.length})</h3>

              <p>
                Track progress status of your active municipal service
                requests.
              </p>
            </div>

            <div className="reports-feed">
              {myReports.length === 0 ? (
                <div className="empty-feed-state">
                  <p className="empty-title">No Service Tickets Found</p>
                  <p className="empty-desc">
                    You haven't submitted any civic requests yet.
                  </p>
                </div>
              ) : (
                myReports.map((report) => (
                  <div key={report.id} className="report-list-item">
                    <div className="item-top-row">
                      <span className="item-category">
                        {report.category_name || "General"}
                      </span>

                      <span className={`item-status status-${report.status}`}>
                        {report.status}
                      </span>
                    </div>

                    <h4>{report.title}</h4>

                    <p className="item-desc">{report.description}</p>

                    <div className="item-meta">
                      <span>📍 {report.location}</span>

                      {report.latitude && report.longitude && (
                        <span>
                          🌐 {report.latitude}, {report.longitude}
                        </span>
                      )}

                      <span>
                        📅 {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* EDIT BUTTON */}

                    <div style={{ marginTop: "15px" }}>
                      {report.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => handleEditReport(report)}
                          disabled={isSubmitting}
                        >
                          ✏️ Edit Report
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          style={{ opacity: 0.6, cursor: "not-allowed" }}
                        >
                          🔒 Editing Locked
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default UserDashboard;
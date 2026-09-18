import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, FileUp, RotateCcw, Upload } from "lucide-react";
import Webcam from "react-webcam";
import axiosInstance from "../../axiosInstance";
import "./CameraCapturePage.css";

export default function CameraCapturePage() {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({ title: "", category: "", severity: "medium", location: "", description: "", image: null });
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const webcamRef = useRef(null);

  useEffect(() => {
    axiosInstance.get("/problem/categories/")
      .then(({ data }) => {
        const values = Array.isArray(data) ? data : data?.results || [];
        setCategories(values);
        if (values.length) setFormData((current) => ({ ...current, category: values[0].id }));
      })
      .catch(() => setError("Unable to load report categories."))
      .finally(() => setLoadingCategories(false));
  }, []);

  const handleChange = (event) => setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  const handleFileChange = (event) => setFormData((current) => ({ ...current, image: event.target.files?.[0] || null }));

  const capturePhoto = () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      setCameraError("The camera did not return an image. Please try again.");
      return;
    }

    fetch(screenshot)
      .then((response) => response.blob())
      .then((blob) => {
        const file = new File([blob], `report-${Date.now()}.jpg`, { type: "image/jpeg" });
        setFormData((current) => ({ ...current, image: file }));
        setPreviewUrl(screenshot);
        setCameraOpen(false);
        setCameraError("");
      })
      .catch(() => setCameraError("Unable to save the captured photo."));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");
    const payload = new FormData();
    Object.entries(formData).forEach(([key, value]) => { if (value) payload.append(key, value); });

    try {
      await axiosInstance.post("/problem/reports/", payload, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage("Report uploaded successfully. You can find it in Report Vault.");
      setFormData((current) => ({ ...current, title: "", description: "", image: null }));
      event.target.reset();
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(data && typeof data === "object"
        ? Object.entries(data).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : value}`).join(" | ")
        : "Upload failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="capture-page">
      <header className="capture-page__header"><div className="capture-page__icon"><Camera size={25} /></div><div><p className="capture-page__eyebrow">Medical records</p><h1>Scan report</h1><p>Capture a prescription or upload a report to save it in your vault.</p></div></header>
      {message && <div className="capture-alert capture-alert--success" role="status"><CheckCircle2 size={17} />{message}</div>}
      {error && <div className="capture-alert capture-alert--error" role="alert">{error}</div>}
      <form className="capture-form" onSubmit={handleSubmit}>
        <div className="capture-camera-section">
          <div className="capture-camera-section__heading"><strong>Take a photo</strong><span>Use your device camera to capture the report.</span></div>
          {!cameraOpen && !previewUrl && <button className="capture-camera-button" type="button" onClick={() => { setCameraOpen(true); setCameraError(""); }}><Camera size={18} />Click photo</button>}
          {cameraOpen && <div className="capture-camera"><Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: { ideal: "environment" } }} onUserMediaError={() => setCameraError("Camera access was blocked. Allow camera access or upload a file instead.")} /><div className="capture-camera__actions"><button className="capture-submit" type="button" onClick={capturePhoto}><Camera size={17} />Capture photo</button><button className="capture-secondary" type="button" onClick={() => setCameraOpen(false)}>Cancel</button></div></div>}
          {previewUrl && <div className="capture-preview"><img src={previewUrl} alt="Captured report preview" /><button className="capture-secondary" type="button" onClick={() => { setPreviewUrl(""); setFormData((current) => ({ ...current, image: null })); setCameraOpen(true); }}><RotateCcw size={16} />Retake</button></div>}
          {cameraError && <p className="capture-camera-error" role="alert">{cameraError}</p>}
        </div>
        <label>Report title *<input name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Blood test results" required /></label>
        <div className="capture-form__row"><label>Category *<select name="category" value={formData.category} onChange={handleChange} required disabled={loadingCategories}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Severity<select name="severity" value={formData.severity} onChange={handleChange}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
        <label>Location<input name="location" value={formData.location} onChange={handleChange} placeholder="Clinic or hospital name" /></label>
        <label>Description<textarea name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="Add any useful context" required /></label>
        <label className="capture-file"><span><FileUp size={20} />{formData.image ? formData.image.name : "Choose a report image or PDF"}</span><input type="file" name="image" accept="image/*,.pdf" capture="environment" onChange={handleFileChange} required /></label>
        <button className="capture-submit" type="submit" disabled={isSubmitting || loadingCategories}><Upload size={17} />{isSubmitting ? "Uploading..." : "Upload to report vault"}</button>
      </form>
    </section>
  );
}
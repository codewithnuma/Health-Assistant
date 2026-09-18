import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import {
  Camera,
  Upload,
  RefreshCw,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  FlipHorizontal,
  Info,
  Loader2,
  CloudUpload,
} from 'lucide-react';
import axiosInstance from '../../axiosInstance';
import styles from './CameraCapture.module.css';

// ============================================================
// ⚙️  BACKEND TEAM: Update this endpoint when ready.
//    Expected: POST multipart/form-data
//    Field name: "file"  (or whatever the backend expects)
//    Response:  { id, name, url, created_at, ... }
// ============================================================
const UPLOAD_ENDPOINT = '/reports/upload/';

// Helper: Convert Base64 data URL to binary Blob
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export default function CameraCapturePage() {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Active mode: 'camera' or 'upload'
  const [activeTab, setActiveTab] = useState('camera');

  // State to hold the captured/uploaded image preview (Base64 or object URL)
  const [imageSrc, setImageSrc] = useState(null);

  // File metadata (for both image and PDF)
  const [fileDetails, setFileDetails] = useState(null);

  // Camera settings & status
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState(null);

  // Upload to backend states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);   // true once saved to vault
  const [uploadError, setUploadError] = useState(null);         // error message string

  // Video constraints for react-webcam
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode,
  };

  // Switch between front and rear cameras
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo from webcam
  const handleSnapPhoto = useCallback(() => {
    if (!webcamRef.current) return;

    try {
      const screenshot = webcamRef.current.getScreenshot({ width: 1920, height: 1080 });
      if (!screenshot) {
        alert('Could not capture frame. Please ensure camera is active.');
        return;
      }

      const blob = dataURLtoBlob(screenshot);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `medical_report_${timestamp}.jpg`;

      setImageSrc(screenshot);
      setFileDetails({ name: filename, size: (blob.size / 1024).toFixed(1) + ' KB', type: 'image/jpeg', blob });
      setUploadSuccess(false);
      setUploadError(null);
    } catch (err) {
      console.error('Snapshot failed:', err);
      alert('Failed to capture photo. Please try again or use the file upload fallback.');
    }
  }, [webcamRef]);

  // Handle manual file selection (Images or PDFs)
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      setImageSrc(null);
      setFileDetails({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', type: 'application/pdf', file });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result);
        setFileDetails({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', type: file.type || 'image/jpeg', blob: file });
      };
      reader.readAsDataURL(file);
    }

    setUploadSuccess(false);
    setUploadError(null);
    event.target.value = '';
  };

  // Retake or Remove
  const handleReset = () => {
    setImageSrc(null);
    setFileDetails(null);
    setUploadSuccess(false);
    setUploadError(null);
  };

  // Download local copy
  const handleDownload = () => {
    if (!imageSrc && !fileDetails?.file) return;
    const link = document.createElement('a');
    if (imageSrc) {
      link.href = imageSrc;
      link.download = fileDetails?.name || 'medical_report.jpg';
    } else if (fileDetails?.file) {
      link.href = URL.createObjectURL(fileDetails.file);
      link.download = fileDetails.name;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============================================================
  // Save to Report Vault  →  POST to backend via axiosInstance
  // ============================================================
  const handleSaveToVault = async () => {
    if (!fileDetails) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Build multipart/form-data payload
      const formData = new FormData();

      if (fileDetails.blob) {
        // Camera snapshot (Blob) or uploaded image (File)
        formData.append('file', fileDetails.blob, fileDetails.name);
      } else if (fileDetails.file) {
        // PDF file
        formData.append('file', fileDetails.file, fileDetails.name);
      }

      // ⚙️  BACKEND TEAM: If your endpoint expects additional fields
      //    (e.g. title, category, patient_id), add them here:
      // formData.append('title', fileDetails.name);
      // formData.append('category', 'lab_report');

      const response = await axiosInstance.post(UPLOAD_ENDPOINT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Upload response:', response.data);
      setUploadSuccess(true);
    } catch (err) {
      console.error('Upload error:', err);

      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        'Upload failed. Please check your connection and try again.';

      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const hasDocument = Boolean(imageSrc || fileDetails);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Document Scanner & Upload</h1>
        <p className={styles.subtitle}>
          Capture prescriptions and lab reports clearly using your camera, or upload existing image / PDF documents.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      {!hasDocument && (
        <div className={styles.tabGroup}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'camera' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            <Camera size={16} />
            <span>Camera Scanner</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={16} />
            <span>Upload File</span>
          </button>
        </div>
      )}

      {/* Main Content Card */}
      <div className={styles.card}>
        {/* =========================================================
            STATE 1: PREVIEW MODE (Photo captured or file selected)
           ========================================================= */}
        {hasDocument ? (
          <div>
            <div className={styles.viewportContainer}>
              {imageSrc ? (
                <img src={imageSrc} alt="Captured Document Preview" className={styles.previewImage} />
              ) : (
                <div className={styles.pdfPreview}>
                  <FileText size={64} className={styles.pdfIcon} />
                  <span className={styles.pdfName}>{fileDetails?.name}</span>
                  <span className={styles.pdfSize}>{fileDetails?.size} • Portable Document Format (PDF)</span>
                </div>
              )}
            </div>

            {/* Quality check reminder (alert red) */}
            <div className={styles.qualityNotice}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>
                <strong>Quality Check:</strong> Ensure text, doctor stamps, and numbers are sharp and legible. If blurry or unreadable, tap <strong>Retake</strong>.
              </span>
            </div>

            {/* Metadata chip */}
            {fileDetails && (
              <div className={styles.metadataChip}>
                <Info size={14} />
                <span>{fileDetails.name} ({fileDetails.size})</span>
              </div>
            )}

            {/* Upload error */}
            {uploadError && (
              <div className={styles.errorCard} style={{ marginTop: '16px', padding: '12px 16px' }}>
                <p style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} />
                  {uploadError}
                </p>
              </div>
            )}

            {/* Preview Action Buttons */}
            <div className={styles.previewActions}>
              <button
                type="button"
                onClick={handleReset}
                className={styles.retakeBtn}
                title="Discard and capture again"
                disabled={isUploading}
              >
                {activeTab === 'camera' ? <RefreshCw size={16} /> : <Trash2 size={16} />}
                <span>{activeTab === 'camera' ? 'Retake Photo' : 'Remove File'}</span>
              </button>

              <div className={styles.confirmGroup}>
                <button
                  type="button"
                  onClick={handleDownload}
                  className={styles.downloadBtn}
                  title="Download copy to your device"
                  disabled={isUploading}
                >
                  <Download size={16} />
                  <span>Download</span>
                </button>

                {/* Save to Vault button */}
                <button
                  type="button"
                  onClick={handleSaveToVault}
                  className={styles.proceedBtn}
                  disabled={isUploading || uploadSuccess}
                  title="Save this document to your Report Vault"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Uploading…</span>
                    </>
                  ) : uploadSuccess ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Saved to Vault!</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload size={16} />
                      <span>Save to Vault</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Success banner (emerald/teal) */}
            {uploadSuccess && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#065f46',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>
                  Document saved to your Report Vault successfully. You can view it in the <strong>Report Vault</strong> section.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================
              STATE 2: LIVE CAMERA SCANNER
             ========================================================= */
          activeTab === 'camera' ? (
            <div>
              {cameraError ? (
                <div className={styles.errorCard}>
                  <h3 className={styles.errorTitle}>Camera Not Accessible</h3>
                  <p className={styles.errorText}>
                    {cameraError}. Please check browser camera permissions or switch to file upload.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className={styles.secondaryBtn}
                    style={{ margin: '0 auto' }}
                  >
                    <Upload size={16} />
                    <span>Upload File Instead</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.viewportContainer}>
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      screenshotQuality={0.92}
                      videoConstraints={videoConstraints}
                      onUserMedia={() => setCameraError(null)}
                      onUserMediaError={(err) => {
                        console.error('Camera error:', err);
                        setCameraError(
                          typeof err === 'string' ? err : err.message || 'Camera permission denied or device in use.'
                        );
                      }}
                      className={styles.webcam}
                    />
                    <div className={styles.viewfinderOverlay}>
                      <div className={styles.guideFrame}>
                        <div className={styles.cornerTL} />
                        <div className={styles.cornerTR} />
                        <div className={styles.cornerBL} />
                        <div className={styles.cornerBR} />
                        <div className={styles.frameHint}>
                          Position prescription or report inside frame
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.actionRow}>
                    <button type="button" onClick={toggleFacingMode} className={styles.secondaryBtn}>
                      <FlipHorizontal size={16} />
                      <span>Flip Camera</span>
                    </button>

                    <button type="button" onClick={handleSnapPhoto} className={styles.snapButton}>
                      <Camera size={18} />
                      <span>Snap Photo</span>
                    </button>

                    <button type="button" onClick={() => fileInputRef.current?.click()} className={styles.secondaryBtn}>
                      <Upload size={16} />
                      <span>Upload File</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* =========================================================
                STATE 3: FILE UPLOAD DROP ZONE FALLBACK
               ========================================================= */
            <div
              className={styles.dropZone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) handleFileChange({ target: { files: [droppedFile] } });
              }}
            >
              <div className={styles.dropZoneIcon}>
                <Upload size={26} />
              </div>
              <h3 className={styles.dropZoneTitle}>Click to upload or drag & drop</h3>
              <p className={styles.dropZoneHint}>
                Supports medical report images (JPG, PNG, WebP) or documents (PDF) up to 10MB
              </p>
            </div>
          )
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className={styles.hiddenInput}
          onChange={handleFileChange}
        />
      </div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

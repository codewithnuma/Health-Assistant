import { useEffect, useState } from "react";
import axiosInstance from "../../axiosInstance";

export default function ReportVaultPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    axiosInstance.get("/problem/reports/my/")
      .then(({ data }) => {
        if (mounted) setReports(Array.isArray(data) ? data : data?.results || []);
      })
      .catch(() => { if (mounted) setError("Unable to load saved reports."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <section style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <h1>Report vault</h1>
      {loading && <p>Loading saved reports...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && reports.length === 0 && <p>No saved reports yet.</p>}
      {!loading && reports.map((report) => (
        <article key={report.id} style={{ marginBottom: 12, padding: 18, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <strong>{report.title || "Untitled report"}</strong>
          <p>{report.description || "No description provided."}</p>
          <small>Status: {report.status || "pending"} | {report.location || "Location unavailable"}</small>
        </article>
      ))}
    </section>
  );
}
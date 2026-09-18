import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileText, MapPin, RefreshCw, Search } from "lucide-react";
import axiosInstance from "../../axiosInstance";
import "./ReportVaultPage.css";

const REPORTS_ENDPOINT = "/problem/reports/my/";

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

function ReportVaultPage() {
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReports = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await axiosInstance.get(REPORTS_ENDPOINT);
      const reportData = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setReports(reportData);
    } catch (requestError) {
      console.error("Report vault error:", requestError);
      setError("Unable to load your saved reports. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // The vault must load the user's saved reports when the route opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return reports;

    return reports.filter((report) =>
      [report.title, report.description, report.location, report.category_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [reports, searchTerm]);

  return (
    <section className="report-vault">
      <header className="report-vault__header">
        <div>
          <p className="report-vault__eyebrow">Medical records</p>
          <h1>Report vault</h1>
          <p>All your submitted reports, stored securely in one place.</p>
        </div>
        <div className="report-vault__count">
          <FileText size={20} aria-hidden="true" />
          <strong>{reports.length}</strong>
          <span>saved reports</span>
        </div>
      </header>

      <div className="report-vault__toolbar">
        <label className="report-vault__search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search reports</span>
          <input
            type="search"
            placeholder="Search reports"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <button type="button" onClick={fetchReports} disabled={isLoading}>
          <RefreshCw size={16} aria-hidden="true" />
          {isLoading ? "Loading" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="report-vault__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={fetchReports}>Try again</button>
        </div>
      )}

      {isLoading ? (
        <div className="report-vault__empty">Loading your saved reports...</div>
      ) : filteredReports.length === 0 ? (
        <div className="report-vault__empty">
          <FileText size={30} aria-hidden="true" />
          <h2>{reports.length === 0 ? "No saved reports yet" : "No matching reports"}</h2>
          <p>{reports.length === 0 ? "Reports you submit will appear here." : "Try a different search term."}</p>
        </div>
      ) : (
        <div className="report-vault__grid">
          {filteredReports.map((report) => (
            <article className="report-vault-card" key={report.id}>
              <div className="report-vault-card__topline">
                <span>{report.category_name || "General report"}</span>
                <span className={`report-status report-status--${report.status || "pending"}`}>
                  {report.status || "pending"}
                </span>
              </div>
              <h2>{report.title || "Untitled report"}</h2>
              <p className="report-vault-card__description">
                {report.description || "No description provided."}
              </p>
              <div className="report-vault-card__meta">
                <span><MapPin size={15} aria-hidden="true" />{report.location || "Location unavailable"}</span>
                <span><CalendarDays size={15} aria-hidden="true" />{formatDate(report.created_at)}</span>
              </div>
              {report.image && (
                <a className="report-vault-card__attachment" href={report.image} target="_blank" rel="noreferrer">
                  View attached image
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ReportVaultPage;
import { useMemo, useState } from "react";
import { useEffect } from "react";
import axiosInstance from "../../axiosInstance";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Package,
  Pill,
  Search,
} from "lucide-react";
import "./MedicineDashboard.css";

const MEDICINES_ENDPOINT = "/pharmacy/medicines/my/";

const formatDate = (value) => {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatStatus = (value) => {
  const status = String(value || "active").replaceAll("_", " ").toLowerCase();
  return status.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
};

const normalizeMedicine = (medicine, index) => ({
  id: medicine.id ?? medicine.medicine_id ?? index,
  name: medicine.name || medicine.medicine_name || medicine.medicine?.name || "Unnamed medicine",
  strength: medicine.strength || medicine.dosage_strength || medicine.medicine?.strength || "",
  instructions: medicine.instructions || medicine.dosage_instructions || medicine.dosage || "Follow prescription instructions",
  status: formatStatus(medicine.status),
  refillDate: medicine.refill_date || medicine.next_refill_date || medicine.refillDate
    ? formatDate(medicine.refill_date || medicine.next_refill_date || medicine.refillDate)
    : "Not specified",
});

const statusIcon = {
  Active: CheckCircle2,
  "Refill due": Clock3,
  "Low stock": AlertTriangle,
  Completed: CheckCircle2,
};

function MedicineDashboard() {
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All medicines");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchMedicines = async () => {
      try {
        const response = await axiosInstance.get(MEDICINES_ENDPOINT);
        const medicineData = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];

        if (isMounted) {
          setMedicines(medicineData.map(normalizeMedicine));
          setLoadError("");
        }
      } catch (error) {
        console.error("Medicine dashboard error:", error);
        if (isMounted) {
          setLoadError("Unable to load your medicines. Please try again.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMedicines();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredMedicines = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return medicines.filter((medicine) => {
      const matchesStatus =
        selectedStatus === "All medicines" || medicine.status === selectedStatus;
      const matchesSearch =
        !normalizedSearch ||
        `${medicine.name} ${medicine.strength}`.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [medicines, searchTerm, selectedStatus]);

  const statusCounts = medicines.reduce(
    (counts, medicine) => ({
      ...counts,
      [medicine.status]: (counts[medicine.status] || 0) + 1,
    }),
    {}
  );

  return (
    <section className="medicine-dashboard">
      <header className="medicine-dashboard__header">
        <div>
          <p className="medicine-dashboard__eyebrow">My medications</p>
          <h1>Medicine dashboard</h1>
          <p className="medicine-dashboard__subtitle">
            Keep track of your prescribed medicines and refill status in one place.
          </p>
        </div>
        <div className="medicine-dashboard__date">
          <CalendarDays size={17} aria-hidden="true" />
          <span>Updated 18 Sep 2026</span>
        </div>
      </header>

      <div className="medicine-summary" aria-label="Medicine status summary">
        <div className="medicine-summary__total">
          <div className="medicine-summary__icon"><Pill size={22} /></div>
          <div>
            <strong>{medicines.length}</strong>
            <span>Total medicines</span>
          </div>
        </div>
        <div><strong>{statusCounts.Active || 0}</strong><span>Active</span></div>
        <div><strong>{statusCounts["Refill due"] || 0}</strong><span>Refill due</span></div>
        <div><strong>{statusCounts["Low stock"] || 0}</strong><span>Low stock</span></div>
      </div>

      <div className="medicine-list-panel">
        <div className="medicine-list-panel__toolbar">
          <div>
            <h2>All medicines</h2>
            <p>{isLoading ? "Loading medicines..." : `${filteredMedicines.length} medicines shown`}</p>
          </div>
          <label className="medicine-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search medicines</span>
            <input
              type="search"
              placeholder="Search medicines"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        <div className="medicine-filters" role="group" aria-label="Filter medicines by status">
          {["All medicines", "Active", "Refill due", "Low stock", "Completed"].map((status) => (
            <button
              className={selectedStatus === status ? "is-selected" : ""}
              key={status}
              onClick={() => setSelectedStatus(status)}
              type="button"
            >
              {status}
            </button>
          ))}
        </div>

        {loadError && <div className="medicine-error" role="alert">{loadError}</div>}
        <div className="medicine-table" role="table" aria-label="Medicine list">
          <div className="medicine-table__head" role="row">
            <span role="columnheader">Medicine</span>
            <span role="columnheader">Instructions</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Next refill</span>
          </div>
          {isLoading ? (
            <div className="medicine-empty">Loading your medicines...</div>
          ) : filteredMedicines.length > 0 ? filteredMedicines.map((medicine) => {
            const StatusIcon = statusIcon[medicine.status];

            return (
              <div className="medicine-row" key={medicine.id} role="row">
                <div className="medicine-name" role="cell">
                  <div className="medicine-name__icon"><Package size={19} /></div>
                  <div>
                    <strong>{medicine.name}</strong>
                    <span>{medicine.strength}</span>
                  </div>
                </div>
                <span className="medicine-instructions" role="cell">{medicine.instructions}</span>
                <span className={`medicine-status medicine-status--${medicine.status.toLowerCase().replace(" ", "-")}`} role="cell">
                  <StatusIcon size={15} aria-hidden="true" />
                  {medicine.status}
                </span>
                <span className="medicine-refill" role="cell">{medicine.refillDate}</span>
              </div>
            );
          }) : (
            <div className="medicine-empty">No medicines match your search.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MedicineDashboard;
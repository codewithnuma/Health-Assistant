import { useEffect, useState } from "react";
import axiosInstance from "../../axiosInstance";

export default function MedicineDashboard() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadMedicines = async () => {
      const endpoints = ["/pharmacy/medicines/my/", "/pharmacy/medicines/", "/medicines/"];
      let lastError;

      for (const endpoint of endpoints) {
        try {
          const { data } = await axiosInstance.get(endpoint);
          if (mounted) setMedicines(Array.isArray(data) ? data : data?.results || []);
          return;
        } catch (requestError) {
          lastError = requestError;
          if (requestError.response?.status !== 404) break;
        }
      }

      if (mounted) {
        const status = lastError?.response?.status;
        setError(status ? `Unable to load medicines (server returned ${status}).` : "Unable to reach the medicine service.");
      }
    };

    loadMedicines()
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <section style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <h1>Medicine dashboard</h1>
      {loading && <p>Loading medicines...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && medicines.length === 0 && <p>No medicines found.</p>}
      {!loading && medicines.map((medicine, index) => (
        <article key={medicine.id ?? index} style={{ marginBottom: 12, padding: 18, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <strong>{medicine.name || medicine.medicine_name || "Unnamed medicine"}</strong>
          <p>Status: {medicine.status || "Active"}</p>
        </article>
      ))}
    </section>
  );
}
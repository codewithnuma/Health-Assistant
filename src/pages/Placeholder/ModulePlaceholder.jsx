export default function ModulePlaceholder({ title, description, icon: Icon }) {
  return (
    <section style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ padding: 36, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
        {Icon && <Icon size={28} aria-hidden="true" />}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
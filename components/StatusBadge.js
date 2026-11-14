const STYLES = {
  active: "badge-success",
  unused: "badge-info",
  expired: "badge-warning",
  revoked: "badge-error",
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-soft capitalize ${STYLES[status] ?? ""}`}>{status}</span>;
}

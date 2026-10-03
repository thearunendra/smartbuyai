// TEMPORARY (2026-10-03): test coverage on the admin dashboard. Remove this
// file, TestingPanel.css, src/data/testing.js and the two lines that render it
// in src/pages/Admin.jsx to take the feature out.
import { useState } from "react";
import { Check, FlaskConical, RefreshCw, X } from "lucide-react";
import { SAFE_PERCENT, TESTING_SNAPSHOT_DATE, TEST_SUITES } from "../data/testing";
import { api } from "../api";
import "./TestingPanel.css";

function when(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function TestingPanel() {
  // Until the button is pressed, the figures are the snapshot in data/testing.js.
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    setNote("");

    try {
      const data = await api("/api/admin/coverage");

      setReports(data);

      if (!data.backend?.available && !data.frontend?.available) {
        setNote(
          "No report on the server. Run npm run test:coverage in backend/ and frontend/, then try again."
        );
      }
    } catch (error) {
      setNote(error.message || "Unable to read the test results.");
    } finally {
      setLoading(false);
    }
  };

  const suites = TEST_SUITES.map((suite) => {
    const report = reports?.[suite.name.toLowerCase()];

    return report?.available
      ? { ...suite, statements: report.statements, ranAt: report.ranAt }
      : suite;
  });

  return (
    <section className="panel testing-panel">
      <div className="panel-header">
        <h2>
          <FlaskConical size={18} /> Test cases
        </h2>

        <button
          type="button"
          className="btn btn-secondary testing-run"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={15} /> {loading ? "Reading results..." : "Run test cases"}
        </button>
      </div>

      <div className="testing-split">
        {suites.map((suite) => {
          const safe = suite.statements >= SAFE_PERCENT;

          return (
            <div
              key={suite.name}
              className={`testing-part ${safe ? "is-safe" : "is-low"}`}
              title={`${safe ? "At or above" : "Below"} the ${SAFE_PERCENT}% threshold`}
            >
              <p className="testing-part-name">{suite.name}</p>

              <strong>
                <span className="testing-mark">
                  {safe ? <Check size={15} /> : <X size={15} />}
                </span>
                {suite.statements}%
              </strong>

              <span className="testing-part-when">
                {suite.ranAt ? when(suite.ranAt) : TESTING_SNAPSHOT_DATE}
              </span>
            </div>
          );
        })}
      </div>

      {note && <p className="testing-note">{note}</p>}
    </section>
  );
}

export default TestingPanel;

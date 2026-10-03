// TEMPORARY (2026-10-03): white-box test results on the admin dashboard, for
// the project demo. Remove this file, src/data/testing.js and the three lines
// that render it in src/pages/Admin.jsx to take the feature out.
import { Bug, FlaskConical, ShieldCheck } from "lucide-react";
import {
  BUGS_FOUND,
  COVERAGE_THRESHOLDS,
  TESTING_SNAPSHOT_DATE,
  TEST_SUITES
} from "../data/testing";
import "./TestingPanel.css";

const METRICS = [
  ["statements", "Statements"],
  ["branches", "Branches"],
  ["functions", "Functions"],
  ["lines", "Lines"]
];

function TestingPanel() {
  const totalTests = TEST_SUITES.reduce((sum, suite) => sum + suite.tests, 0);
  const totalFiles = TEST_SUITES.reduce((sum, suite) => sum + suite.files, 0);

  return (
    <section className="panel testing-panel">
      <div className="panel-header">
        <h2>
          <FlaskConical size={18} /> White-box testing
        </h2>

        <span className="panel-meta">
          {totalTests} tests &middot; snapshot of {TESTING_SNAPSHOT_DATE}
        </span>
      </div>

      <p className="testing-intro">
        {totalTests} tests across {totalFiles} files, written against the
        source: every statement, branch and boundary of the parsing, pricing
        and API code. They use mocked Serper and Gemini clients and an
        in-memory MongoDB, so a run needs no API keys, no database and no
        credits.
      </p>

      {TEST_SUITES.map((suite) => (
        <div key={suite.name} className="testing-suite">
          <div className="testing-suite-head">
            <h3>{suite.name}</h3>

            <span className="tag">
              {suite.tests} tests in {suite.files} files
            </span>

            <span className="cell-muted">{suite.stack}</span>
          </div>

          <div className="bar-list">
            {METRICS.map(([key, label]) => {
              const metric = suite.coverage[key];
              const threshold = COVERAGE_THRESHOLDS[key];

              return (
                <div key={key} className="bar-row">
                  <div className="bar-label">
                    <span>
                      {label}{" "}
                      <em className="testing-counts">
                        {metric.covered}/{metric.total}
                      </em>
                    </span>

                    <strong>{metric.percent}%</strong>
                  </div>

                  <div
                    className="bar-track"
                    title={`${label}: ${metric.percent}% covered, ${threshold}% required`}
                  >
                    <div
                      className="bar-fill"
                      style={{ width: `${metric.percent}%` }}
                    />
                  </div>

                  <p className="testing-threshold">
                    <ShieldCheck size={13} /> the run fails below {threshold}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="testing-bugs">
        <h3>
          <Bug size={16} /> Defects these tests found in live code
        </h3>

        <ol>
          {BUGS_FOUND.map((bug) => (
            <li key={bug.title}>
              <strong>{bug.title}</strong>
              <p className="cell-muted">{bug.detail}</p>
            </li>
          ))}
        </ol>
      </div>

      <p className="testing-howto">
        Reproduce: <code>npm run test:coverage</code> in <code>backend/</code>
        {" and "}<code>frontend/</code>. The clickable line-by-line report lands
        in <code>coverage/index.html</code>.
      </p>
    </section>
  );
}

export default TestingPanel;

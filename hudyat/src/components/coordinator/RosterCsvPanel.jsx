import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import StatusBanner from '../ui/StatusBanner.jsx';

/**
 * CSV upload, validation error list, preview table, and Firestore import action
 * for student rosters and section enrollments.
 */
export default function RosterCsvPanel({
  fileName,
  rows,
  errors,
  status,
  importError,
  isImporting,
  canImport,
  onDownloadSample,
  onFileChange,
  onImport,
}) {
  return (
    <Card
      id="panel-roster"
      role="tabpanel"
      aria-labelledby="tab-roster"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">
            1. Roster &amp; Enrollments CSV
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Required columns:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-950">
              studentNo, name, email, sectionName
            </code>
          </p>
        </div>

        <Button variant="secondary" onClick={onDownloadSample}>
          Download Sample CSV
        </Button>
      </div>

      <div>
        <label
          htmlFor="roster-csv-upload"
          className="block text-sm font-bold text-slate-900 mb-2"
        >
          Select Roster CSV file
        </label>
        <input
          id="roster-csv-upload"
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-950 file:mr-4 file:min-h-10 file:rounded-lg file:border-0 file:bg-[#0F172A] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-[#1E293B]"
        />
      </div>

      <StatusBanner tone="success" message={status} />
      <ErrorBanner message={importError} />

      {fileName && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-950">
            <span>File: {fileName}</span>
            <span>Valid rows: {rows.length}</span>
            <span className={errors.length > 0 ? 'text-red-700' : 'text-emerald-800'}>
              Errors: {errors.length}
            </span>
          </div>

          {errors.length > 0 && (
            <ErrorBanner title="Fix the following CSV errors before importing:">
              <ul className="mt-2 list-disc pl-5 space-y-1 text-sm font-medium">
                {errors.map((err, idx) => (
                  <li key={`${err.rowNumber}-${idx}`}>
                    <strong>Row {err.rowNumber}:</strong> {err.message}
                  </li>
                ))}
              </ul>
            </ErrorBanner>
          )}

          {rows.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                Preview (first {Math.min(5, rows.length)} of {rows.length} valid
                rows)
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-700">
                        Student No
                      </th>
                      <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-700">
                        Name
                      </th>
                      <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-700">
                        Email
                      </th>
                      <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-700">
                        Section
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {rows.slice(0, 5).map((row, idx) => (
                      <tr key={`${row.studentNo}-${row.sectionName}-${idx}`}>
                        <td className="px-3 py-2.5 font-bold text-slate-950">
                          {row.studentNo}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {row.name}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">
                          {row.email}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-950">
                          {row.sectionName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-2">
        <Button variant="primary" onClick={onImport} disabled={!canImport}>
          {isImporting ? 'Importing to Firestore…' : 'Import to Firestore'}
        </Button>
      </div>
    </Card>
  );
}

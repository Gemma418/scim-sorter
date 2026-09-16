import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CircleX,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock3,
  Download,
  Gauge,
  Import as ImportIcon,
  TrendingUp,
  UserRoundArrowLeft,
  Users,
  Zap,
} from 'lucide-react'
import './App.css'
import {
  evaluateTeamConstraints,
  generateScrimTeams,
  type ScrimLevel,
  type Skater,
  type ValidationIssue,
  validateSkaters,
} from './lib/scrim'

const SCRIM_LEVELS: { value: ScrimLevel; label: string }[] = [
  { value: 'rookie', label: 'Rookie' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const parseCsv = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (rows.length < 2) {
    return []
  }

  const headers = parseCsvLine(rows[0])
  const body = rows.slice(1)

  return body.map((line) => {
    const values = parseCsvLine(line)
    const record: Record<string, string> = {}

    headers.forEach((header, index) => {
      record[header.trim().toLowerCase()] = (values[index] ?? '').trim()
    })

    return record
  })
}

const parseCsvLine = (line: string) => {
  const parsed: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      parsed.push(current)
      current = ''
    } else {
      current += char
    }
  }

  parsed.push(current)
  return parsed
}

const formatRole = (role: string) => role.charAt(0).toUpperCase() + role.slice(1)

const InfoTooltip = ({ text }: { text: string }) => (
  <span className="tooltip-wrap" aria-label={text} role="note">
    <span className="tooltip-trigger">?</span>
    <span className="tooltip-bubble">{text}</span>
  </span>
)

const DisabledAction = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <span className="disabled-action-wrap" aria-label={text} role="note">
    {children}
    <span className="disabled-action-bubble">{text}</span>
  </span>
)

const Instructions = ({ onBack }: { onBack: () => void }) => (
  <div className="instructions-page">
    <div className="instructions-header">
      <div>
        <p className="eyebrow">How it works</p>
        <h2>Instructions</h2>
      </div>
    </div>

    <div className="instructions-grid">
      <section className="panel instructions-card">
        <h3>1. Prepare your data in CSV format</h3>
        <p>You have two options:</p>
        <ul>Download a template example, copy your data into the template, then import</ul>
        <ul>Import existing data if it already matches the required format</ul>
        <p>Required columns:</p>
        <code>number, name, home league, position, years playing, skill level</code>
        <p>Positions must be jammer, pivot, or blocker. Skill is scored from 0 to 5.</p>
      </section>

      <section className="panel instructions-card">
        <h3>2. Upload and choose a level</h3>
        <p>Choose your CSV file, then select Rookie, Intermediate, or Advanced. Sort teams becomes available once both are selected.</p>
        <ul>
          <li>Rookie: skill 0-3, experience 0-1.</li>
          <li>Intermediate: skill 1-4, experience 1-3.</li>
          <li>Advanced: skill 4-5, with skill 3 allowed at experience 5, and experience 4-5.</li>
        </ul>
      </section>

      <section className="panel instructions-card">
        <h3>3. Review the result</h3>
        <p>The app creates Team A, Team B, and a standby pool. It balances skill, experience, team size, roles, and jammer coverage where the roster allows.</p>
        <p>Potential issues explain constraints that the available roster could not satisfy.</p>
      </section>

      <section className="panel instructions-card">
        <h3>4. Adjust and export</h3>
        <p>Edit team names directly in the team headers. Click Number, Position, Experience, or Skill in a table header to sort.</p>
        <p>Download CSV exports the sorted teams, standby players, and your custom team names.</p>
      </section>
    </div>
  </div>
)

type SortKey = 'number' | 'position' | 'skillLevel' | 'yearsPlaying'

const positionOrder: Skater['position'][] = ['jammer', 'blocker', 'pivot']

const SkaterTable = ({ label, badgeClass, skaters, editable = false, onLabelChange, panelClass = '' }: { label: string; badgeClass: string; skaters: Skater[]; editable?: boolean; onLabelChange?: (label: string) => void; panelClass?: string }) => {
  const [sortKey, setSortKey] = useState<SortKey>('number')
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending')

  const handleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((direction) => direction === 'ascending' ? 'descending' : 'ascending')
      return
    }

    setSortKey(nextSortKey)
    setSortDirection('ascending')
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown size={13} aria-hidden="true" />
    return sortDirection === 'ascending'
      ? <ChevronUp size={13} aria-hidden="true" />
      : <ChevronDown size={13} aria-hidden="true" />
  }

  const visibleSkaters = useMemo(() => {
    return [...skaters].sort((a, b) => {
      let comparison = 0

      if (sortKey === 'number') {
        comparison = String(a.number).localeCompare(String(b.number))
      } else if (sortKey === 'position') {
        comparison = positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position)
      } else if (sortKey === 'skillLevel') {
        comparison = a.skillLevel - b.skillLevel
      } else {
        comparison = a.yearsPlaying - b.yearsPlaying
      }

      if (comparison === 0) {
        comparison = String(a.number).localeCompare(String(b.number))
      }

      return sortDirection === 'ascending' ? comparison : -comparison
    })
  }, [skaters, sortDirection, sortKey])

  return (
    <article className={`panel team-panel ${panelClass}`}>
      <div className="panel-title-row">
        {editable ? (
          <input
            className={`team-badge team-name-input ${badgeClass}`}
            value={label}
            onChange={(event) => onLabelChange?.(event.target.value)}
            aria-label="Team name"
            maxLength={30}
            style={{ width: `${Math.min(Math.max(label.length + 2, 9), 24)}ch` }}
          />
        ) : (
          <span className={`team-badge ${badgeClass}`}>{label}</span>
        )}
        <h2>{skaters.length} skaters</h2>
      </div>
      {editable && label.length >= 30 && (
        <p className="team-name-limit">Team name limit reached (30 characters)</p>
      )}

      <div className="table-scroll">
        <table className="skater-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={sortKey === 'number' ? sortDirection : 'none'}>
                <button type="button" className="table-sort-button" onClick={() => handleSort('number')}>Number <SortIcon column="number" /></button>
              </th>
              <th scope="col">Name</th>
              <th scope="col" aria-sort={sortKey === 'position' ? sortDirection : 'none'}>
                <button type="button" className="table-sort-button" onClick={() => handleSort('position')}>Position <SortIcon column="position" /></button>
              </th>
              <th scope="col" aria-sort={sortKey === 'yearsPlaying' ? sortDirection : 'none'}>
                <button type="button" className="table-sort-button" onClick={() => handleSort('yearsPlaying')}>Experience <SortIcon column="yearsPlaying" /></button>
              </th>
              <th scope="col" aria-sort={sortKey === 'skillLevel' ? sortDirection : 'none'}>
                <button type="button" className="table-sort-button" onClick={() => handleSort('skillLevel')}>Skill <SortIcon column="skillLevel" /></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleSkaters.length === 0 ? (
              <tr><td className="empty-row" colSpan={5}>No skaters available.</td></tr>
            ) : (
              visibleSkaters.map((skater) => (
                <tr key={`${skater.number}-${skater.name}`}>
                  <td className="skater-number">{skater.number}</td>
                  <td className="skater-name">{skater.name}</td>
                  <td>{formatRole(skater.position)}</td>
                  <td>{skater.yearsPlaying}</td>
                  <td>{skater.skillLevel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function App() {
  const [view, setView] = useState<'sorter' | 'instructions'>('sorter')
  const [csvInput, setCsvInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [teamAName, setTeamAName] = useState('Team A')
  const [teamBName, setTeamBName] = useState('Team B')
  const [scrimLevel, setScrimLevel] = useState<ScrimLevel | ''>('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [result, setResult] = useState<ReturnType<typeof generateScrimTeams> | null>(null)
  const [message, setMessage] = useState('')
  const [constraintReport, setConstraintReport] = useState<ReturnType<typeof evaluateTeamConstraints> | null>(null)

  const rosterCount = useMemo(() => {
    if (!result) {
      return 0
    }

    return result.teamA.length + result.teamB.length + result.standby.length
  }, [result])

  const handleGenerate = () => {
    if (!scrimLevel) return

    setTeamAName('Team A')
    setTeamBName('Team B')

    const rows = parseCsv(csvInput)
    const validation = validateSkaters(rows)
    setIssues(validation.issues)

    if (!validation.valid) {
      setMessage('Please fix the invalid rows before generating teams.')
      setResult(null)
      setConstraintReport(null)
      return
    }

    const nextResult = generateScrimTeams(validation.skaters, scrimLevel)
    const nextConstraintReport = evaluateTeamConstraints(nextResult.teamA, nextResult.teamB)
    setResult(nextResult)
    setConstraintReport(nextConstraintReport)
    setMessage(
      nextConstraintReport.valid
        ? 'Teams generated successfully.'
        : 'One or more scrim constraints failed. Review the issues below.',
    )
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    setCsvInput(text)
    setIssues([])
    setResult(null)
    setConstraintReport(null)
    setScrimLevel('')
    setMessage('')
  }

  const handleDownload = () => {
    if (!result) {
      setMessage('Generate teams before downloading the sorted CSV.')
      return
    }

    const escapeCsvValue = (value: string | number) => {
      const text = String(value)
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
    }
    const rows: (string | number)[][] = [
      ['team', 'number', 'name', 'home league', 'position', 'years playing', 'skill level'],
      ...result.teamA.map((skater) => [teamAName || 'Team A', skater.number, skater.name, skater.homeLeague, skater.position, skater.yearsPlaying, skater.skillLevel]),
      ...result.teamB.map((skater) => [teamBName || 'Team B', skater.number, skater.name, skater.homeLeague, skater.position, skater.yearsPlaying, skater.skillLevel]),
      ...result.standby.map((skater) => ['Standby', skater.number, skater.name, skater.homeLeague, skater.position, skater.yearsPlaying, skater.skillLevel]),
    ]
    const csv = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'sorted-scrim-teams.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadTemplate = () => {
    const template = [
      'number,name,home league,position,years playing,skill level',
      '1,Example Skater,Example League,blocker,2,2',
    ].join('\n')
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'scrim-signups-template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleClearData = () => {
    const confirmed = window.confirm('Clear the uploaded data, generated teams, and custom team names?')
    if (!confirmed) return

    setCsvInput('')
    setTeamAName('Team A')
    setTeamBName('Team B')
    setScrimLevel('')
    setIssues([])
    setResult(null)
    setConstraintReport(null)
    setMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleLevelChange = (level: ScrimLevel | '') => {
    setScrimLevel(level)
    setResult(null)
    setConstraintReport(null)
    setIssues([])
    setMessage('')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Open-source scrim organiser</p>
          <h1>Organise your teams</h1>
        </div>
        <button type="button" className="secondary-button instructions-button" onClick={() => setView(view === 'sorter' ? 'instructions' : 'sorter')}>
          <BookOpen size={16} />
          {view === 'sorter' ? 'Instructions' : 'Back to sorter'}
        </button>
      </header>

      {view === 'instructions' ? <Instructions onBack={() => setView('sorter')} /> : <>

      <section className="panel controls-panel">
        <div className="field-row file-row">
          <label className="field level-field file-field">
            <span className="field-heading">
              <strong><ImportIcon size={16} /> Choose CSV file</strong>
            </span>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileImport} />
            <button type="button" className="template-button" onClick={handleDownloadTemplate}>
              <Download size={14} />
              Download template
            </button>
          </label>

          <label className="field level-field">
            <span className="field-heading">
              <strong><Gauge size={16} /> Scrim level</strong>
              <small>Choose the level of this game</small>
            </span>
              <select value={scrimLevel} onChange={(event) => handleLevelChange(event.target.value as ScrimLevel | '')}>
                <option value="">Choose a level</option>
              {SCRIM_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions-row">
          {!csvInput || !scrimLevel ? (
            <DisabledAction text="You need to upload a file and choose a level before you can sort teams.">
              <button type="button" className="primary-button" onClick={handleGenerate} disabled>
                <Zap size={16} />
                Sort teams
              </button>
            </DisabledAction>
          ) : (
            <button type="button" className="primary-button" onClick={handleGenerate}>
              <Zap size={16} />
              Sort teams
            </button>
          )}

          {!result ? (
            <DisabledAction text="You need to sort teams before you can download data.">
              <button type="button" className="secondary-button download-button" onClick={handleDownload} disabled>
                <Download size={16} />
                Download CSV
              </button>
            </DisabledAction>
          ) : (
            <button type="button" className="secondary-button download-button" onClick={handleDownload}>
              <Download size={16} />
              Download CSV
            </button>
          )}

          <button type="button" className="secondary-button" onClick={handleClearData} disabled={!csvInput}>
            <CircleX size={16} />
            Clear data
          </button>
        </div>

        {message && <p className="status-message">{message}</p>}
      </section>

      {issues.length > 0 && (
        <section className="panel issues-panel">
          <div className="panel-title-row">
            <AlertTriangle size={18} />
            <h2>Validation issues</h2>
          </div>
          <ul className="issue-list">
            {issues.map((issue, index) => (
              <li key={`${issue.field}-${issue.index}-${index}`}>
                Row {issue.index + 2}: {issue.field} — {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {constraintReport && !constraintReport.valid && (
        <section className="panel issues-panel constraint-panel">
          <div className="panel-title-row">
            <AlertTriangle size={18} />
            <h2>Potential issues</h2>
          </div>
          <ul className="issue-list">
            {constraintReport.failures.map((failure, index) => (
              <li key={`${failure}-${index}`}>
                {failure.replace(/^Team A/, teamAName || 'Team A').replace(/^Team B/, teamBName || 'Team B')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && (
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">
              <Users size={18} />
              <span className="label-with-tooltip">
                Total eligible skaters
                <InfoTooltip text="Total skaters allocated to the teams plus the standby pool. Skaters from your data are excluded here when they do not match the selected level." />
              </span>
            </div>
            <strong>{rosterCount}</strong>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">
              <TrendingUp size={18} />
              <span className="label-with-tooltip">
                Skill scores
                <InfoTooltip text="Sum of each skater's skill rating from 0 to 5; lower differences between teams means a fairer split." />
              </span>
            </div>
            <div className="stat-comparison">
              <strong><span>{teamAName || 'Team A'}</span>{result.summary.teamASkill}</strong>
              <strong><span>{teamBName || 'Team B'}</span>{result.summary.teamBSkill}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">
              <Clock3 size={18} />
              <span className="label-with-tooltip">
                Experience totals
                <InfoTooltip text="Sum of each skater's experience rating from 0 to 5; lower differences between teams means a fairer split. Skills are ranked higher than experience when sorting teams." />
              </span>
            </div>
            <div className="stat-comparison">
              <strong><span>{teamAName || 'Team A'}</span>{result.summary.teamAExperience}</strong>
              <strong><span>{teamBName || 'Team B'}</span>{result.summary.teamBExperience}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">
              <UserRoundArrowLeft size={18} />
              <span className="label-with-tooltip">
                Standby pool
                <InfoTooltip text="Skaters who meet some selection requirements and can be used to fill team gaps, or skaters left over after the teams are filled." />
              </span>
            </div>
            <strong>{result.summary.standbyCount}</strong>
          </div>
        </section>
      )}

      {result && (
        <>
          <section className="teams-grid">
            <SkaterTable label={teamAName} onLabelChange={setTeamAName} editable badgeClass="badge-a" skaters={result.teamA} />
            <SkaterTable label={teamBName} onLabelChange={setTeamBName} editable badgeClass="badge-b" skaters={result.teamB} />
            <SkaterTable label="Standby" badgeClass="badge-c" panelClass="standby-panel" skaters={result.standby} />
          </section>
          <div className="table-download-row">
            <button type="button" className="secondary-button download-button" onClick={handleDownload}>
              <Download size={16} />
              Download CSV
            </button>
          </div>
        </>
      )}

      {!result && (
        <section className="panel empty-panel">
          <ImportIcon size={22} />
          <p>Import csv data above to generate a balanced team split.</p>
        </section>
      )}
      </>}
    </div>
  )
}

export default App

import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  Info,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  assessTrip,
  formatDay,
  inclusiveDays,
  parseDate,
  type Stay,
  toInputDate,
  todayUtcDay,
} from './lib/schengen'

interface StayInput {
  id: string
  entry: string
  exit: string
}

const newId = () => Math.random().toString(36).slice(2, 10)

function getInitialPlan() {
  const today = todayUtcDay()
  return {
    entry: toInputDate(today),
    exit: toInputDate(today + 13),
  }
}

function App() {
  const initialPlan = useMemo(getInitialPlan, [])
  const [plannedEntry, setPlannedEntry] = useState(initialPlan.entry)
  const [plannedExit, setPlannedExit] = useState(initialPlan.exit)
  const [stays, setStays] = useState<StayInput[]>([{ id: newId(), entry: '', exit: '' }])

  const calculation = useMemo(() => {
    const entry = parseDate(plannedEntry)
    const exit = parseDate(plannedExit)
    const errors: string[] = []

    if (entry === null || exit === null) {
      errors.push('Add both dates for your planned trip.')
    } else if (exit < entry) {
      errors.push('Your departure must be on or after your arrival.')
    } else if (inclusiveDays(entry, exit) > 365) {
      errors.push('This calculator is for short stays of up to 365 days.')
    }

    const history: Stay[] = []
    stays.forEach((stay, index) => {
      if (!stay.entry && !stay.exit) return
      const pastEntry = parseDate(stay.entry)
      const pastExit = parseDate(stay.exit)

      if (pastEntry === null || pastExit === null) {
        errors.push(`Complete both dates for stay ${index + 1}.`)
      } else if (pastExit < pastEntry) {
        errors.push(`Stay ${index + 1} ends before it starts.`)
      } else if (entry !== null && pastExit >= entry) {
        errors.push(`Stay ${index + 1} must end before your planned arrival.`)
      } else {
        history.push({ entry: pastEntry, exit: pastExit })
      }
    })

    if (errors.length > 0 || entry === null || exit === null || exit < entry) {
      return { errors, assessment: null, entry, exit }
    }

    return { errors, assessment: assessTrip(history, entry, exit), entry, exit }
  }, [plannedEntry, plannedExit, stays])

  const updateStay = (id: string, field: 'entry' | 'exit', value: string) => {
    setStays((current) =>
      current.map((stay) => (stay.id === id ? { ...stay, [field]: value } : stay)),
    )
  }

  const removeStay = (id: string) => {
    setStays((current) => {
      const next = current.filter((stay) => stay.id !== id)
      return next.length ? next : [{ id: newId(), entry: '', exit: '' }]
    })
  }

  const reset = () => {
    const plan = getInitialPlan()
    setPlannedEntry(plan.entry)
    setPlannedExit(plan.exit)
    setStays([{ id: newId(), entry: '', exit: '' }])
  }

  const assessment = calculation.assessment
  const statusClass = assessment?.isCompliant ? 'success' : 'danger'
  const usedPercent = assessment ? Math.min(100, (assessment.usedBeforeEntry / 90) * 100) : 0

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Schengen calculator home">
          <span className="brand-mark" aria-hidden="true">90</span>
          <span>Schengen day calculator</span>
        </a>
        <span className="privacy-note"><ShieldCheck size={16} /> Your dates stay on this device</span>
      </header>

      <main id="top">
        <section className="intro">
          <div>
            <p className="eyebrow">90 days in any rolling 180-day period</p>
            <h1>Plan your Schengen stay with confidence.</h1>
          </div>
          <p className="intro-copy">
            Add previous visits, choose your next arrival and departure, and see whether the full trip fits the rule.
          </p>
        </section>

        <div className="calculator-grid">
          <section className="panel input-panel" aria-labelledby="plan-title">
            <div className="section-heading">
              <div>
                <span className="step">01</span>
                <h2 id="plan-title">Your planned trip</h2>
              </div>
              <button className="text-button" type="button" onClick={reset}>
                <RotateCcw size={15} /> Reset
              </button>
            </div>

            <div className="date-grid">
              <label>
                <span>Arrival</span>
                <input
                  type="date"
                  value={plannedEntry}
                  onChange={(event) => setPlannedEntry(event.target.value)}
                />
              </label>
              <label>
                <span>Departure</span>
                <input
                  type="date"
                  value={plannedExit}
                  min={plannedEntry || undefined}
                  onChange={(event) => setPlannedExit(event.target.value)}
                />
              </label>
            </div>

            <div className="divider" />

            <div className="section-heading history-heading">
              <div>
                <span className="step">02</span>
                <h2>Previous Schengen stays</h2>
              </div>
              <button
                className="add-button"
                type="button"
                onClick={() => setStays((current) => [...current, { id: newId(), entry: '', exit: '' }])}
              >
                <Plus size={17} /> Add stay
              </button>
            </div>
            <p className="field-help">Use passport stamps or travel records. Entry and exit days both count.</p>

            <div className="stay-list">
              {stays.map((stay, index) => (
                <div className="stay-row" key={stay.id}>
                  <span className="stay-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <label>
                    <span>Entry</span>
                    <input
                      type="date"
                      value={stay.entry}
                      max={plannedEntry || undefined}
                      onChange={(event) => updateStay(stay.id, 'entry', event.target.value)}
                      aria-label={`Stay ${index + 1} entry date`}
                    />
                  </label>
                  <label>
                    <span>Exit</span>
                    <input
                      type="date"
                      value={stay.exit}
                      min={stay.entry || undefined}
                      max={plannedEntry || undefined}
                      onChange={(event) => updateStay(stay.id, 'exit', event.target.value)}
                      aria-label={`Stay ${index + 1} exit date`}
                    />
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => removeStay(stay.id)}
                    aria-label={`Remove stay ${index + 1}`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>

            {calculation.errors.length > 0 && (
              <div className="validation" role="alert">
                <CircleAlert size={18} />
                <div>
                  {calculation.errors.map((error) => <p key={error}>{error}</p>)}
                </div>
              </div>
            )}
          </section>

          <aside className="panel result-panel" aria-live="polite" aria-labelledby="result-title">
            <div className="section-heading result-heading">
              <div>
                <span className="step light">03</span>
                <h2 id="result-title">Your result</h2>
              </div>
              <CalendarDays size={22} aria-hidden="true" />
            </div>

            {!assessment ? (
              <div className="empty-result">
                <CalendarDays size={38} />
                <h3>Ready when your dates are</h3>
                <p>Complete the highlighted date fields to calculate your allowance.</p>
              </div>
            ) : (
              <>
                <div className={`status-card ${statusClass}`}>
                  <span className="status-icon" aria-hidden="true">
                    {assessment.isCompliant ? <Check size={21} /> : <CircleAlert size={21} />}
                  </span>
                  <div>
                    <p className="status-kicker">{assessment.isCompliant ? 'Within the limit' : 'Over the limit'}</p>
                    <h3>
                      {assessment.isCompliant
                        ? `Your ${assessment.plannedDays}-day trip fits the rule.`
                        : `This trip exceeds your allowance on ${formatDay(assessment.firstInvalidDay!)}.`}
                    </h3>
                  </div>
                </div>

                <div className="usage-block">
                  <div className="usage-ring" style={{ '--used': `${usedPercent * 3.6}deg` } as React.CSSProperties}>
                    <div><strong>{assessment.usedBeforeEntry}</strong><span>used</span></div>
                  </div>
                  <div className="usage-copy">
                    <p>Before arrival</p>
                    <strong>{assessment.availableOnEntry} days available</strong>
                    <span>in the rolling window on {formatDay(calculation.entry!)}</span>
                  </div>
                </div>

                <dl className="result-list">
                  <div>
                    <dt><Clock3 size={17} /> Maximum stay from this arrival</dt>
                    <dd>
                      <strong>{assessment.maxContinuousDays} days</strong>
                      <span>{assessment.maxContinuousExit ? `through ${formatDay(assessment.maxContinuousExit)}` : 'No day available'}</span>
                    </dd>
                  </div>
                  <div>
                    <dt><CalendarDays size={17} /> Earliest one-day re-entry</dt>
                    <dd><strong>{assessment.earliestOneDayEntry ? formatDay(assessment.earliestOneDayEntry) : 'Not found'}</strong></dd>
                  </div>
                  {!assessment.isCompliant && (
                    <div className="highlight-result">
                      <dt><Check size={17} /> Earliest date for this full trip</dt>
                      <dd>
                        <strong>{assessment.earliestFullTripEntry ? formatDay(assessment.earliestFullTripEntry) : 'Not found'}</strong>
                        <span>for the same {assessment.plannedDays}-day duration</span>
                      </dd>
                    </div>
                  )}
                </dl>

                <p className="departure-note">
                  Your rolling window contains <strong>{assessment.usedOnDeparture} days</strong> on departure.
                </p>
              </>
            )}
          </aside>
        </div>

        <section className="explanation" aria-labelledby="how-title">
          <div className="explanation-title">
            <p className="eyebrow">The rule, made practical</p>
            <h2 id="how-title">How the calculation works</h2>
          </div>
          <div className="rule-cards">
            <article>
              <span>1</span>
              <h3>Count every Schengen day</h3>
              <p>Arrival and departure each count as a full day. Time across all Schengen countries is combined.</p>
            </article>
            <article>
              <span>2</span>
              <h3>Look back 180 days</h3>
              <p>For every day of the planned visit, the calculator checks that day and the previous 179 days.</p>
            </article>
            <article>
              <span>3</span>
              <h3>Stay at or below 90</h3>
              <p>The total must never exceed 90 occupied days inside any one of those rolling windows.</p>
            </article>
          </div>

          <div className="notice">
            <Info size={20} />
            <div>
              <h3>Planning aid, not legal advice</h3>
              <p>
                This tool follows the standard 90/180 short-stay rule. Visas, residence permits, bilateral agreements and individual circumstances can change what applies. Border authorities make the final decision.
              </p>
            </div>
            <a href="https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en" target="_blank" rel="noreferrer">
              Official EU calculator <ExternalLink size={15} />
            </a>
          </div>
        </section>
      </main>

      <footer>
        <p>Schengen 90/180 calculator</p>
        <p>No sign-up. No dates uploaded.</p>
      </footer>
    </div>
  )
}

export default App

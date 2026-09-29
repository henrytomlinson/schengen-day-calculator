import { useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  Gauge,
  Info,
  Plus,
  RotateCcw,
  Route,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  assessTrip,
  buildOutlook,
  findAllowanceDate,
  formatDay,
  inclusiveDays,
  parseDate,
  type OutlookDay,
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

function formatMonth(day: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(day * 86_400_000))
}

function groupOutlookByMonth(days: OutlookDay[]) {
  const groups = new Map<string, OutlookDay[]>()
  days.forEach((item) => {
    const key = toInputDate(item.day).slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), item])
  })

  return Array.from(groups.values()).map((items) => ({
    label: formatMonth(items[0].day),
    startDay: items[0].day,
    startAllocation: items[0].maxContinuousDays,
    bestAllocation: Math.max(...items.map((item) => item.maxContinuousDays)),
  }))
}

function App() {
  const initialPlan = useMemo(getInitialPlan, [])
  const [plannedEntry, setPlannedEntry] = useState(initialPlan.entry)
  const [plannedExit, setPlannedExit] = useState(initialPlan.exit)
  const [outlookCheckDate, setOutlookCheckDate] = useState(() => {
    const initialExit = parseDate(initialPlan.exit)!
    return toInputDate(initialExit + 1)
  })
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
      return { errors, assessment: null, entry, exit, history }
    }

    return { errors, assessment: assessTrip(history, entry, exit), entry, exit, history }
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
    setOutlookCheckDate(toInputDate(parseDate(plan.exit)! + 1))
    setStays([{ id: newId(), entry: '', exit: '' }])
  }

  const assessment = calculation.assessment
  const statusClass = assessment?.isCompliant ? 'success' : 'danger'
  const usedPercent = assessment ? Math.min(100, (assessment.usedBeforeEntry / 90) * 100) : 0
  const outlook = useMemo(() => {
    if (
      !assessment?.isCompliant ||
      calculation.entry === null ||
      calculation.exit === null
    ) {
      return null
    }

    const committedStays = [
      ...calculation.history,
      { entry: calculation.entry, exit: calculation.exit },
    ]
    const start = calculation.exit + 1
    const days = buildOutlook(committedStays, start, 366)
    const end = days.at(-1)!.day
    const requestedCheckDay = parseDate(outlookCheckDate)
    const checkDay = requestedCheckDay !== null && requestedCheckDay >= start && requestedCheckDay <= end
      ? requestedCheckDay
      : start
    const checked = days[checkDay - start]

    return {
      start,
      end,
      days,
      checked,
      months: groupOutlookByMonth(days),
      milestones: [1, 30, 60, 90].map((minimumDays) => ({
        minimumDays,
        day: findAllowanceDate(days, minimumDays),
      })),
    }
  }, [assessment, calculation.entry, calculation.exit, calculation.history, outlookCheckDate])

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
                  onChange={(event) => {
                    const value = event.target.value
                    setPlannedExit(value)
                    const exitDay = parseDate(value)
                    if (exitDay !== null) setOutlookCheckDate(toInputDate(exitDay + 1))
                  }}
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

        <section className="panel outlook-panel" aria-labelledby="outlook-title">
          <div className="outlook-header">
            <div>
              <p className="eyebrow">Your forward plan</p>
              <h2 id="outlook-title">12-month rolling allowance</h2>
              <p>
                This projection includes your previous stays and the planned trip above, then looks forward from the day after you leave.
              </p>
            </div>
            <BarChart3 size={28} aria-hidden="true" />
          </div>

          {!outlook ? (
            <div className="outlook-unavailable">
              <CircleAlert size={20} />
              <div>
                <h3>Make the planned trip compliant first</h3>
                <p>The forward allowance will appear once the trip above has valid dates and stays within the 90/180-day rule.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="milestone-grid">
                {outlook.milestones.map((milestone) => (
                  <article key={milestone.minimumDays}>
                    <span>{milestone.minimumDays === 1 ? 'Re-enter' : `${milestone.minimumDays} days`}</span>
                    <strong>{milestone.day === null ? 'Beyond this year' : formatDay(milestone.day)}</strong>
                    <small>
                      {milestone.minimumDays === 1
                        ? 'Earliest date with at least one day available'
                        : `Earliest arrival for a continuous ${milestone.minimumDays}-day stay`}
                    </small>
                  </article>
                ))}
              </div>

              <div className="outlook-workspace">
                <article className="allowance-chart-card">
                  <div className="card-title-row">
                    <div>
                      <h3>Continuous stay available by arrival date</h3>
                      <p>Each bar is one day. Higher bars mean a longer uninterrupted stay is possible.</p>
                    </div>
                    <Gauge size={21} aria-hidden="true" />
                  </div>
                  <div className="allowance-chart">
                    <div className="chart-y-axis" aria-hidden="true">
                      <span>90</span><span>60</span><span>30</span><span>0</span>
                    </div>
                    <div className="chart-plot" aria-hidden="true">
                      <div className="chart-grid-line top" />
                      <div className="chart-grid-line middle" />
                      <div className="chart-grid-line lower" />
                      <div className="daily-bars">
                        {outlook.days.map((item) => (
                          <span
                            key={item.day}
                            className={item.maxContinuousDays === 0 ? 'zero' : ''}
                            style={{ height: `${Math.max(2, (item.maxContinuousDays / 90) * 100)}%` }}
                            title={`${formatDay(item.day)}: ${item.maxContinuousDays} days`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="chart-dates">
                    <span>{formatDay(outlook.start)}</span>
                    <span>{formatDay(outlook.end)}</span>
                  </div>
                </article>

                <article className="date-checker">
                  <div className="card-title-row">
                    <div>
                      <h3>Check an exact future date</h3>
                      <p>Choose any arrival in the next year.</p>
                    </div>
                    <Route size={21} aria-hidden="true" />
                  </div>
                  <label>
                    <span>Future arrival</span>
                    <input
                      type="date"
                      min={toInputDate(outlook.start)}
                      max={toInputDate(outlook.end)}
                      value={toInputDate(outlook.checked.day)}
                      onChange={(event) => setOutlookCheckDate(event.target.value)}
                    />
                  </label>
                  <div className="checked-allocation">
                    <span>Maximum continuous stay</span>
                    <strong>{outlook.checked.maxContinuousDays} days</strong>
                    <p>
                      {outlook.checked.latestDeparture
                        ? `If you arrive on ${formatDay(outlook.checked.day)}, stay through ${formatDay(outlook.checked.latestDeparture)} at the latest.`
                        : `No Schengen day is available on ${formatDay(outlook.checked.day)}.`}
                    </p>
                  </div>
                  <dl className="checker-detail">
                    <div><dt>Entry-day balance</dt><dd>{outlook.checked.entryBalance} days</dd></div>
                    <div><dt>Projection includes</dt><dd>History + planned trip</dd></div>
                  </dl>
                  <p className="rolling-hint">
                    Your maximum stay can be higher than the entry-day balance because older travel days may expire while you are there.
                  </p>
                </article>
              </div>

              <div className="monthly-outlook">
                <div className="card-title-row">
                  <div>
                    <h3>Month-by-month guide</h3>
                    <p>Start shows the allowance on the first visible day of each month; best is the highest allowance reached that month.</p>
                  </div>
                </div>
                <div className="monthly-table-wrap">
                  <table>
                    <thead><tr><th>Month</th><th>From</th><th>Start</th><th>Best</th></tr></thead>
                    <tbody>
                      {outlook.months.map((month) => (
                        <tr key={month.label}>
                          <th scope="row">{month.label}</th>
                          <td>{formatDay(month.startDay)}</td>
                          <td>{month.startAllocation} days</td>
                          <td><strong>{month.bestAllocation} days</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

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

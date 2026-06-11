import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'

type Subcase = {
  id: string
  title: string
  steps: string[]
}

type TestCase = {
  id: string
  section: string
  title: string
  category: string
  tags: string[]
  steps?: string[]
  subcases?: Subcase[]
  help?: string
  helpRefs?: string[]
  recommended?: boolean
}

type HelpDoc = {
  id: string
  title: string
  path: string
  text: string
  tags: string[]
}

type CaseView = 'dashboard' | 'category' | 'detail' | 'help'
type Theme = 'light' | 'dark'

const modules = import.meta.glob<{ default: TestCase | TestCase[] }>('./data/*.json', {
  eager: true,
})

const allCases = Object.values(modules).flatMap(({ default: payload }) =>
  Array.isArray(payload) ? payload : [payload],
)

const helpModules = import.meta.glob<{ default: HelpDoc | HelpDoc[] }>('./data/help/*.json', {
  eager: true,
})

const allHelpDocs = Object.values(helpModules).flatMap(({ default: payload }) =>
  Array.isArray(payload) ? payload : [payload],
)

const helpById = new Map(allHelpDocs.map((doc) => [doc.id, doc]))

function resolveHelpDocs(testCase: TestCase): HelpDoc[] {
  return (testCase.helpRefs ?? [])
    .map((ref) => helpById.get(ref) ?? allHelpDocs.find((doc) => doc.path === ref))
    .filter((doc): doc is HelpDoc => Boolean(doc))
}

const PROGRESS_KEY = 'ee-learning-progress-v1'
const THEME_KEY = 'ee-learning-theme'

const defaultCategory = [...new Set(allCases.map((item) => item.category))].sort()[0] ?? 'General'

function normalize(value: string): string {
  return value.toLowerCase().trim()
}

function includesTerm(caseData: TestCase, term: string): boolean {
  if (!term) {
    return true
  }

  const haystacks = [
    caseData.title,
    caseData.section,
    caseData.category,
    ...caseData.tags,
    ...(caseData.steps ?? []),
    ...(caseData.subcases ?? []).flatMap((subcase) => [subcase.title, ...subcase.steps]),
  ]

  return haystacks.some((value) => normalize(value).includes(term))
}

function helpIncludesTerm(doc: HelpDoc, term: string): boolean {
  if (!term) {
    return true
  }

  return [doc.title, doc.text, ...doc.tags].some((value) => normalize(value).includes(term))
}

function stepGroups(caseData: TestCase): Array<{ id: string; title: string; steps: string[] }> {
  if (caseData.subcases?.length) {
    return caseData.subcases
  }

  return [
    {
      id: `${caseData.section}-main`,
      title: 'Main Steps',
      steps: caseData.steps ?? [],
    },
  ]
}

function highlightText(content: string, term: string): ReactNode {
  if (!term) {
    return <>{content}</>
  }

  const matcher = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
  const chunks = content.split(matcher)

  return (
    <>
      {chunks.map((chunk, index) => (
        <Fragment key={`${chunk}-${index}`}>
          {normalize(chunk) === normalize(term) ? <mark className="rounded px-1">{chunk}</mark> : chunk}
        </Fragment>
      ))}
    </>
  )
}

function App() {
  const [view, setView] = useState<CaseView>('dashboard')
  const [activeCategory, setActiveCategory] = useState(defaultCategory)
  const [activeCaseId, setActiveCaseId] = useState(allCases[0]?.id ?? '')
  const [activeHelpId, setActiveHelpId] = useState(allHelpDocs[0]?.id ?? '')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortMode, setSortMode] = useState<'section' | 'title'>('section')
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })
  const [progress, setProgress] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem(PROGRESS_KEY)
    return stored ? (JSON.parse(stored) as Record<string, boolean>) : {}
  })

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  }, [progress])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const term = normalize(searchTerm)

  const filteredCases = useMemo(
    () => allCases.filter((testCase) => includesTerm(testCase, term)),
    [term],
  )

  const categories = useMemo(() => {
    return [...new Set(allCases.map((testCase) => testCase.category))].sort()
  }, [])

  const categoryCases = useMemo(() => {
    const target = filteredCases.filter((testCase) => testCase.category === activeCategory)
    return [...target].sort((a, b) => {
      if (sortMode === 'title') {
        return a.title.localeCompare(b.title)
      }
      return a.section.localeCompare(b.section, undefined, { numeric: true })
    })
  }, [activeCategory, filteredCases, sortMode])

  const selectedCase = allCases.find((testCase) => testCase.id === activeCaseId)
  const recommendedCases = filteredCases.filter((testCase) => testCase.recommended)

  const filteredHelpDocs = useMemo(
    () => allHelpDocs.filter((doc) => helpIncludesTerm(doc, term)),
    [term],
  )

  const selectedHelpDoc = allHelpDocs.find((doc) => doc.id === activeHelpId)

  const totals = useMemo(() => {
    return allCases.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1
      return acc
    }, {})
  }, [])

  const completedSteps = useMemo(() => {
    return Object.values(progress).filter(Boolean).length
  }, [progress])

  const totalSteps = useMemo(() => {
    return allCases.reduce((sum, testCase) => {
      return (
        sum +
        (testCase.subcases?.reduce((count, subcase) => count + subcase.steps.length, 0) ??
          testCase.steps?.length ??
          0)
      )
    }, 0)
  }, [])

  const openCase = (id: string) => {
    setActiveCaseId(id)
    setView('detail')
  }

  const openHelp = (id: string) => {
    setActiveHelpId(id)
    setView('help')
  }

  const toggleStep = (key: string) => {
    setProgress((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-8">
        <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">EE Learning Dashboard</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Learn ACCE/EE test cases with searchable steps and progress tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setView('dashboard')}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setView('category')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Category
            </button>
            <button
              type="button"
              onClick={() => setView('help')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Help Center
            </button>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, tag, or steps..."
              className="min-w-52 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Progress: {completedSteps}/{totalSteps} steps completed
          </div>
        </header>

        {view === 'dashboard' && (
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <h2 className="mb-3 text-lg font-semibold">Categories</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category)
                      setView('category')
                    }}
                    className="rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <div className="font-semibold">{category}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">{totals[category]} test cases</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-lg font-semibold">Recommended</h2>
              <ul className="space-y-2">
                {recommendedCases.map((testCase) => (
                  <li key={testCase.id}>
                    <button
                      type="button"
                      onClick={() => openCase(testCase.id)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-left hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <p className="text-sm text-slate-600 dark:text-slate-300">{testCase.section}</p>
                      <p className="font-medium">{highlightText(testCase.title, term)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {term && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
                <h2 className="mb-3 text-lg font-semibold">Search Results by Category</h2>
                {categories.map((category) => {
                  const matches = filteredCases.filter((testCase) => testCase.category === category)
                  if (!matches.length) {
                    return null
                  }
                  return (
                    <div key={category} className="mb-4">
                      <h3 className="mb-2 font-semibold">{category}</h3>
                      <div className="space-y-2">
                        {matches.map((testCase) => (
                          <button
                            key={testCase.id}
                            type="button"
                            onClick={() => openCase(testCase.id)}
                            className="w-full rounded-lg border border-slate-200 p-2 text-left hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            {testCase.section} - {highlightText(testCase.title, term)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {filteredHelpDocs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 font-semibold">Help Documents</h3>
                    <div className="space-y-2">
                      {filteredHelpDocs.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => openHelp(doc.id)}
                          className="w-full rounded-lg border border-slate-200 p-2 text-left hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          {highlightText(doc.title, term)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {view === 'category' && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Category: {activeCategory}</h2>
              <select
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as 'section' | 'title')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="section">Sort by section</option>
                <option value="title">Sort by title</option>
              </select>
            </div>

            <div className="space-y-3">
              {categoryCases.map((testCase) => (
                <button
                  key={testCase.id}
                  type="button"
                  onClick={() => openCase(testCase.id)}
                  className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <p className="text-sm text-slate-600 dark:text-slate-300">{testCase.section}</p>
                  <h3 className="font-semibold">{highlightText(testCase.title, term)}</h3>
                  <p className="text-sm">Tags: {testCase.tags.join(', ')}</p>
                </button>
              ))}
              {!categoryCases.length && <p className="text-sm text-slate-500">No matching test cases.</p>}
            </div>
          </section>
        )}

        {view === 'detail' && selectedCase && (
          <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setView('category')}
                className="mb-3 rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                ← Back to Category
              </button>
              <h2 className="text-xl font-semibold">
                {selectedCase.section} - {selectedCase.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Category: {selectedCase.category} | Tags: {selectedCase.tags.join(', ')}
              </p>
              {selectedCase.help && (
                <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950 dark:bg-indigo-950 dark:text-indigo-100">
                  Help: {selectedCase.help}
                </p>
              )}

              <div className="mt-4 space-y-5">
                {stepGroups(selectedCase).map((group) => (
                  <section key={group.id} id={group.id}>
                    <h3 className="mb-2 font-semibold">{group.title}</h3>
                    <ol className="space-y-2">
                      {group.steps.map((step, index) => {
                        const stepKey = `${selectedCase.id}:${group.id}:${index}`
                        return (
                          <li key={stepKey} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                            <label className="flex gap-3">
                              <input
                                type="checkbox"
                                checked={Boolean(progress[stepKey])}
                                onChange={() => toggleStep(stepKey)}
                                className="mt-1"
                              />
                              <span className={progress[stepKey] ? 'line-through opacity-70' : ''}>
                                {highlightText(step, term)}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            </article>

            <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 font-semibold">Subcase Navigation</h3>
              <ul className="space-y-2">
                {stepGroups(selectedCase).map((group) => (
                  <li key={`nav-${group.id}`}>
                    <a
                      href={`#${group.id}`}
                      className="block rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      {group.title}
                    </a>
                  </li>
                ))}
              </ul>

              {resolveHelpDocs(selectedCase).length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 font-semibold">Related Help</h3>
                  <ul className="space-y-2">
                    {resolveHelpDocs(selectedCase).map((doc) => (
                      <li key={`help-${doc.id}`}>
                        <button
                          type="button"
                          onClick={() => openHelp(doc.id)}
                          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          📖 {doc.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </section>
        )}

        {view === 'help' && (
          <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-lg font-semibold">Help Center</h2>
              <ul className="space-y-2">
                {filteredHelpDocs.map((doc) => (
                  <li key={`center-${doc.id}`}>
                    <button
                      type="button"
                      onClick={() => setActiveHelpId(doc.id)}
                      className={`block w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 ${
                        doc.id === activeHelpId
                          ? 'border-indigo-400 bg-indigo-50 dark:bg-slate-800'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {highlightText(doc.title, term)}
                    </button>
                  </li>
                ))}
                {!filteredHelpDocs.length && (
                  <li className="text-sm text-slate-500">No matching help documents.</li>
                )}
              </ul>
            </aside>

            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              {selectedHelpDoc ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">{selectedHelpDoc.title}</h2>
                    <a
                      href={`${import.meta.env.BASE_URL}${selectedHelpDoc.path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                  <iframe
                    title={selectedHelpDoc.title}
                    src={`${import.meta.env.BASE_URL}${selectedHelpDoc.path}`}
                    className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">No help documents available yet.</p>
              )}
            </article>
          </section>
        )}
      </div>
    </main>
  )
}

export default App

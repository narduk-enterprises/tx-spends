export const INVESTIGATION_TOPIC_STATUSES = [
  'backlog',
  'reporting',
  'drafting',
  'published',
  'parked',
] as const

export const INVESTIGATION_TOPIC_IMPACTS = ['medium', 'medium_high', 'high', 'very_high'] as const

export const INVESTIGATION_TOPIC_DIFFICULTIES = ['medium', 'medium_high', 'high'] as const

export type InvestigationTopicStatus = (typeof INVESTIGATION_TOPIC_STATUSES)[number]
export type InvestigationTopicImpact = (typeof INVESTIGATION_TOPIC_IMPACTS)[number]
export type InvestigationTopicDifficulty = (typeof INVESTIGATION_TOPIC_DIFFICULTIES)[number]

export interface InvestigationSourceReference {
  label: string
  note: string
  url: string | null
}

export interface DefaultInvestigationTopic {
  slug: string
  title: string
  priorityRank: number
  lane: string
  flaggedPattern: string
  impact: InvestigationTopicImpact
  difficulty: InvestigationTopicDifficulty
  summary: string
  investigativeQuestion: string
  publicImpact: string
  notes: string
  sourceReferences: InvestigationSourceReference[]
  recordsToObtain: string[]
  reportingSteps: string[]
  visualIdeas: string[]
}

const EXPLANATION_FIRST_NOTE =
  'Treat each topic as an accountability lead, not an allegation. Start by testing whether routine accounting, grant pass-through, privacy rules, or finance mechanics fully explain the pattern before escalating the framing.'

const RECORDS_FIRST_NOTE =
  'Favor primary records first: Texas Transparency payment metadata, object codes, agency contracts or grant files, board materials, audits, and targeted Public Information Act requests.'

export const DEFAULT_INVESTIGATION_TOPICS: DefaultInvestigationTopic[] = [
  {
    slug: 'tdem-fy2026-spending-surge-explained',
    title:
      'The FY2026 spending surge at the Texas Division of Emergency Management: new programs, new pass-throughs, or new accounting?',
    priorityRank: 1,
    lane: 'Emergency/grants',
    flaggedPattern: 'Year-over-year surge',
    impact: 'very_high',
    difficulty: 'medium_high',
    summary:
      'A large year-over-year jump at TDEM may reflect federal grant pass-throughs, new emergency programs, or accounting changes rather than a simple growth in direct state operations.',
    investigativeQuestion:
      'What specific programs and funding streams best explain the FY2025 to FY2026 jump, and how much of the increase is pass-through to local governments versus direct state operations?',
    publicImpact:
      'This can show taxpayers whether a headline surge is actually federal money moving through the state and which local jurisdictions ultimately benefited.',
    notes: `${EXPLANATION_FIRST_NOTE} ${RECORDS_FIRST_NOTE} Compare seasonal disbursement patterns before treating the jump as a structural spending change.`,
    sourceReferences: [
      {
        label: 'Texas Transparency payments and agency dashboards',
        note: 'Use payment metadata and object codes to split grants, reimbursements, payroll, and capital flows.',
        url: null,
      },
      {
        label: 'TDEM program pages',
        note: 'Crosswalk major grant programs, including ARPA and resilience-related pass-through roles.',
        url: null,
      },
      {
        label: 'USAspending.gov federal award records',
        note: 'Confirm federal award sources and timing for pass-through programs.',
        url: null,
      },
      {
        label: 'Legislative Budget Board budget materials',
        note: 'Use appropriations requests and riders to identify program expansions or accounting changes.',
        url: null,
      },
    ],
    recordsToObtain: [
      'TDEM Legislative Appropriations Request sections covering grant portfolios and pass-through responsibilities.',
      'Appropriations riders tied to disaster, mitigation, or federal pass-through programs.',
      'Any year-over-year finance memos explaining changes in program structure or accounting treatment.',
    ],
    reportingSteps: [
      'Identify which payees and object categories dominate the new totals.',
      'Match large TDEM flows to federal awards and named programs.',
      'Compare quarterly timing to determine whether the surge is seasonal grant distribution.',
      'Interview finance and program staff about accounting changes versus new funding streams.',
    ],
    visualIdeas: [
      'FY2025 to FY2026 waterfall chart by object category.',
      'Federal-to-state-to-local Sankey for major pass-through programs.',
      'County-level map using aggregated expenditure outputs where the data supports it.',
    ],
  },
  {
    slug: 'bny-mellon-short-term-investment-payment',
    title:
      'A $1.29B payment to The Bank of New York Mellon: how pension cash moves through custodians, investment pools, and object codes',
    priorityRank: 2,
    lane: 'Treasury/investment plumbing',
    flaggedPattern: 'Largest single transfer',
    impact: 'high',
    difficulty: 'medium',
    summary:
      'A giant payment tagged as a purchase of short-term investments may be ordinary investment settlement or cash management, but it looks like a vendor payment in raw transparency data.',
    investigativeQuestion:
      'Is the large BNY Mellon payment best understood as routine investment settlement and cash management, and what public records can prove that?',
    publicImpact:
      'This story can separate financial plumbing from procurement while still surfacing any timing or documentation gaps worth scrutiny.',
    notes: `${EXPLANATION_FIRST_NOTE} Focus on object code 7713 treatment, custodian roles, and board-approved investment activity before framing this as procurement.`,
    sourceReferences: [
      {
        label: 'Texas Transparency payments to payee data',
        note: 'Confirm transaction timing, payee naming, and associated object codes.',
        url: null,
      },
      {
        label: 'Comptroller object code definitions',
        note: 'Use object code guidance to explain why investment purchases can appear in spending data.',
        url: null,
      },
      {
        label: 'Employees Retirement System board and investment materials',
        note: 'Look for custodian contracts, cash-management discussions, and short-term fund activity.',
        url: null,
      },
    ],
    recordsToObtain: [
      'ERS investment policy statements and custodian contracts.',
      'Board agenda packets tied to the transaction window.',
      'Any accounting memos describing custodian transfers and object code usage.',
    ],
    reportingSteps: [
      'Reconstruct the payment cluster by date and amount.',
      'Match the transaction window to quarter-end, rebalancing, or short-term investment actions.',
      'Verify whether the flow represents treasury cash movement rather than goods or services.',
      'Interview pension finance staff or investment officers on the custody mechanics.',
    ],
    visualIdeas: [
      'Annotated payment timeline around the transaction date.',
      'Explainer diagram showing pension cash moving to a custodian and short-term fund.',
      'Sidebar glossary for relevant Comptroller object codes.',
    ],
  },
  {
    slug: 'superior-healthplan-billions-in-hhsc',
    title:
      'Large payee, narrow agency footprint: why Medicaid managed care concentrates billions inside HHSC',
    priorityRank: 3,
    lane: 'Medicaid managed care',
    flaggedPattern: 'Narrow agency footprint',
    impact: 'very_high',
    difficulty: 'medium',
    summary:
      'Superior HealthPlan’s multi-billion-dollar totals likely reflect Medicaid managed care payment structures centered in HHSC, but readers need the contract and rate-setting context to interpret those totals.',
    investigativeQuestion:
      'What is the best public explanation for Superior HealthPlan’s large payment totals being concentrated in HHSC, and how have those totals shifted year to year?',
    publicImpact:
      'This can make one of the state’s highest-dollar spending lanes legible without implying wrongdoing where ordinary capitation structures explain the concentration.',
    notes: `${EXPLANATION_FIRST_NOTE} Build an explanation model around capitation, enrollment, and rate-setting before focusing on anomalies or enforcement.`,
    sourceReferences: [
      {
        label: 'HHSC managed care contract pages',
        note: 'Use contract records, amendments, and oversight materials as the primary frame.',
        url: null,
      },
      {
        label: 'Texas State Auditor reports on Medicaid managed care',
        note: 'Use audits to understand rate-setting and oversight risks.',
        url: null,
      },
      {
        label: 'Texas Transparency payee views',
        note: 'Quantify payee totals, timing, and object code patterns.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Managed care contracts and amendments for Superior HealthPlan.',
      'Actuarial rate-setting and program expansion documentation.',
      'Public enforcement, sanctions, or oversight reports tied to the plan.',
    ],
    reportingSteps: [
      'Model annual capitation totals against enrollment and program scope.',
      'Tie payment timing to contract periods and major amendments.',
      'Review sanctions and whether they had measurable financial effects.',
      'Interview procurement or policy staff about how payments are structured.',
    ],
    visualIdeas: [
      'Stacked annual totals by program line.',
      'Contract timeline with amendment markers.',
      'Service-area map if the data is publicly documented.',
    ],
  },
  {
    slug: 'molina-payments-contract-amendments',
    title:
      'The other mega-payee: tracing Molina Healthcare of Texas through contracts, amendments, and payment patterns',
    priorityRank: 4,
    lane: 'Medicaid managed care',
    flaggedPattern: 'Narrow agency footprint',
    impact: 'very_high',
    difficulty: 'medium',
    summary:
      'Molina’s large HHSC totals invite the same questions as Superior’s, but a separate amendment and timing review can show whether documented contract changes explain the payment pattern.',
    investigativeQuestion:
      'Do Molina payment totals and timing align with contract periods, amendments, and enrollment or rate-setting cycles, and where do public records verify the structure?',
    publicImpact:
      'Readers get a cleaner view of whether payment surprises reflect documentation gaps or a real deviation from contract mechanics.',
    notes: `${EXPLANATION_FIRST_NOTE} Build a contract-amendment ledger and map changes to payment timing before writing about unexplained spikes.`,
    sourceReferences: [
      {
        label: 'HHSC contract PDFs and amendments',
        note: 'Use the amendment chain to identify changed ceilings, terms, and effective dates.',
        url: null,
      },
      {
        label: 'State auditor oversight reports',
        note: 'Add context on managed care controls and recurrent weaknesses.',
        url: null,
      },
      {
        label: 'Texas Transparency payment data',
        note: 'Measure timing, scale, and agency concentration.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Molina managed care contract and amendment chain.',
      'Public rate-setting or actuarial support documents.',
      'Any enforcement notices or corrective action records tied to Molina.',
    ],
    reportingSteps: [
      'Create a ledger of amendments, effective dates, and changed terms.',
      'Map large payment clusters against amendment and rate-change dates.',
      'Compare Molina timing to other managed care organizations for context.',
      'Interview contract staff about routine adjustments versus exceptional events.',
    ],
    visualIdeas: [
      'Contract amendment ladder graphic.',
      'Calendar heatmap of payment dates.',
      'Small multiples comparing Molina to peer plans.',
    ],
  },
  {
    slug: 'hhsc-sanctions-and-money',
    title: 'When enforcement has teeth: do HHSC sanctions change the money?',
    priorityRank: 5,
    lane: 'Oversight/enforcement',
    flaggedPattern: 'Compliance vs dollars',
    impact: 'high',
    difficulty: 'medium_high',
    summary:
      'HHSC publishes sanctions and enforcement actions, but it is not obvious whether those actions materially alter payment flows, contract terms, or public performance outcomes.',
    investigativeQuestion:
      'For managed care payees, is there a visible relationship between enforcement actions and changes in payment flow, contract terms, or public performance metrics?',
    publicImpact:
      'This tests whether oversight mechanisms change real money or remain mostly procedural.',
    notes: `${EXPLANATION_FIRST_NOTE} Use event-study style comparisons and rule out enrollment or rate changes before attributing any payment shift to sanctions.`,
    sourceReferences: [
      {
        label: 'HHSC sanctions and enforcement pages',
        note: 'Build the event timeline from official sanctions notices and corrective actions.',
        url: null,
      },
      {
        label: 'State auditor managed care oversight work',
        note: 'Use prior findings to frame what sanctions are supposed to accomplish.',
        url: null,
      },
      {
        label: 'Texas Transparency payment timing',
        note: 'Measure whether sanctions line up with payment or status changes.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Sanctions notices and corrective action requirements.',
      'Contract clauses governing liquidated damages, withholds, or remedies.',
      'Any settlement or corrective action monitoring records that are public.',
    ],
    reportingSteps: [
      'Build a sanctions timeline for targeted managed care organizations.',
      'Compare payment variance before and after each enforcement action.',
      'Test alternative explanations such as enrollment swings and rate changes.',
      'Request clarifying records where financial consequences are unclear.',
    ],
    visualIdeas: [
      'Dual-axis chart for sanctions dates versus payment totals.',
      'Clause callouts showing contract remedies.',
      'Simple event-study timeline for each plan.',
    ],
  },
  {
    slug: 'vendors-and-texas-campaign-finance-overlap',
    title:
      'Campaign finance meets procurement: do top state payees also show up in Texas political money?',
    priorityRank: 6,
    lane: 'Money-in-politics',
    flaggedPattern: 'COI / influence links',
    impact: 'medium_high',
    difficulty: 'medium',
    summary:
      'Large public payees may also appear in state campaign finance data, but entity matching is messy and the available disclosures have important coverage limits.',
    investigativeQuestion:
      'Do major vendors or contract counterparties tied to flagged spending leads appear as contributors, employers of contributors, or related entities in campaign finance data, and what limitations matter?',
    publicImpact:
      'Readers get a transparent view of possible influence pathways without overstating what campaign finance data can prove.',
    notes: `${EXPLANATION_FIRST_NOTE} Use cautious entity resolution and be explicit that shared names do not prove shared control or influence.`,
    sourceReferences: [
      {
        label: 'Texas Ethics Commission campaign finance database',
        note: 'Search electronic filings, downloadable data, and filer-level reports.',
        url: null,
      },
      {
        label: 'Texas Secretary of State business records',
        note: 'Confirm entity identity, principals, and registered agents.',
        url: null,
      },
      {
        label: 'Vendor or contract records tied to the flagged leads',
        note: 'Use contract IDs and payee identity work to narrow the finance search.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Relevant TEC report PDFs for high-confidence matches.',
      'SOSDirect or equivalent entity records for candidate vendors.',
      'Any internal ownership or affiliate information available in contract paperwork.',
    ],
    reportingSteps: [
      'Resolve vendor identity cautiously before matching to donors or PACs.',
      'Separate state-level TEC data from local filings and coverage gaps.',
      'Map executive, PAC, or employer links only where the entity match is strong.',
      'Add explanatory context to avoid insinuating quid pro quo from correlation alone.',
    ],
    visualIdeas: [
      'Network diagram with confidence labels.',
      'Coverage explainer showing what TEC includes and omits.',
      'Top vendors versus contribution activity matrix.',
    ],
  },
  {
    slug: 'form-1295-interested-parties-map',
    title:
      'Who’s listed on Form 1295? Using contract-interest disclosures to map interested parties around high-value deals',
    priorityRank: 7,
    lane: 'Contract transparency',
    flaggedPattern: 'COI disclosure',
    impact: 'medium_high',
    difficulty: 'medium',
    summary:
      'Form 1295 disclosures can identify interested parties around high-value contracts more directly than campaign finance data, but only if the contracts and certificates are matched correctly.',
    investigativeQuestion:
      'For large contracts tied to the flagged leads, what interested parties are disclosed on Form 1295 filings, and how often are filings missing or delayed?',
    publicImpact:
      'This gives readers a practical disclosure tool for seeing who is formally connected to major contracts.',
    notes: `${RECORDS_FIRST_NOTE} Prioritize contract-to-certificate matching and acknowledgment timing before drawing broader conflict conclusions.`,
    sourceReferences: [
      {
        label: 'Texas Ethics Commission Form 1295 search',
        note: 'Search acknowledged certificates and their timing.',
        url: null,
      },
      {
        label: 'Legislative Budget Board and Comptroller contract databases',
        note: 'Use contract IDs, agencies, and vendors to match certificates to deals.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Acknowledged Form 1295 certificates for relevant contracts.',
      'Underlying contract texts and contract IDs.',
      'Agency workflow or compliance guidance on certificate acknowledgment.',
    ],
    reportingSteps: [
      'Build a match table from contract IDs to Form 1295 certificates.',
      'Measure missing, late, or hard-to-find certificates for high-dollar contracts.',
      'Interview contracting staff on acknowledgment workflows and exceptions.',
      'Highlight where disclosure exists but is difficult for ordinary users to connect.',
    ],
    visualIdeas: [
      'Interactive table of contracts and certificates.',
      'Flowchart showing how Form 1295 is supposed to work.',
      'Timeline of contract execution versus certificate acknowledgment.',
    ],
  },
  {
    slug: 'arpa-clfrf-neu-distributions-via-tdem',
    title:
      'The grant pass-through that reshaped the ledger: tracking ARPA Fiscal Recovery Funds distributed via TDEM to small cities',
    priorityRank: 8,
    lane: 'Federal→local pipeline',
    flaggedPattern: 'Pass-through grants',
    impact: 'high',
    difficulty: 'medium_high',
    summary:
      'TDEM distributed ARPA fiscal recovery funds to non-entitlement units, creating large state-led grant flows that may look like agency spending growth in raw ledgers.',
    investigativeQuestion:
      'Which Texas local governments received ARPA fiscal recovery funds via TDEM, and are there notable patterns in distribution timing or amounts?',
    publicImpact:
      'This clarifies one of the most consequential federal-to-local funding pipelines and which communities received what.',
    notes: `${EXPLANATION_FIRST_NOTE} Use program rules and recipient lists to distinguish formula-driven distribution from discretionary grant behavior.`,
    sourceReferences: [
      {
        label: 'TDEM CLFRF program materials',
        note: 'Confirm TDEM’s role in distributing non-entitlement unit funding.',
        url: null,
      },
      {
        label: 'USAspending federal award data',
        note: 'Cross-check award lineage and funding context.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Recipient lists and disbursement schedules for non-entitlement units.',
      'Methodology or allocation guidance for the program.',
      'Any communications explaining timing gaps or reissued payments.',
    ],
    reportingSteps: [
      'Build a clean recipient list for all documented NEU distributions.',
      'Compare allocations to program formulas and population thresholds.',
      'Identify outliers in timing or amounts for targeted records requests.',
      'Interview local recipients about how the funds were received and used.',
    ],
    visualIdeas: [
      'Choropleth map of NEU distributions.',
      'Timeline of TDEM disbursement waves.',
      'Federal-to-state-to-local Sankey.',
    ],
  },
  {
    slug: 'doe-grid-resilience-grant-pipeline',
    title: 'Federal resilience dollars: the DOE grid grant pipeline administered by TDEM',
    priorityRank: 9,
    lane: 'Mitigation/resilience',
    flaggedPattern: 'Federal formula grants',
    impact: 'high',
    difficulty: 'high',
    summary:
      'TDEM’s role in administering grid resilience money creates an accountability opportunity around who applies, who wins, and whether the funded projects align with risk and need.',
    investigativeQuestion:
      'Who applies for and receives grid resilience funds managed through TDEM, what categories of projects are funded, and what records support oversight?',
    publicImpact:
      'This can test whether resilience dollars follow risk, geography, and stated program goals.',
    notes: `${RECORDS_FIRST_NOTE} Because evaluation criteria may be technical, pair award data with risk context carefully and label contextual maps as non-causal.`,
    sourceReferences: [
      {
        label: 'TDEM DOE grid resilience grant materials',
        note: 'Use the official program description and application guidance.',
        url: null,
      },
      {
        label: 'USAspending federal award context',
        note: 'Cross-check federal assistance structures and award lineage.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Application guidelines, scoring criteria, and awardee lists.',
      'Project descriptions and reimbursement or draw documentation.',
      'Any public evaluation summaries or reviewer materials.',
    ],
    reportingSteps: [
      'Build a dataset of awardees, project types, and award sizes.',
      'Compare awards to grid risk, outage, or hazard exposure context.',
      'Check whether smaller or rural jurisdictions are underrepresented.',
      'Ask TDEM how applications were evaluated and monitored.',
    ],
    visualIdeas: [
      'Awardee map over grid risk context.',
      'Bar chart by project category and award size.',
      'Award pipeline diagram from application to reimbursement.',
    ],
  },
  {
    slug: 'mutual-aid-reimbursement-ledger',
    title:
      'Mutual aid reimbursements: who gets paid back for deployments, and how are amounts calculated?',
    priorityRank: 10,
    lane: 'Emergency response costs',
    flaggedPattern: 'Reimbursement flows',
    impact: 'medium_high',
    difficulty: 'medium_high',
    summary:
      'Emergency deployment reimbursements move significant sums across governments, but the mission-to-payment trail is not obvious in public-facing spending tools.',
    investigativeQuestion:
      'Do reimbursements for in-state and out-of-state missions align with public mission descriptions and reimbursement rules?',
    publicImpact:
      'This helps local agencies and the public understand who bears the cost of deployments and how the state settles those costs.',
    notes: `${EXPLANATION_FIRST_NOTE} Focus on calculation rules, caps, and mission documentation before treating reimbursement size alone as suspicious.`,
    sourceReferences: [
      {
        label: 'TDEM mutual aid reimbursement guidance',
        note: 'Use official reimbursement descriptions and contact points.',
        url: null,
      },
      {
        label: 'Texas Transparency payment data',
        note: 'Find visible reimbursement transactions and timing clusters.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Mission assignment lists and reimbursement worksheets.',
      'Policies governing eligibility, caps, and documentation.',
      'Aggregate reimbursement totals by year or event.',
    ],
    reportingSteps: [
      'Select a sample of missions and identify reimbursed entities.',
      'Compare claimed costs to documented reimbursement rules.',
      'Trace mission dates to reimbursement timing in state payment data.',
      'Interview deployed jurisdictions about delays or partial reimbursement.',
    ],
    visualIdeas: [
      'Mission-to-payment flow diagram.',
      'Table of deployments and reimbursements.',
      'Time series around major disasters.',
    ],
  },
  {
    slug: 'paccar-financial-tceq-assignment-mechanics',
    title:
      'Why is a truck finance company being paid by an environmental agency? Decoding TCEQ reimbursement assignments',
    priorityRank: 11,
    lane: 'Environmental incentives',
    flaggedPattern: 'Repeat-dollar cluster',
    impact: 'medium',
    difficulty: 'medium',
    summary:
      'Repeated exact-dollar payments to PACCAR Financial may be ordinary reimbursement assignments under equipment finance or leasing rules, but the public-facing data does not explain that.',
    investigativeQuestion:
      'Is the simplest explanation that TCEQ reimbursements were assigned to a financing or leasing company under program rules, and what paperwork would verify it?',
    publicImpact:
      'This can prevent misleading vendor-payment narratives while still testing whether the assignment process protects grant recipients and is transparently documented.',
    notes: `${EXPLANATION_FIRST_NOTE} Start with TERP reimbursement rules and assignment forms before describing PACCAR as a conventional vendor.`,
    sourceReferences: [
      {
        label: 'TCEQ reimbursement instructions',
        note: 'Look for assignment-to-lessor or assignment-to-finance-company guidance.',
        url: null,
      },
      {
        label: 'TERP program overview materials',
        note: 'Use the official grant structure to explain why finance-company payments can occur.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Grant contracts and reimbursement request forms showing assignment.',
      'Evidence that payments were credited against loans or leases.',
      'Any program guidance sent to recipients or lessors on assignment mechanics.',
    ],
    reportingSteps: [
      'Identify the exact TERP sub-program tied to the payments.',
      'Confirm whether the payments are reimbursements rather than procurements.',
      'Interview recipients and finance counterparties on how the credits post.',
      'Compare PACCAR patterns with other lessors or finance companies in the same program.',
    ],
    visualIdeas: [
      'Recipient-to-lessor reimbursement explainer.',
      'Cadence chart showing repeated exact-dollar amounts.',
      'Simple comparison of direct-pay versus assigned reimbursements.',
    ],
  },
  {
    slug: 'terp-repeat-dollar-clusters',
    title:
      'TERP payment mechanics: do reimbursement schedules create repeat-dollar clusters that look suspicious in raw spending data?',
    priorityRank: 12,
    lane: 'Program mechanics',
    flaggedPattern: 'Repeat-dollar clusters',
    impact: 'medium',
    difficulty: 'medium',
    summary:
      'Repeated exact-dollar TERP payments may simply reflect program reimbursement design, and quantifying how common those patterns are could separate normal program behavior from real anomalies.',
    investigativeQuestion:
      'Across TERP programs, how often do reimbursements follow standardized amounts or cadence, and how should transparency datasets label these payments to reduce confusion?',
    publicImpact:
      'This can improve transparency quality by showing which repeat-dollar clusters are routine program mechanics and which still stand out after context.',
    notes: `${RECORDS_FIRST_NOTE} Classify payee type first: recipient, dealer, lessor, or finance company. That split matters more than amount repetition alone.`,
    sourceReferences: [
      {
        label: 'TCEQ TERP program pages and reimbursement guidance',
        note: 'Use published rules and payment structures to explain cadence.',
        url: null,
      },
      {
        label: 'Texas Transparency payment data',
        note: 'Measure how often repeat-dollar clusters occur and who receives them.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Program RFGAs and contract templates.',
      'Guidance on reimbursement percentages and timing.',
      'A representative sample of TERP reimbursement files.',
    ],
    reportingSteps: [
      'Classify TERP payees by recipient type for a sample year.',
      'Quantify repeat-amount frequency and recurring cadence.',
      'Compare patterns across TERP sub-programs.',
      'Recommend clearer labels based on the documented payment mechanics.',
    ],
    visualIdeas: [
      'Histogram of TERP payment amounts.',
      'Boxplots by TERP sub-program.',
      'Who-gets-paid breakdown by recipient type.',
    ],
  },
  {
    slug: 'confidential-spending-spikes-at-universities',
    title:
      'Confidential spending spikes at universities: is it policy, privacy, or a coding change?',
    priorityRank: 13,
    lane: 'Transparency limits',
    flaggedPattern: 'Confidential-share shift',
    impact: 'high',
    difficulty: 'high',
    summary:
      'A sudden rise in confidential transaction share at a public university could reflect privacy law, policy changes, or coding shifts, but the public dataset alone cannot explain which one.',
    investigativeQuestion:
      'When a public university’s share of confidential transactions jumps sharply, what statutory or system changes are most plausible, and what records can confirm the cause?',
    publicImpact:
      'This clarifies where transparency ends for legitimate privacy reasons and where agencies should still explain the aggregate impact of those decisions.',
    notes: `${EXPLANATION_FIRST_NOTE} Treat confidentiality as a classification and disclosure-policy question first, not as evidence of concealment.`,
    sourceReferences: [
      {
        label: 'Comptroller confidentiality indicator policy',
        note: 'Use the official policy to explain what the indicator does and who is responsible for marking transactions.',
        url: null,
      },
      {
        label: 'TexPayment confidentiality guidance',
        note: 'Add context on payment processing and health-related confidentiality constraints.',
        url: null,
      },
      {
        label: 'Institutional finance or audit materials',
        note: 'Use campus explanations, AFR notes, and internal audit artifacts where public.',
        url: null,
      },
    ],
    recordsToObtain: [
      'University finance office explanation of the confidentiality shift.',
      'Any CAPPS or USAS configuration or policy change notes.',
      'Aggregate category breakdowns of confidential versus nonconfidential spend.',
    ],
    reportingSteps: [
      'Determine whether the jump is concentrated in one spending category.',
      'Ask for aggregate breakdowns where individual transactions cannot be released.',
      'Compare the timing to policy or system changes.',
      'Cross-check AFR note disclosures and audit references.',
    ],
    visualIdeas: [
      'Before-and-after confidential share chart.',
      'Decision tree for what gets hidden and why.',
      'Peer comparison of confidential share changes.',
    ],
  },
  {
    slug: 'ut-health-tyler-privacy-vs-transparency',
    title:
      'When health privacy reshapes transparency: the case of University of Texas Health Science Center at Tyler',
    priorityRank: 14,
    lane: 'Health payments privacy',
    flaggedPattern: 'High confidential share',
    impact: 'medium_high',
    difficulty: 'high',
    summary:
      'A health campus may have strong privacy-based reasons for confidentiality, but the institution can still be pressed to explain aggregate spending categories and what remains visible elsewhere.',
    investigativeQuestion:
      'How do health-related confidentiality rules affect what the public can see in spending data at UT Health Tyler, and can the institution provide meaningful aggregate transparency without disclosing protected information?',
    publicImpact:
      'This story sets realistic public expectations for healthcare-adjacent transparency while still demanding better aggregate reporting.',
    notes: `${EXPLANATION_FIRST_NOTE} Separate PHI-driven confidentiality from payee-identity masking, and use contract data as a visibility substitute where payments are hidden.`,
    sourceReferences: [
      {
        label: 'Comptroller confidentiality indicator policy',
        note: 'Explain the mechanism that removes records from public-facing views.',
        url: null,
      },
      {
        label: 'TexPayment confidentiality guidance',
        note: 'Use health-payment constraints to frame why some transactions stay masked.',
        url: null,
      },
      {
        label: 'Public contract databases and annual financial reports',
        note: 'Reconstruct visible categories and major vendors where possible.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Annual financial report note disclosures.',
      'Institutional explanation of confidentiality classification policy.',
      'Aggregate vendor-category totals that can be released without protected details.',
    ],
    reportingSteps: [
      'Identify what remains visible in contracts, budgets, and AFRs.',
      'Ask the campus to separate PHI-driven confidentiality from other classifications.',
      'Request aggregate totals by vendor type or service category.',
      'Compare the campus approach to peer health institutions.',
    ],
    visualIdeas: [
      'Visibility map of contracts versus individual payments.',
      'Category comparison of visible and masked spending.',
      'Peer benchmark chart for health-campus confidentiality share.',
    ],
  },
  {
    slug: 'uh-victoria-confidentiality-jump',
    title:
      'A transparency red flag that might be benign: University of Houston-Victoria and the confidential-share jump',
    priorityRank: 15,
    lane: 'Higher ed transparency',
    flaggedPattern: 'Confidential-share shift',
    impact: 'medium',
    difficulty: 'medium_high',
    summary:
      'A spike in confidential share at UH-Victoria may reflect a reporting or coding change instead of a spending change, but the campus should be able to explain which categories drove it.',
    investigativeQuestion:
      'Did a systems or reporting change increase the use of confidentiality indicators at UH-Victoria, and which transaction categories drove the shift?',
    publicImpact:
      'This helps readers avoid overreading the data while still insisting that institutions explain transparency impacts.',
    notes: `${EXPLANATION_FIRST_NOTE} Compare the timing with peer campuses and seek a formal year-over-year explanation memo before drawing conclusions.`,
    sourceReferences: [
      {
        label: 'Comptroller confidentiality policy',
        note: 'Use the policy to explain downstream effects on the public dataset.',
        url: null,
      },
      {
        label: 'Texas Transparency dashboards',
        note: 'Quantify what disappeared from public view and when.',
        url: null,
      },
      {
        label: 'Campus finance or audit records',
        note: 'Look for change memos, audit plans, or reporting adjustments.',
        url: null,
      },
    ],
    recordsToObtain: [
      'A year-over-year explanation memo from the campus finance office.',
      'High-level category breakdowns for confidential transactions.',
      'Any configuration or process change records tied to the shift.',
    ],
    reportingSteps: [
      'Locate the change point in the data.',
      'Check whether peer campuses moved similarly at the same time.',
      'Request a narrative explanation and aggregate category breakdown.',
      'Compare the campus explanation with what the statewide data still shows.',
    ],
    visualIdeas: [
      'Change-point timeline.',
      'Peer comparison chart.',
      'Before-and-after confidential share cards.',
    ],
  },
  {
    slug: 'tamu-galveston-confidentiality-outlier',
    title:
      'The confidentiality outlier campus: Texas A&M University at Galveston and what the public can’t see',
    priorityRank: 16,
    lane: 'Higher ed transparency',
    flaggedPattern: 'High confidential share',
    impact: 'medium',
    difficulty: 'high',
    summary:
      'Texas A&M Galveston’s high confidential share may be concentrated in specific operational areas, and a visibility audit can show what substitute records still exist for oversight.',
    investigativeQuestion:
      'Are confidentiality classifications at Texas A&M Galveston concentrated in specific operational areas, and what transparency substitutes exist when transaction detail is hidden?',
    publicImpact:
      'This can show taxpayers how much of a campus budget is still reconstructable from contracts, grants, and aggregate financial reporting.',
    notes: `${RECORDS_FIRST_NOTE} Rebuild the visible portions of spending from substitute datasets before treating the blind spot as total opacity.`,
    sourceReferences: [
      {
        label: 'Comptroller confidentiality guidance',
        note: 'Use the statewide rules to frame why certain rows disappear.',
        url: null,
      },
      {
        label: 'Annual financial reports and public contracts',
        note: 'Reconstruct visible spending categories and major counterparties.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Annual financial report disclosures and public contracts.',
      'Aggregate vendor totals or program-level spending summaries.',
      'Any campus explanations of which operational areas drive confidentiality.',
    ],
    reportingSteps: [
      'Conduct a visibility audit across available datasets.',
      'Map which categories remain visible via contracts, grants, or budgets.',
      'Request aggregate breakdowns by operational area.',
      'Compare the campus posture to peers with similar missions.',
    ],
    visualIdeas: [
      'Swiss-cheese style dataset coverage chart.',
      'Visible-versus-hidden category map.',
      'Aggregate category breakdown if released.',
    ],
  },
  {
    slug: 'brazosport-twdb-bond-purchase-cash-flow',
    title:
      'The $262M water megadeal: how the Texas Water Development Board finances large projects through multi-year bond purchases',
    priorityRank: 17,
    lane: 'Water finance',
    flaggedPattern: 'New large payee',
    impact: 'high',
    difficulty: 'medium',
    summary:
      'A large new payee at TWDB may reflect a multi-year financial assistance commitment and staged bond series rather than a straightforward contract payment.',
    investigativeQuestion:
      'For Brazosport Water Supply Corporation, do large new payments align with TWDB multi-year commitments and scheduled series closings, and what public records explain the cash flow?',
    publicImpact:
      'This can make a complex public-finance mechanism intelligible and show what a payment to a water corporation really represents.',
    notes: `${EXPLANATION_FIRST_NOTE} Treat the payee as a financing counterparty first and a contractor second unless the supporting documents say otherwise.`,
    sourceReferences: [
      {
        label: 'TWDB board materials and resolutions',
        note: 'Use financial assistance approvals, series schedules, and attached project documentation.',
        url: null,
      },
      {
        label: 'TWDB financial assistance program materials',
        note: 'Explain the relevant loan, grant, or bond-purchase structure.',
        url: null,
      },
    ],
    recordsToObtain: [
      'TWDB resolutions and board packet attachments for the project.',
      'Project press releases or official statements for each series closing.',
      'Any local agreements describing project scope and financing phases.',
    ],
    reportingSteps: [
      'Build a series-by-series cash timeline.',
      'Separate planning, design, acquisition, and construction phases.',
      'Identify downstream contractors and procurement pathways.',
      'Interview TWDB or local project officials on the financing structure.',
    ],
    visualIdeas: [
      'Gantt chart of series closings.',
      'Map of project footprint.',
      'Stacked bar showing spending purpose by phase.',
    ],
  },
  {
    slug: 'water-project-private-beneficiary-disclosure',
    title:
      'Public instrumentality, private beneficiary: what disclosure is available when large water projects serve major industrial customers?',
    priorityRank: 18,
    lane: 'Water finance + COI',
    flaggedPattern: 'Structural governance',
    impact: 'high',
    difficulty: 'high',
    summary:
      'Some public water finance deals explicitly interact with major private beneficiaries, creating a governance story about safeguards, rate structures, and contracting transparency.',
    investigativeQuestion:
      'When project documentation references major private beneficiaries, what safeguards, rate structures, and conflict disclosures are visible in public records?',
    publicImpact:
      'This examines where public financing intersects with private benefit and whether disclosures are strong enough for meaningful oversight.',
    notes: `${RECORDS_FIRST_NOTE} Tie each claim to a specific project document, rate agreement, contract, or disclosure filing to avoid overstating inferred private benefit.`,
    sourceReferences: [
      {
        label: 'TWDB project board documents and local resolutions',
        note: 'Identify project structure, customers, and partners documented in public materials.',
        url: null,
      },
      {
        label: 'Contract databases and Form 1295 records',
        note: 'Use downstream contract and interested-party disclosures where available.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Water supply agreements and rate-setting documents.',
      'Major project contracts and professional services agreements.',
      'Any relevant Form 1295 certificates tied to high-value contracts.',
    ],
    reportingSteps: [
      'Map the project’s public and private beneficiaries.',
      'Review whether competitive procurement was used for key contracts.',
      'Trace interested-party disclosures for large deals.',
      'Analyze whether rate or governance documents contain explicit safeguards.',
    ],
    visualIdeas: [
      'Relationship map of public entities, private customers, and contractors.',
      'Timeline of major approvals and disclosures.',
      'Contract and disclosure matrix.',
    ],
  },
  {
    slug: 'flatland-abstract-110m-escrow-or-vendor',
    title:
      'Why would Flatland Abstract Company receive $110M? Following the money through right-of-way and land acquisition',
    priorityRank: 19,
    lane: 'Right-of-way/land',
    flaggedPattern: 'New large payee',
    impact: 'high',
    difficulty: 'high',
    summary:
      'A title or abstract company receiving a very large payment may be acting as an escrow or closing agent on land acquisition rather than as the ultimate beneficiary.',
    investigativeQuestion:
      'Is the simplest explanation that Flatland Abstract Company acted as an escrow or title agent for large land acquisitions, and which paying agency and object codes would verify that?',
    publicImpact:
      'This can prevent simplistic vendor narratives and instead test whether pass-through controls and land-acquisition disclosures are adequate.',
    notes: `${EXPLANATION_FIRST_NOTE} Treat the title company as a possible intermediary until parcel-level or escrow records show the ultimate recipients.`,
    sourceReferences: [
      {
        label: 'Texas Transparency payee and object code data',
        note: 'Identify the paying agency, object category, and payment dates.',
        url: null,
      },
      {
        label: 'TxDOT right-of-way acquisition materials',
        note: 'Use official right-of-way documentation to explain title and closing roles.',
        url: null,
      },
      {
        label: 'Texas business records',
        note: 'Confirm the entity profile and operating footprint of the title company.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Right-of-way acquisition agreements and escrow instructions.',
      'Lists of underlying parcel transactions or redacted parcel ledgers.',
      'Procurement records for title, escrow, or closing services.',
    ],
    reportingSteps: [
      'Identify the paying agency and underlying project corridor.',
      'Determine whether the title company is a pass-through or final beneficiary.',
      'Request a redacted ledger of parcels and ultimate recipients where possible.',
      'Check whether the same title agent appears repeatedly across districts or projects.',
    ],
    visualIdeas: [
      'Agency-to-escrow-to-property-seller flow diagram.',
      'Project corridor map with parcel counts.',
      'Payment timeline keyed to acquisition phases.',
    ],
  },
  {
    slug: 'local-anomaly-watchlist-check-registers',
    title:
      'Applying the unusual spending heuristics to local government: building a cross-city anomaly watchlist from public check registers',
    priorityRank: 20,
    lane: 'Local procurement',
    flaggedPattern: 'Scale to local',
    impact: 'medium_high',
    difficulty: 'medium_high',
    summary:
      'The same heuristics used for unusual state spending can be extended to local check registers, creating a repeatable watchdog series for Texas cities and counties.',
    investigativeQuestion:
      'Using largest payments, repeat-dollar clusters, narrow vendor footprint, large year-over-year surges, and confidentiality where applicable, which Texas local governments show the strongest unexplained anomalies?',
    publicImpact:
      'This creates a scalable local watchdog pipeline that can surface issues missed by state-only analysis and gives readers a framework they can reuse.',
    notes: `${RECORDS_FIRST_NOTE} Expect major data-cleaning work. Standardize vendor names, document coverage gaps, and avoid cross-city comparisons that ignore differing publication practices.`,
    sourceReferences: [
      {
        label: 'Comptroller local transparency guidance',
        note: 'Use recommended publication elements for local check registers and contracts.',
        url: null,
      },
      {
        label: 'Local check registers and procurement portals',
        note: 'Gather a consistent panel of local governments and normalize the data.',
        url: null,
      },
      {
        label: 'Electronic State Business Daily postings',
        note: 'Cross-check solicitation and contract context where locals use ESBD.',
        url: null,
      },
    ],
    recordsToObtain: [
      'Vendor check register exports from a selected panel of local governments.',
      'Bidding archives and sole-source or exception justifications.',
      'Council or board minutes approving major contracts.',
    ],
    reportingSteps: [
      'Pick a panel of high-spending local governments with usable check registers.',
      'Normalize vendor names and compute the anomaly heuristics.',
      'Rank the strongest leads and validate them with contract or meeting records.',
      'Create a repeatable reporting template for local follow-up stories.',
    ],
    visualIdeas: [
      'Local anomaly leaderboard.',
      'Treemap of top vendors by locality.',
      'Map of anomaly density and publication coverage.',
    ],
  },
]

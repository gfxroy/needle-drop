import type { Corpus } from "../lib/types";

const pto = `# Paid Time Off Policy (2026)

This policy applies to all full-time and part-time employees of Northwind Labs in every country where we operate, unless local law requires something more generous. In that case, local law wins.

## Accrual

Paid time off (PTO) accrues every pay period, and your annual allowance depends on how long you have been with the company. Service is measured from your original start date, including time spent as a contractor if you converted to employee within 90 days.

- Employees in their first two years of service accrue 15 days of paid time off per year.
- From the third through the fifth year of service, the allowance rises to 20 days per year.
- Employees who have completed six or more years of continuous service accrue 25 days of paid time off per year, prorated for part-time schedules.

New hires can use PTO as soon as it accrues. There is no waiting period.

## Carryover

You may carry over up to 5 unused days into the next calendar year. Carried-over days expire on March 31 if they are not used. Unused days beyond the carryover limit are forfeited on January 1 and are not paid out, except where local law requires payout.

## Requesting time off

Requests for more than three consecutive days must be submitted in Workday at least two weeks in advance. Shorter absences only need a heads-up to your manager and a calendar block. Managers should respond to requests within three business days; a request with no response after five business days is automatically approved.

## Public holidays

Northwind observes 11 public holidays per year. The holiday calendar for each country is published in December for the following year. If you work on a public holiday because of an on-call rotation, you receive a replacement day that must be used within 60 days.

## Sick leave

Sick leave is separate from PTO. Employees receive 10 paid sick days per year, and a doctor's note is only required after 3 consecutive sick days. Sick days do not carry over and are never paid out.
`;

const ptoArchived = `# Paid Time Off Policy (2023), ARCHIVED

ARCHIVED: this document was superseded by the 2026 PTO policy and is kept for historical reference only.

This policy applies to all full-time and part-time employees of Northwind Labs in every country where we operate, unless local law requires something more generous.

## Accrual

Paid time off (PTO) accrues every pay period, and your annual allowance depends on how long you have been with the company.

- Employees in their first two years of service accrue 12 days of paid time off per year.
- From the third through the fifth year of service, the allowance rises to 18 days per year.
- Employees who have completed six or more years of continuous service accrue 22 days of paid time off per year, prorated for part-time schedules.

## Carryover

You may carry over up to 10 unused days into the next calendar year. Carried-over days expire on June 30 if they are not used.

## Requesting time off

Requests for more than three consecutive days must be submitted at least four weeks in advance by email to your manager.
`;

const parental = `# Parental Leave

Becoming a parent is a big deal, and we want you to be fully present for it.

## Who is eligible

All new parents, regardless of gender or how they became a parent (birth, adoption, surrogacy or foster placement), receive 16 weeks of fully paid parental leave. You are eligible from your first day; there is no minimum tenure.

## How to take it

Leave can be taken in up to three blocks within 12 months of the child's arrival. Let People Ops know at least 30 days before your first block starts when you can; we understand that adoptions and early arrivals do not follow a schedule.

Birthing parents are additionally entitled to up to 8 weeks of paid pregnancy-related medical leave, which can start before the due date and does not reduce the 16 weeks of parental leave.

## Coming back

Phase-back: for the first four weeks after returning, you may work a 60% schedule at full pay. Your manager cannot schedule your performance review during your leave or during the phase-back period.

Lactation rooms are available in every office, and we reimburse shipping of expressed milk during business travel.
`;

const remote = `# Remote and Hybrid Work

Northwind is remote-friendly. Most roles can be done from home full-time; some lab-facing roles are hybrid with at least two office days per week.

## Home office setup

Every employee receives a one-time home office stipend of $600 for a desk, chair, monitor or other ergonomic equipment. Equipment bought with the stipend is yours to keep.

To cover your home broadband, we also pay a connectivity reimbursement of $50 per month. Submit your provider invoice once per quarter.

## Working from another location

Working from a different city in your home country needs no approval. Working from another country is allowed for up to 30 days per year, but it needs approval from People Ops at least 10 business days before travel, because of tax and immigration rules.

## Core hours

Teams agree on at least four hours of overlap per day. We default to asynchronous written updates; meetings should have an agenda and a written outcome.
`;

const expenses = `# Travel and Expenses

Spend company money as if it were your own, then file it quickly.

## Filing expenses

All expenses are filed in Ledgerly. Receipts are required for any expense over $25. Claims must be submitted within 60 days of the expense; claims older than 60 days need written approval from your department head.

## Per diem

When travelling for work, meals are covered by a per diem instead of itemised receipts: $75 per day for domestic travel and $100 per day for international travel. The per diem is paid out automatically after you file your trip report.

## Flights and hotels

Book economy for flights under 6 hours. Flights over 6 hours may be booked in premium economy. Business class requires VP approval. Hotels should stay within the city rate card published in Ledgerly.

## What is not reimbursed

Alcohol is not reimbursed, except at client dinners approved in advance by a VP. Traffic fines, minibar charges, and upgrades you choose yourself are never reimbursed.
`;

const security = `# Security Basics

Security is everyone's job. These rules apply to every employee, contractor and intern.

## Accounts

Use the company password manager, Keyhold, for every work account. Multi-factor authentication is mandatory on email, Workday, Ledgerly and source control. Never approve an MFA prompt you did not trigger yourself.

## Phishing

If an email looks suspicious, click the Report Phish button in Gmail instead of forwarding it. Do not click links or open attachments from unknown senders.

## Lost or stolen devices

If your laptop or phone is lost or stolen, report it in the #sec-incident Slack channel within 1 hour so the security team can wipe it remotely. You will not be blamed for reporting quickly; you will be asked why if you report slowly.

## Data handling

Customer data may only be stored in approved systems. Do not paste customer data or secrets into external AI tools that are not on the approved list.
`;

const benefits = `# Learning and Wellbeing Benefits

## Learning budget

Each employee has an annual learning budget of $1,500 for courses, books, certifications and conference tickets. Conference travel is paid from the travel budget, not the learning budget. Unused learning budget does not roll over.

## Mental health

Everyone gets 12 free therapy sessions per year through Lumen Health, our confidential mental health partner. Northwind never sees who uses the service. Sessions are available by video in 30 languages.

## Fitness

A fitness stipend of $40 per month can be used for a gym, climbing wall, sports club or fitness app.
`;

export const northwind: Corpus = {
  id: "northwind",
  name: "Northwind HR Handbook",
  description: "An employee handbook with a stale archived policy hiding in the index. The classic 'chatbot quoted the old PTO numbers' bug.",
  docs: [
    { id: "pto-policy-2026", title: "PTO Policy (2026)", text: pto },
    { id: "pto-policy-2023-archived", title: "PTO Policy (2023, archived)", text: ptoArchived },
    { id: "parental-leave", title: "Parental Leave", text: parental },
    { id: "remote-work", title: "Remote & Hybrid Work", text: remote },
    { id: "expenses", title: "Travel & Expenses", text: expenses },
    { id: "security", title: "Security Basics", text: security },
    { id: "benefits", title: "Learning & Wellbeing", text: benefits },
  ],
  questions: [
    {
      id: "nw-tenure-pto",
      text: "How many vacation days do I get after 7 years at the company?",
      expected: [{ docId: "pto-policy-2026", quote: "Employees who have completed six or more years of continuous service accrue 25 days of paid time off per year" }],
    },
    {
      id: "nw-internet",
      text: "Will the company pay for my home internet?",
      expected: [{ docId: "remote-work", quote: "we also pay a connectivity reimbursement of $50 per month" }],
    },
    {
      id: "nw-parental",
      text: "How long is parental leave for adoptive parents?",
      expected: [{ docId: "parental-leave", quote: "receive 16 weeks of fully paid parental leave" }],
    },
    {
      id: "nw-carryover",
      text: "Can I roll over unused PTO into next year?",
      expected: [{ docId: "pto-policy-2026", quote: "You may carry over up to 5 unused days into the next calendar year." }],
    },
    {
      id: "nw-laptop",
      text: "What should I do if my laptop gets stolen?",
      expected: [{ docId: "security", quote: "report it in the #sec-incident Slack channel within 1 hour" }],
    },
    {
      id: "nw-receipt",
      text: "Do I need to keep a receipt for a $30 taxi ride?",
      expected: [{ docId: "expenses", quote: "Receipts are required for any expense over $25." }],
    },
    {
      id: "nw-perdiem",
      text: "What is the daily food allowance when I travel abroad?",
      expected: [{ docId: "expenses", quote: "$100 per day for international travel" }],
    },
    {
      id: "nw-abroad",
      text: "Can I work from Portugal for a month?",
      expected: [{ docId: "remote-work", quote: "Working from another country is allowed for up to 30 days per year" }],
    },
    {
      id: "nw-therapy",
      text: "Is therapy covered?",
      expected: [{ docId: "benefits", quote: "Everyone gets 12 free therapy sessions per year through Lumen Health" }],
    },
    {
      id: "nw-sick",
      text: "When do I need a doctor's note for being sick?",
      expected: [{ docId: "pto-policy-2026", quote: "a doctor's note is only required after 3 consecutive sick days" }],
    },
  ],
};

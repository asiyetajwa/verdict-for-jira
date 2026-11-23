// The seeded demo project: Tally, an invented invoicing product. 40 evaluated issues with a known answer each, the
// history they point at, and the Confluence decision pages they link to. Keys here are logical (TAL-n); the seed
// script maps them to the real keys Jira assigns and writes that map next to the eval results.
// Hard cases are deliberate and stay in: duplicates worded with few shared words, blocker chains two deep, decision
// pages that contradict an issue (only a reader of the page can tell), a reverted precedent, a partial overlap that
// must be Risky and not Duplicate, and Ready issues whose blockers are already done.

import type { VerdictKind } from '../src/core/types';

export type SeedIssue = {
  key: string;
  summary: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'In Review' | 'Done';
  resolution?: 'Done' | 'Reverted' | "Won't Do";
  blockedBy?: string[];
  relatesTo?: string[];
  pages?: string[];
};

export type SeedPage = { id: string; title: string; body: string };

const ac = (...items: string[]) => `\n\nAcceptance criteria:\n${items.map((i) => `- ${i}`).join('\n')}`;

// ---------------------------------------------------------------- history: originals, blockers, precedents, noise
export const HISTORY: SeedIssue[] = [
  // duplicate originals
  { key: 'TAL-1', summary: 'Export invoices as PDF in bulk', description: `Accountants need every invoice for a period as PDF files in one download.${ac('Select a date range', 'Download a zip of PDFs', 'Works for up to 2,000 invoices')}`, status: 'In Progress' },
  { key: 'TAL-2', summary: 'Retry failed Stripe webhook deliveries with backoff', description: `When our webhook endpoint fails, Stripe events are dropped. Queue them and retry with exponential backoff.${ac('Failed events are stored', 'Retries back off up to 24 hours', 'Each event is processed once')}`, status: 'To Do' },
  { key: 'TAL-3', summary: 'SAML single sign-on for enterprise workspaces', description: `Enterprise workspaces sign in through their identity provider using SAML 2.0.${ac('Admins upload IdP metadata', 'Users sign in through the IdP', 'Just-in-time user provisioning')}`, status: 'To Do' },
  { key: 'TAL-4', summary: 'Dark mode for the web app', description: `A dark colour scheme for the whole web app, following the system setting.${ac('Toggle in settings', 'Follows the OS by default')}`, status: 'Done', resolution: 'Done' },
  { key: 'TAL-5', summary: 'Import customers from CSV', description: `Create customers in bulk from a CSV file with name, email and address columns.${ac('Column mapping step', 'Duplicate emails are skipped and reported')}`, status: 'To Do' },
  { key: 'TAL-6', summary: 'Rate limit the public API per token', description: `Each API token may make at most 600 requests per minute; return 429 with Retry-After beyond that.${ac('Limit per token', '429 with Retry-After')}`, status: 'In Review' },
  { key: 'TAL-7', summary: 'Send automatic payment reminder emails for overdue invoices', description: `Remind customers by email 3, 7 and 14 days after an invoice is overdue.${ac('Reminder schedule is configurable', 'Stops when the invoice is paid')}`, status: 'To Do' },
  { key: 'TAL-8', summary: 'Support multiple currencies on invoices', description: `Invoices can be issued in any ISO 4217 currency, with the currency stored per invoice.${ac('Currency picker on the invoice', 'Totals formatted per currency')}`, status: 'To Do' },
  { key: 'TAL-9', summary: 'Two-factor authentication with authenticator apps', description: `Users can protect their account with a one-time code from an authenticator app.${ac('Enrol with a QR code', 'Recovery codes', 'Admins can require it')}`, status: 'In Progress' },
  { key: 'TAL-10', summary: 'Paginate the invoices list API with cursors', description: `The invoices list endpoint returns all rows at once. Add cursor-based pagination with a page size of 100.${ac('next_cursor in the response', 'Stable ordering by created date')}`, status: 'To Do' },
  // blockers (open) and their own blockers, for two-deep chains
  { key: 'TAL-11', summary: 'Scheduler service for timed jobs', description: 'A service that runs jobs at a set time, with retries and a dashboard.', status: 'In Progress' },
  { key: 'TAL-12', summary: 'Payment links API', description: 'Create a payable link for an invoice through the API.', status: 'To Do' },
  { key: 'TAL-13', summary: 'Extract invoice template strings for translation', description: 'Move every user-facing string in the invoice template into message files.', status: 'In Progress' },
  { key: 'TAL-14', summary: 'Audit log event pipeline', description: 'Capture who changed what, and store the events for a year.', status: 'To Do' },
  { key: 'TAL-15', summary: 'Push notification service', description: 'A service that sends push notifications to the iOS and Android apps.', status: 'To Do', blockedBy: ['TAL-16'] },
  { key: 'TAL-16', summary: 'Apple developer account for push certificates', description: 'Set up the company Apple developer account and the push certificate.', status: 'To Do' },
  { key: 'TAL-17', summary: 'Permissions model refactor', description: 'Replace the admin flag with roles and permissions.', status: 'In Review', blockedBy: ['TAL-18'] },
  { key: 'TAL-18', summary: 'Migrate users table to organisation-scoped ids', description: 'Users belong to an organisation; ids must be unique per organisation.', status: 'In Progress' },
  { key: 'TAL-19', summary: 'Background export worker', description: 'A worker that builds large exports off the request path.', status: 'To Do' },
  { key: 'TAL-20', summary: 'Tax rate tables per region', description: 'Store tax rates per country and region with effective dates.', status: 'In Progress' },
  { key: 'TAL-21', summary: 'File upload storage and signed upload URLs', description: 'A storage bucket and signed URLs so the browser can upload files directly.', status: 'To Do' },
  // done blockers (their dependants are Ready)
  { key: 'TAL-22', summary: 'Store each customer timezone', description: 'Add a timezone field to customers, defaulting to the workspace timezone.', status: 'Done', resolution: 'Done' },
  { key: 'TAL-23', summary: 'Sign webhook payloads with a shared secret', description: 'Every webhook carries an HMAC signature header.', status: 'Done', resolution: 'Done' },
  // precedent that was reverted
  { key: 'TAL-24', summary: 'Cache invoice totals in memcached', description: 'Cache computed invoice totals to speed up the list page. Reverted after totals went stale when line items changed.', status: 'Done', resolution: 'Reverted' },
  // partial-overlap original
  { key: 'TAL-25', summary: 'Export invoices as CSV', description: `Download the invoice list as a CSV file.${ac('One row per invoice', 'Respects the current filters')}`, status: 'Done', resolution: 'Done' },
  // noise: unrelated done work, so similarity has a real corpus
  { key: 'TAL-26', summary: 'Customer search by name or email', description: 'Search box on the customers page.', status: 'Done', resolution: 'Done' },
  { key: 'TAL-27', summary: 'Password reset by email', description: 'Users can reset a forgotten password through an emailed link.', status: 'Done', resolution: 'Done' },
  { key: 'TAL-28', summary: 'Invoice numbering per workspace', description: 'Sequential invoice numbers with a configurable prefix.', status: 'Done', resolution: 'Done' },
  { key: 'TAL-29', summary: 'Logo upload for invoice branding', description: 'Workspaces can upload a logo shown on invoices.', status: 'Done', resolution: 'Done' },
  { key: 'TAL-30', summary: 'Mark an invoice as paid manually', description: 'Record a payment received outside the app.', status: 'Done', resolution: 'Done' },
  { key: 'TAL-31', summary: 'Slack notification when an invoice is paid', description: 'Post to a Slack channel when a customer pays.', status: 'Done', resolution: 'Done' },
  { key: 'TAL-32', summary: 'Duplicate an existing invoice', description: 'Copy an invoice into a new draft.', status: "Done", resolution: "Won't Do" },
];

// ---------------------------------------------------------------- Confluence decision pages
export const PAGES: SeedPage[] = [
  { id: 'P1', title: 'Decision: we never store card numbers', body: 'Decision (agreed by Security and Payments): Tally never stores card numbers or CVCs, in any form. Card details go straight to Stripe Elements and we keep only the Stripe payment method token. Any feature that needs a saved card uses Stripe saved payment methods. Status: Final.' },
  { id: 'P2', title: 'Decision: sent invoices are immutable', body: 'Decision: once an invoice is sent it cannot be edited or deleted, for audit and tax reasons. Mistakes are corrected by issuing a credit note against the invoice. Drafts can be edited and deleted freely. Status: Final.' },
  { id: 'P3', title: 'Decision: invoices are delivered by secure link', body: 'Decision: customers receive invoices as a secure link to the customer portal, never as email attachments, so we can revoke access and track views. The PDF can be downloaded from the portal. Status: Final.' },
  { id: 'P4', title: 'Receipt email content', body: 'Receipt emails show the amount paid, the invoice number, the payment date and the payment method (brand and last four digits). Approved by Support.' },
  { id: 'P5', title: 'Invoice list design notes', body: 'The invoice list shows number, customer, amount, status badge and due date. Status badges: Draft, Sent, Paid, Overdue.' },
];

// ---------------------------------------------------------------- the 40 evaluated issues, with their answers
export type EvalIssue = SeedIssue & { expected: VerdictKind; note: string };

export const EVAL: EvalIssue[] = [
  // ---- Duplicate (10): the original exists; wording varies, some with almost no words in common
  { key: 'TAL-41', expected: 'DUPLICATE', note: 'bulk PDF export, different words', summary: 'Let accountants download every invoice for a month in one zip', description: `Our accountant customers ask for one download with all of a month's invoices as PDF files.${ac('Pick a month', 'Get one zip file')}`, status: 'To Do' },
  { key: 'TAL-42', expected: 'DUPLICATE', note: 'webhook retry, few shared words', summary: 'Payment events go missing when our endpoint is down', description: `If our server is unavailable for a few minutes we lose Stripe events for good. Keep them and replay them later.${ac('No event lost during an outage', 'Replays happen automatically')}`, status: 'To Do' },
  { key: 'TAL-43', expected: 'DUPLICATE', note: 'SSO, almost no shared words', summary: 'Enterprise customers want to log in through Okta', description: `Three enterprise prospects asked to use their Okta accounts to get into Tally instead of passwords.${ac('Okta users can sign in', 'New Okta users get an account on first sign-in')}`, status: 'To Do' },
  { key: 'TAL-44', expected: 'DUPLICATE', note: 'dark mode already done', summary: 'Add a dark theme to the dashboard', description: `Users working late want a dark theme across the dashboard.${ac('Dark theme available', 'Respects the system preference')}`, status: 'To Do' },
  { key: 'TAL-45', expected: 'DUPLICATE', note: 'CSV import, different words', summary: 'Bulk upload the client list from a spreadsheet', description: `New workspaces want to bring their existing clients in from a spreadsheet instead of typing them one by one.${ac('Upload a spreadsheet export', 'Map spreadsheet columns to client fields')}`, status: 'To Do' },
  { key: 'TAL-46', expected: 'DUPLICATE', note: 'rate limiting', summary: 'Throttle API requests per key to stop abuse', description: `One integration sent 50,000 requests in a minute. Each key needs a request ceiling and a clear error when it is reached.${ac('Per-key ceiling', 'Clear error with a retry hint')}`, status: 'To Do' },
  { key: 'TAL-47', expected: 'DUPLICATE', note: 'overdue reminders', summary: 'Email customers when their invoice is past due', description: `Send the customer an email when an invoice passes its due date, and again a week later.${ac('Email on the due date passing', 'Second email after a week')}`, status: 'To Do' },
  { key: 'TAL-48', expected: 'DUPLICATE', note: 'currencies, few shared words', summary: 'Invoices in EUR and GBP, not only dollars', description: `European customers need to bill in euros and pounds.${ac('EUR and GBP invoices', 'Correct symbols and decimals')}`, status: 'To Do' },
  { key: 'TAL-49', expected: 'DUPLICATE', note: '2FA, abbreviations', summary: 'TOTP codes at login', description: `Add time-based one-time passwords as a second step when signing in.${ac('Enrolment flow', 'Code asked at sign-in')}`, status: 'To Do' },
  { key: 'TAL-50', expected: 'DUPLICATE', note: 'cursor pagination', summary: 'GET /invoices times out for large workspaces; return pages', description: `The endpoint returns every invoice in one response and times out above 20,000 rows. Return results in pages with a cursor.${ac('Pages of 100', 'Cursor to fetch the next page')}`, status: 'To Do' },

  // ---- Blocked (10): open blockers, two of them chains two deep
  { key: 'TAL-51', expected: 'BLOCKED', note: 'needs the scheduler', summary: 'Recurring invoices on a monthly schedule', description: `Customers on retainers want an invoice created and sent on the first of each month.${ac('Monthly schedule per customer', 'Sent automatically')}`, status: 'To Do', blockedBy: ['TAL-11'] },
  { key: 'TAL-52', expected: 'BLOCKED', note: 'needs the scheduler', summary: 'Apply late fees automatically', description: `Add a configurable late fee to invoices that stay unpaid 30 days after the due date.${ac('Fee amount or percentage', 'Applied once, at day 30')}`, status: 'To Do', blockedBy: ['TAL-11'] },
  { key: 'TAL-53', expected: 'BLOCKED', note: 'needs payment links', summary: 'Customer portal: pay outstanding invoices', description: `Customers see their unpaid invoices in the portal and pay them in one place.${ac('List of unpaid invoices', 'Pay button per invoice')}`, status: 'To Do', blockedBy: ['TAL-12'] },
  { key: 'TAL-54', expected: 'BLOCKED', note: 'needs string extraction', summary: 'French and German invoice templates', description: `Invoices can be issued in French or German.${ac('Language picker per customer', 'All template text translated')}`, status: 'To Do', blockedBy: ['TAL-13'] },
  { key: 'TAL-55', expected: 'BLOCKED', note: 'needs the event pipeline', summary: 'Audit log page for admins', description: `Admins can see who changed invoices and settings, filtered by person and date.${ac('Filter by person', 'Filter by date')}`, status: 'To Do', blockedBy: ['TAL-14'] },
  { key: 'TAL-56', expected: 'BLOCKED', note: 'chain two deep: push service, then the Apple account', summary: 'Push notification when an invoice is paid', description: `Workspace owners get a push notification on their phone when a customer pays.${ac('Push on payment', 'Opens the invoice')}`, status: 'To Do', blockedBy: ['TAL-15'] },
  { key: 'TAL-57', expected: 'BLOCKED', note: 'chain two deep: permissions, then the users migration', summary: 'Approver role for invoices over a threshold', description: `Invoices above an amount set by the admin need an approver before they can be sent.${ac('Threshold setting', 'Approver role', 'Send is disabled until approved')}`, status: 'To Do', blockedBy: ['TAL-17'] },
  { key: 'TAL-58', expected: 'BLOCKED', note: 'needs the export worker', summary: 'GDPR data export download for customers', description: `A customer can request all the data Tally holds about them and download it.${ac('Request from the portal', 'Download link by email')}`, status: 'To Do', blockedBy: ['TAL-19'] },
  { key: 'TAL-59', expected: 'BLOCKED', note: 'needs tax tables', summary: 'Show the tax breakdown on invoices', description: `Each invoice shows tax per rate and region.${ac('One line per tax rate', 'Totals match the tax report')}`, status: 'To Do', blockedBy: ['TAL-20'] },
  { key: 'TAL-60', expected: 'BLOCKED', note: 'needs upload storage', summary: 'Attach files to an invoice', description: `Attach a timesheet or contract to an invoice so the customer sees it.${ac('Up to 5 files', 'Shown in the portal')}`, status: 'To Do', blockedBy: ['TAL-21'] },

  // ---- Risky (10): missing criteria, contradicting decisions, a reverted precedent, a partial overlap, no owner
  { key: 'TAL-61', expected: 'RISKY', note: 'no acceptance criteria, thin', summary: 'Improve the dashboard', description: 'The dashboard could be better.', status: 'To Do' },
  { key: 'TAL-62', expected: 'RISKY', note: 'no acceptance criteria', summary: 'Make search better', description: 'People complain that search does not find invoices by amount or by customer reference, and results are slow on big workspaces.', status: 'To Do' },
  { key: 'TAL-63', expected: 'RISKY', note: 'no acceptance criteria', summary: 'Internal notes field on invoices', description: 'Staff want to leave a note on an invoice that the customer never sees, for example why a discount was given.', status: 'To Do' },
  { key: 'TAL-64', expected: 'RISKY', note: 'no acceptance criteria', summary: 'Speed up the invoice list page', description: 'The invoice list takes 6 seconds to load for workspaces with more than 10,000 invoices.', status: 'To Do' },
  { key: 'TAL-65', expected: 'RISKY', note: 'contradicts P1 (we never store card numbers)', summary: 'Store card numbers for one-click pay', description: `Keep the customer's card number on file so repeat payments are one click.${ac('Card saved after first payment', 'One-click pay on later invoices')}`, status: 'To Do', pages: ['P1'] },
  { key: 'TAL-66', expected: 'RISKY', note: 'contradicts P2 (sent invoices are immutable)', summary: 'Allow deleting sent invoices', description: `Users want to delete an invoice they sent by mistake.${ac('Delete button on sent invoices', 'Deleted invoices disappear from reports')}`, status: 'To Do', pages: ['P2'] },
  { key: 'TAL-67', expected: 'RISKY', note: 'contradicts P3 (secure link only)', summary: 'Email invoice PDFs as attachments to all billing contacts', description: `Customers ask to receive the invoice PDF attached to the email, sent to every billing contact.${ac('PDF attached', 'Sent to all billing contacts')}`, status: 'To Do', pages: ['P3'] },
  { key: 'TAL-68', expected: 'RISKY', note: 'reverted precedent TAL-24', summary: 'Cache invoice totals in Redis', description: `Cache computed invoice totals in Redis to make the invoice list faster.${ac('Totals served from cache', 'List loads under one second')}`, status: 'To Do' },
  { key: 'TAL-69', expected: 'RISKY', note: 'partial overlap with TAL-25: Risky, not Duplicate', summary: 'Export invoices and credit notes as CSV', description: `Download invoices together with their credit notes as one CSV file for the accountant.${ac('Invoices and credit notes in one file', 'Credit notes linked to their invoice')}`, status: 'To Do' },
  { key: 'TAL-70', expected: 'RISKY', note: 'spans three teams, no owner, no criteria', summary: 'Move billing, sign-in and notifications to the new platform', description: 'Billing, authentication and notifications all need to move to the new platform this quarter. Each is owned by a different team and nobody owns the migration as a whole.', status: 'To Do' },

  // ---- Ready (10): complete, unblocked; some with done blockers and agreeing decision pages
  { key: 'TAL-71', expected: 'READY', note: 'agrees with P5', summary: "Show a 'Paid' badge on invoice list rows", description: `Paid invoices show a green Paid badge in the list.${ac('Badge on paid rows only', 'Matches the badge styles in the design notes')}`, status: 'To Do', pages: ['P5'] },
  { key: 'TAL-72', expected: 'READY', note: 'agrees with P3', summary: 'Copy the secure invoice link', description: `A button copies the secure portal link of an invoice so staff can share it in chat.${ac('Copy button on the invoice page', 'Copies the portal link, not a file')}`, status: 'To Do', pages: ['P3'] },
  { key: 'TAL-73', expected: 'READY', note: 'blocker TAL-22 is done', summary: "Show the due date in the customer's timezone", description: `Due dates on the invoice and in emails use the customer's timezone.${ac('Invoice page uses the customer timezone', 'Emails use the customer timezone')}`, status: 'To Do', blockedBy: ['TAL-22'] },
  { key: 'TAL-74', expected: 'READY', note: 'agrees with P2: credit notes are the correction path', summary: 'Issue a credit note from a sent invoice', description: `From a sent invoice, create a credit note for all or part of it.${ac('Full or partial credit', 'Credit note linked to the invoice', 'Invoice balance updated')}`, status: 'To Do', pages: ['P2'] },
  { key: 'TAL-75', expected: 'READY', note: 'complete', summary: "Keyboard shortcut 'N' for a new invoice", description: `Pressing N anywhere outside a text field opens a new invoice.${ac('N opens a new draft', 'Ignored while typing in a field')}`, status: 'To Do' },
  { key: 'TAL-76', expected: 'READY', note: 'complete', summary: 'Accessible labels on invoice form fields', description: `Every field on the invoice form has a visible label and an accessible name.${ac('All fields labelled', 'Passes an axe scan with no violations')}`, status: 'To Do' },
  { key: 'TAL-77', expected: 'READY', note: 'blocker TAL-23 is done', summary: 'Rotate the webhook signing secret from settings', description: `Admins can rotate the signing secret; the old one keeps working for 24 hours.${ac('Rotate button in settings', 'Old secret valid for 24 hours')}`, status: 'To Do', blockedBy: ['TAL-23'] },
  { key: 'TAL-78', expected: 'READY', note: 'complete', summary: 'Filter the invoice list by status', description: `A status filter above the invoice list.${ac('Filter by Draft, Sent, Paid and Overdue', 'Filter kept in the URL')}`, status: 'To Do' },
  { key: 'TAL-79', expected: 'READY', note: 'agrees with P4', summary: 'Show the payment method on receipt emails', description: `Receipt emails show the card brand and last four digits.${ac('Brand and last four shown', 'Nothing else from the card')}`, status: 'To Do', pages: ['P4'] },
  { key: 'TAL-80', expected: 'READY', note: 'complete', summary: "Onboarding checklist: 'Add your first customer' step", description: `The onboarding checklist gets a step that opens the new customer form.${ac('Step appears for new workspaces', 'Ticked when the first customer exists')}`, status: 'To Do' },
];

export const ALL_ISSUES: SeedIssue[] = [...HISTORY, ...EVAL];

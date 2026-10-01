import type { SecFilingDocument, SecBlock } from '../types/secFiling';
import { ZENATECH_LOGO_DATA_URL } from './zenatechLogoAsset';
import { FINANCIAL_TABLE_TEMPLATES } from './financialTableTemplates';

export interface DocumentTemplateDefinition {
  id: string;
  name: string;
  subtitle: string;
  category: 'core' | 'sec' | 'operations' | 'executive';
  color: string;
  thumbnailType: 'blank' | 'serif_resume' | 'coral_resume' | 'spearmint_letter' | 'tropic_proposal' | 'geometric_brochure' | 'luxe_report' | 'checklist_onboarding' | 'checklist_offboarding';
  description: string;
  generateDoc: (title?: string) => SecFilingDocument;
}

export function generateOnboardingChecklistDoc(title = 'Onboarding'): SecFilingDocument {
  const now = new Date().toISOString();
  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: title,
      alignment: 'center',
      bold: true,
      color: '#1e293b',
      spacingBottom: 8,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'paragraph',
      section: 'Cover Page',
      text: 'Employee onboarding workflow, asset provisioning, system permissions, and compliance checklist.',
      alignment: 'center',
      italic: true,
      spacingBottom: 16,
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'financial_table',
      section: 'Checklist',
      title: 'Employee Onboarding Checklist',
      headers: ['Required Action', 'Where / responsible', 'Date Completed'],
      columnAlignments: ['left', 'left', 'left'],
      spacingTop: 8,
      spacingBottom: 16,
      rows: [
        {
          id: 'ob-r1',
          type: 'header',
          cells: ['Required Action', 'Where / responsible', 'Date Completed'],
          bold: true,
        },
        {
          id: 'ob-r2',
          type: 'category_header',
          cells: ['Pre-Day 1 Setup', 'Internal HR Hub / IT', ''],
          bold: true,
          shading: '#DAE9F7',
        },
        {
          id: 'ob-r3',
          type: 'data',
          cells: ['Welcome email & initial welcome kit', 'Human Resources', 'Pre-start'],
          indent: 1,
        },
        {
          id: 'ob-r4',
          type: 'data',
          cells: ['Hardware & laptop provisioning (ZenaTech IT)', 'IT Department', 'Day 1'],
          indent: 1,
        },
        {
          id: 'ob-r5',
          type: 'data',
          cells: ['Create Google Workspace & Slack accounts', 'IT / Sysadmin', 'Day 1'],
          indent: 1,
        },
        {
          id: 'ob-r6',
          type: 'data',
          cells: ['SSO & Internal Portal RBAC Role Assignment', 'Security Lead', 'Day 1'],
          indent: 1,
        },
        {
          id: 'ob-r7',
          type: 'category_header',
          cells: ['First Week Milestones', 'Manager & Buddy', ''],
          bold: true,
          shading: '#DAE9F7',
        },
        {
          id: 'ob-r8',
          type: 'data',
          cells: ['1-on-1 welcome meeting with manager', 'Direct Manager', 'Day 1 - 2'],
          indent: 1,
        },
        {
          id: 'ob-r9',
          type: 'data',
          cells: ['Review SEC compliance, insider trading policies & SOC2', 'Legal / Compliance', 'Day 3'],
          indent: 1,
        },
        {
          id: 'ob-r10',
          type: 'data',
          cells: ['Development & financial portal environment setup', 'Tech Lead', 'Day 4'],
          indent: 1,
        },
        {
          id: 'ob-r11',
          type: 'data',
          cells: ['First week checkpoint and feedback session', 'Manager & HR', 'Day 5'],
          indent: 1,
        },
      ],
    },
    {
      id: `blk-${Date.now()}-3`,
      type: 'signature',
      section: 'Sign-off',
      title: 'Onboarding Sign-off and Verification',
      officers: [
        {
          id: 'sig-1',
          name: 'Employee Signature',
          title: 'New Team Member',
          date: new Date().toLocaleDateString(),
          signed: false,
        },
        {
          id: 'sig-2',
          name: 'HR & IT Administrator',
          title: 'Operations Lead',
          date: new Date().toLocaleDateString(),
          signed: false,
        },
      ],
    },
  ];

  return {
    id: `doc-onboarding-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Checklist / Form',
    period: 'Current',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generateOffboardingChecklistDoc(title = 'Offboarding Checklist'): SecFilingDocument {
  const now = new Date().toISOString();
  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: title,
      alignment: 'center',
      bold: true,
      color: '#1e293b',
      spacingBottom: 8,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'paragraph',
      section: 'Cover Page',
      text: 'Standard employee offboarding, equipment return, access revocation, and handover protocol.',
      alignment: 'center',
      italic: true,
      spacingBottom: 16,
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'financial_table',
      section: 'Checklist',
      title: 'Offboarding Checklist Table',
      headers: ['Required Action', 'Where / responsible', 'Date Completed'],
      columnAlignments: ['left', 'left', 'left'],
      spacingTop: 8,
      spacingBottom: 16,
      rows: [
        {
          id: 'off-r1',
          type: 'header',
          cells: ['Required Action', 'Where / responsible', 'Date Completed'],
          bold: true,
        },
        {
          id: 'off-r2',
          type: 'category_header',
          cells: ['Hardware & Physical Assets', 'Operations & IT', ''],
          bold: true,
          shading: '#DAE9F7',
        },
        {
          id: 'off-r3',
          type: 'data',
          cells: ['Laptop, monitor, accessories physical return', 'IT Support', 'Last Day'],
          indent: 1,
        },
        {
          id: 'off-r4',
          type: 'data',
          cells: ['Office security keycard / FOB recovery', 'Office Management', 'Last Day'],
          indent: 1,
        },
        {
          id: 'off-r5',
          type: 'category_header',
          cells: ['System Access & Security', 'Sysadmin & Security', ''],
          bold: true,
          shading: '#DAE9F7',
        },
        {
          id: 'off-r6',
          type: 'data',
          cells: ['Revoke AWS, GitHub, and Internal Portal SSO access', 'Security Lead', 'Immediate'],
          indent: 1,
        },
        {
          id: 'off-r7',
          type: 'data',
          cells: ['Forward email & setup auto-responder', 'IT Ops', 'Last Day'],
          indent: 1,
        },
        {
          id: 'off-r8',
          type: 'category_header',
          cells: ['Handover & HR Formalities', 'Manager & HR', ''],
          bold: true,
          shading: '#DAE9F7',
        },
        {
          id: 'off-r9',
          type: 'data',
          cells: ['Handover active projects, PRs, and credentials', 'Team Lead', 'Week before'],
          indent: 1,
        },
        {
          id: 'off-r10',
          type: 'data',
          cells: ['Conduct HR exit interview & benefits briefing', 'HR Manager', 'Final Week'],
          indent: 1,
        },
      ],
    },
    {
      id: `blk-${Date.now()}-3`,
      type: 'signature',
      section: 'Sign-off',
      title: 'Offboarding Completion Sign-off',
      officers: [
        {
          id: 'sig-off-1',
          name: 'Departing Employee',
          title: 'Sign-off',
          date: new Date().toLocaleDateString(),
          signed: false,
        },
        {
          id: 'sig-off-2',
          name: 'HR & IT Operations Manager',
          title: 'Verification',
          date: new Date().toLocaleDateString(),
          signed: false,
        },
      ],
    },
  ];

  return {
    id: `doc-offboarding-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Checklist / Form',
    period: 'Current',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generateBlankDocument(title = 'Untitled Document'): SecFilingDocument {
  const now = new Date().toISOString();
  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'heading',
      section: 'Document',
      level: 1,
      text: title,
      alignment: 'left',
      bold: true,
      color: '#1e293b',
      spacingBottom: 12,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'paragraph',
      section: 'Document',
      text: 'Start typing your document text, insert headings, financial tables, callouts, or signature blocks.',
      alignment: 'left',
    },
  ];

  return {
    id: `doc-blank-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Custom Document',
    period: '2026',
    currency: 'CAD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generate10QDoc(title = 'Form 10-Q (Quarterly Report)'): SecFilingDocument {
  const now = new Date().toISOString();
  const bsTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'balance_sheet')?.block;
  const isTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'income_statement')?.block;
  const cfTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'cash_flows')?.block;
  const seTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'shareholders_equity')?.block;

  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'image',
      section: 'Cover Page',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'ZenaTech Logo',
      alignment: 'center',
      width: 260,
      spacingTop: 0,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: 'UNITED STATES SECURITIES AND EXCHANGE COMMISSION',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'heading',
      section: 'Cover Page',
      level: 2,
      text: 'FORM 10-Q',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-3`,
      type: 'metadata',
      section: 'Metadata',
      companyName: 'ZenaTech, Inc.',
      symbol: 'ZENA',
      cik: '0001987654',
      formType: '10-Q',
      periodEnded: 'June 30, 2026',
      currency: 'USD',
      fiscalYear: '2026',
      filingDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      documentTitle: 'QUARTERLY REPORT PURSUANT TO SECTION 13 OR 15(d)',
      jurisdiction: 'Delaware, USA',
    },
    {
      id: `blk-${Date.now()}-4`,
      type: 'heading',
      section: 'Financial Statements',
      level: 2,
      text: 'Part I — Financial Information',
      alignment: 'left',
      bold: true,
    },
    {
      id: `blk-${Date.now()}-5`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Condensed Consolidated Statements of Financial Position (Balance Sheets)',
      headers: bsTemplate?.headers || ['', '', 'As of June 30, 2026', 'As of Dec 31, 2025'],
      columnAlignments: bsTemplate?.columnAlignments || ['left', 'right', 'right', 'right'],
      rows: (bsTemplate?.rows || []).map((r, i) => ({ ...r, id: `bs-10q-${i}` })),
    },
    {
      id: `blk-${Date.now()}-6`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Condensed Consolidated Statements of Comprehensive Loss (Income Statement)',
      headers: isTemplate?.headers || ['', 'Three Months Ended June 30, 2026', 'Three Months Ended June 30, 2025', 'Six Months Ended June 30, 2026', 'Six Months Ended June 30, 2025'],
      columnAlignments: isTemplate?.columnAlignments || ['left', 'right', 'right', 'right', 'right'],
      rows: (isTemplate?.rows || []).map((r, i) => ({ ...r, id: `is-10q-${i}` })),
    },
    {
      id: `blk-${Date.now()}-7`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Condensed Consolidated Statements of Cash Flows',
      headers: cfTemplate?.headers || ['', 'Six Months Ended June 30, 2026', 'Six Months Ended June 30, 2025'],
      columnAlignments: cfTemplate?.columnAlignments || ['left', 'right', 'right'],
      rows: (cfTemplate?.rows || []).map((r, i) => ({ ...r, id: `cf-10q-${i}` })),
    },
    {
      id: `blk-${Date.now()}-8`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Condensed Consolidated Statements of Changes in Shareholders’ Equity',
      headers: seTemplate?.headers || ['Description / Activity', 'Common Shares ($)', 'Contributed Surplus ($)', 'Deficit ($)', 'Total Equity ($)'],
      columnAlignments: seTemplate?.columnAlignments || ['left', 'right', 'right', 'right', 'right'],
      columnWidths: seTemplate?.columnWidths,
      rows: (seTemplate?.rows || []).map((r, i) => ({ ...r, id: `se-10q-${i}` })),
    },
    {
      id: `blk-${Date.now()}-9`,
      type: 'heading',
      section: 'Notes to Financial Statements',
      level: 2,
      text: 'Note 1 — Organization, Nature of Operations & Summary of Significant Accounting Policies',
      alignment: 'left',
      bold: true,
    },
    {
      id: `blk-${Date.now()}-10`,
      type: 'paragraph',
      section: 'Notes to Financial Statements',
      text: 'ZenaTech, Inc. is an AI technology and drone solutions corporation developing autonomous aerial intelligence and mission-critical enterprise software systems. The accompanying unaudited condensed consolidated interim financial statements have been prepared in accordance with U.S. GAAP and Regulation S-X.',
      alignment: 'left',
    },
    {
      id: `blk-${Date.now()}-11`,
      type: 'signature',
      section: 'Signatures',
      title: 'Signatures Pursuant to the Requirements of the Securities Exchange Act of 1934',
      officers: [
        {
          id: 'sig-1',
          name: 'Shaun Passley, Ph.D.',
          title: 'Chief Executive Officer & Director (Principal Executive Officer)',
          date: new Date().toLocaleDateString(),
          signed: false,
          signatureText: '',
        },
        {
          id: 'sig-2',
          name: 'Benoit Chotard',
          title: 'Chief Financial Officer (Principal Financial & Accounting Officer)',
          date: new Date().toLocaleDateString(),
          signed: false,
          signatureText: '',
        },
      ],
    },
  ];

  return {
    id: `doc-10q-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Form 10-Q',
    period: 'Q2 2026',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generate10KDoc(title = 'Form 10-K (Annual Report)'): SecFilingDocument {
  const now = new Date().toISOString();
  const bsTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'balance_sheet')?.block;
  const isTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'income_statement')?.block;
  const cfTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'cash_flows')?.block;
  const seTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'shareholders_equity')?.block;

  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'image',
      section: 'Cover Page',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'ZenaTech Logo',
      alignment: 'center',
      width: 260,
      spacingTop: 0,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: 'UNITED STATES SECURITIES AND EXCHANGE COMMISSION',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'heading',
      section: 'Cover Page',
      level: 2,
      text: 'FORM 10-K (ANNUAL REPORT)',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-3`,
      type: 'metadata',
      section: 'Metadata',
      companyName: 'ZenaTech, Inc.',
      symbol: 'ZENA',
      cik: '0001987654',
      formType: '10-K',
      periodEnded: 'December 31, 2025',
      currency: 'USD',
      fiscalYear: '2025',
      filingDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      documentTitle: 'ANNUAL REPORT PURSUANT TO SECTION 13 OR 15(d)',
      jurisdiction: 'Delaware, USA',
    },
    {
      id: `blk-${Date.now()}-4`,
      type: 'heading',
      section: 'Item 1. Business',
      level: 2,
      text: 'Item 1. Business Overview',
      alignment: 'left',
      bold: true,
    },
    {
      id: `blk-${Date.now()}-5`,
      type: 'paragraph',
      section: 'Item 1. Business',
      text: 'ZenaTech, Inc. is an AI technology and drone solutions enterprise developing autonomous aerial intelligence and mission-critical enterprise software systems.',
      alignment: 'left',
    },
    {
      id: `blk-${Date.now()}-6`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Consolidated Audited Statements of Financial Position (Balance Sheets)',
      headers: bsTemplate?.headers || ['', '', '2025', '2024'],
      columnAlignments: bsTemplate?.columnAlignments || ['left', 'right', 'right', 'right'],
      rows: (bsTemplate?.rows || []).map((r, i) => ({ ...r, id: `bs-10k-${i}` })),
    },
    {
      id: `blk-${Date.now()}-7`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Consolidated Audited Statements of Comprehensive Loss (Income Statement)',
      headers: isTemplate?.headers || ['', 'Three Months Ended June 30, 2026', 'Three Months Ended June 30, 2025', 'Six Months Ended June 30, 2026', 'Six Months Ended June 30, 2025'],
      columnAlignments: isTemplate?.columnAlignments || ['left', 'right', 'right', 'right', 'right'],
      rows: (isTemplate?.rows || []).map((r, i) => ({ ...r, id: `is-10k-${i}` })),
    },
    {
      id: `blk-${Date.now()}-8`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Consolidated Audited Statements of Cash Flows',
      headers: cfTemplate?.headers || ['', 'Six Months Ended June 30, 2026', 'Six Months Ended June 30, 2025'],
      columnAlignments: cfTemplate?.columnAlignments || ['left', 'right', 'right'],
      rows: (cfTemplate?.rows || []).map((r, i) => ({ ...r, id: `cf-10k-${i}` })),
    },
    {
      id: `blk-${Date.now()}-9`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Consolidated Audited Statements of Stockholders’ Equity',
      headers: seTemplate?.headers || ['Description / Activity', 'Common Shares ($)', 'Contributed Surplus ($)', 'Deficit ($)', 'Total Equity ($)'],
      columnAlignments: seTemplate?.columnAlignments || ['left', 'right', 'right', 'right', 'right'],
      columnWidths: seTemplate?.columnWidths,
      rows: (seTemplate?.rows || []).map((r, i) => ({ ...r, id: `se-10k-${i}` })),
    },
    {
      id: `blk-${Date.now()}-10`,
      type: 'signature',
      section: 'Signatures',
      title: 'Signatures Pursuant to Section 13 or 15(d)',
      officers: [
        {
          id: 'sig-1',
          name: 'Shaun Passley, Ph.D.',
          title: 'CEO & Chairman',
          date: new Date().toLocaleDateString(),
          signed: false,
          signatureText: '',
        },
        {
          id: 'sig-2',
          name: 'Benoit Chotard',
          title: 'Chief Financial Officer (Principal Financial & Accounting Officer)',
          date: new Date().toLocaleDateString(),
          signed: false,
          signatureText: '',
        },
      ],
    },
  ];

  return {
    id: `doc-10k-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Form 10-K',
    period: 'FY 2025',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generate8KDoc(title = 'Form 8-K (Current Report)'): SecFilingDocument {
  const now = new Date().toISOString();
  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'image',
      section: 'Cover Page',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'ZenaTech Logo',
      alignment: 'center',
      width: 260,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: 'UNITED STATES SECURITIES AND EXCHANGE COMMISSION',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'heading',
      section: 'Cover Page',
      level: 2,
      text: 'FORM 8-K — CURRENT REPORT',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-3`,
      type: 'callout',
      section: 'Disclosures',
      variant: 'info',
      title: 'Item 1.01 Entry into a Material Definitive Agreement',
      content: 'On September 29, 2026, ZenaTech, Inc. completed the strategic acquisition and corporate integration outlined in the attached exhibits.',
    },
    {
      id: `blk-${Date.now()}-4`,
      type: 'signature',
      section: 'Signatures',
      title: 'Signatures',
      officers: [
        {
          id: 'sig-8k-1',
          name: 'Shaun Passley, Ph.D.',
          title: 'Chief Executive Officer',
          date: new Date().toLocaleDateString(),
          signed: false,
          signatureText: '',
        },
      ],
    },
  ];

  return {
    id: `doc-8k-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Form 8-K',
    period: 'Current',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generateProjectProposalDoc(title = 'Project Proposal — Tropic'): SecFilingDocument {
  const now = new Date().toISOString();
  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: title,
      alignment: 'left',
      bold: true,
      color: '#0f766e',
      spacingBottom: 8,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'paragraph',
      section: 'Overview',
      text: 'Executive strategic initiative for scaling automated compliance document processing and multi-party review workflows.',
      alignment: 'left',
      spacingBottom: 16,
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'callout',
      section: 'Goals',
      variant: 'success',
      title: 'Key Deliverables & Objectives',
      content: '1. Reduce filing turnaround time by 65%\n2. Full real-time revision branching with zero merge conflicts\n3. One-click Word and SEC EDGAR export fidelity.',
    },
  ];

  return {
    id: `doc-proposal-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Proposal',
    period: '2026',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generate6KDoc(title = 'Form 6-K (Foreign Private Issuer Report)'): SecFilingDocument {
  const now = new Date().toISOString();
  const bsTemplate = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === 'balance_sheet')?.block;

  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'image',
      section: 'Cover Page',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'ZenaTech Logo',
      alignment: 'center',
      width: 260,
      spacingTop: 0,
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: 'UNITED STATES SECURITIES AND EXCHANGE COMMISSION',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'heading',
      section: 'Cover Page',
      level: 2,
      text: 'FORM 6-K — REPORT OF FOREIGN PRIVATE ISSUER',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-3`,
      type: 'heading',
      section: 'Cover Page',
      level: 2,
      text: 'For the Period Ended June 30, 2026',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-4`,
      type: 'financial_table',
      section: 'Financial Statements',
      title: 'Condensed Interim Consolidated Financial Statements',
      headers: bsTemplate?.headers || ['', '', 'June 30, 2026', 'Dec 31, 2025'],
      columnAlignments: bsTemplate?.columnAlignments || ['left', 'right', 'right', 'right'],
      rows: (bsTemplate?.rows || []).map((r, i) => ({ ...r, id: `bs-6k-${i}` })),
    },
    {
      id: `blk-${Date.now()}-5`,
      type: 'signature',
      section: 'Signatures',
      title: 'Signatures Pursuant to the Requirements of the Securities Exchange Act of 1934',
      officers: [
        {
          id: 'sig-6k-1',
          name: 'Shaun Passley, Ph.D.',
          title: 'Chief Executive Officer & Director',
          date: new Date().toLocaleDateString(),
          signed: false,
          signatureText: '',
        },
      ],
    },
  ];

  return {
    id: `doc-6k-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Form 6-K',
    period: 'Q2 2026',
    currency: 'CAD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generateS1Doc(title = 'Form S-1 (Registration Statement)'): SecFilingDocument {
  const now = new Date().toISOString();
  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: 'UNITED STATES SECURITIES AND EXCHANGE COMMISSION',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'heading',
      section: 'Cover Page',
      level: 2,
      text: 'FORM S-1 — REGISTRATION STATEMENT UNDER THE SECURITIES ACT OF 1933',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-2`,
      type: 'paragraph',
      section: 'Prospectus Summary',
      text: 'This prospectus relates to the registration and offering of common shares of ZenaTech, Inc.',
      alignment: 'left',
    },
  ];

  return {
    id: `doc-s1-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'Form S-1',
    period: '2026',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export function generateDef14aDoc(title = 'DEF 14A (Proxy Statement)'): SecFilingDocument {
  const now = new Date().toISOString();
  const blocks: SecBlock[] = [
    {
      id: `blk-${Date.now()}-0`,
      type: 'heading',
      section: 'Cover Page',
      level: 1,
      text: 'SCHEDULE 14A INFORMATION',
      alignment: 'center',
      bold: true,
      color: '#0E2841',
    },
    {
      id: `blk-${Date.now()}-1`,
      type: 'heading',
      section: 'Cover Page',
      level: 2,
      text: 'Proxy Statement Pursuant to Section 14(a) of the Securities Exchange Act of 1934',
      alignment: 'center',
      bold: true,
    },
  ];

  return {
    id: `doc-def14a-${Date.now()}`,
    title,
    symbol: 'ZENA',
    formType: 'DEF 14A',
    period: 'FY 2026',
    currency: 'USD',
    status: 'draft',
    version: 'v1.0.0',
    versionNumber: 1,
    blocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: 'Current User',
  };
}

export const DOCUMENT_TEMPLATES: DocumentTemplateDefinition[] = [
  {
    id: 'blank',
    name: 'Blank document',
    subtitle: 'Blank document',
    category: 'core',
    color: '#4285F4',
    thumbnailType: 'blank',
    description: 'Start fresh with a clean SEC filing canvas',
    generateDoc: generateBlankDocument,
  },
  {
    id: '10-q',
    name: 'Form 10-Q',
    subtitle: 'Quarterly report',
    category: 'sec',
    color: '#1e3a8a',
    thumbnailType: 'serif_resume',
    description: 'Form 10-Q Quarterly Report with financial statements',
    generateDoc: generate10QDoc,
  },
  {
    id: '10-k',
    name: 'Form 10-K',
    subtitle: 'Annual report',
    category: 'sec',
    color: '#e11d48',
    thumbnailType: 'coral_resume',
    description: 'Form 10-K Comprehensive Annual Audited Report',
    generateDoc: generate10KDoc,
  },
  {
    id: '8-k',
    name: 'Form 8-K',
    subtitle: 'Current report',
    category: 'sec',
    color: '#059669',
    thumbnailType: 'spearmint_letter',
    description: 'Form 8-K Current Event Disclosure and Notice',
    generateDoc: generate8KDoc,
  },
  {
    id: '6-k',
    name: 'Form 6-K',
    subtitle: 'Interim report',
    category: 'sec',
    color: '#0284c7',
    thumbnailType: 'tropic_proposal',
    description: 'Form 6-K Foreign Private Issuer Periodic Report',
    generateDoc: generate6KDoc,
  },
  {
    id: 's-1',
    name: 'Form S-1',
    subtitle: 'Registration',
    category: 'sec',
    color: '#d97706',
    thumbnailType: 'geometric_brochure',
    description: 'Form S-1 General Registration Statement',
    generateDoc: generateS1Doc,
  },
  {
    id: 'def-14a',
    name: 'DEF 14A',
    subtitle: 'Proxy statement',
    category: 'sec',
    color: '#7c3aed',
    thumbnailType: 'luxe_report',
    description: 'Schedule 14A Annual Shareholder Proxy Statement',
    generateDoc: generateDef14aDoc,
  },
];


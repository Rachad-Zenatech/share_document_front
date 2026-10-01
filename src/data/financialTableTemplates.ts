import type { ComponentType } from 'react';
import type { SecFinancialTableBlock } from '../types/secFiling';
import type { SecFinancialTableTemplate } from '../types/secFilingTemplate';
import {
  Scale,
  TrendingDown,
  Activity,
  PieChart,
  FileSpreadsheet,
  Table
} from 'lucide-react';

export interface FinancialTableTemplate {
  id: string;
  name: string;
  badge?: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  /** Structure copied into a financial_table block. Ids are regenerated on insert. */
  block: Partial<SecFinancialTableBlock>;
}

export const FINANCIAL_TABLE_TEMPLATES: FinancialTableTemplate[] = [
  {
    id: 'balance_sheet',
    name: 'Balance Sheet (Financial Position)',
    badge: '4 Cols',
    description: 'Assets, Liabilities & Equity with note refs, comparative periods & banded rows',
    icon: Scale,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
    block: {
      title: 'Table: Statements of Financial Position',
      // Mirrors the live filing's Statements of Financial Position: the comparative
      // period caption lives in the first three rows of the table body,
      // column 1 carries note references, and value columns are right aligned.
      headers: ['', '', 'As of', 'As of'],
      columnAlignments: ['left', 'right', 'right', 'right'],
      rows: [
        { id: 'bs-1', type: 'header', cells: ['', '', 'As of', 'As of'], bold: true },
        { id: 'bs-2', type: 'data', cells: ['', '', 'June 30,', 'December 31,'], bold: true },
        { id: 'bs-3', type: 'data', cells: ['', 'Notes', '2026', '2025'], bold: true },
        { id: 'bs-4', type: 'header', cells: ['Assets', '', '', ''], bold: true },
        { id: 'bs-5', type: 'section_title', cells: ['Current assets', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'bs-6', type: 'data', cells: ['Cash', '3', '$12,235,259', '$5,980,366'], bold: true, indent: 1 },
        { id: 'bs-7', type: 'data', cells: ['Marketable securities', '3', '22,340,879', '9,093,887'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-8', type: 'data', cells: ['Accounts receivable, net', '3', '5,145,822', '4,166,885'], bold: true, indent: 1 },
        { id: 'bs-9', type: 'data', cells: ['Short-term advance to affiliate', '14', '11,224,876', '9,095,545'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-10', type: 'data', cells: ['Inventory of drone components', '3', '4,399,969', '2,842,794'], bold: true, indent: 1 },
        { id: 'bs-11', type: 'data', cells: ['Other current assets', '3', '2,954,922', '2,030,715'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-12', type: 'total', cells: ['Total current assets', '', '58,301,728', '33,210,192'], bold: true, indent: 2 },
        { id: 'bs-13', type: 'section_title', cells: ['Long–term assets', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'bs-14', type: 'data', cells: ['Property, plant & equipment, net', '6', '17,226,552', '11,692,444'], bold: true, indent: 1 },
        { id: 'bs-15', type: 'data', cells: ['Right of Use assets', '3', '7,847,688', '4,087,653'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-16', type: 'data', cells: ['Note receivable from affiliate', '5, 14', '341,850', '341,850'], bold: true, indent: 1 },
        { id: 'bs-17', type: 'data', cells: ['Long-term advance to affiliates', '14', '17,995,355', '15,216,050'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-18', type: 'data', cells: ['Capital advances', '7', '2,659,851', '1,708,194'], bold: true, indent: 1 },
        { id: 'bs-19', type: 'data', cells: ['Loan initiation fees', '', '3,095,271', '3,282,221'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-20', type: 'data', cells: ['Product development costs, net', '8', '7,933,299', '6,682,795'], bold: true, indent: 1 },
        { id: 'bs-21', type: 'data', cells: ['Intangibles', '8', '13,840,706', '10,355,079'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-22', type: 'data', cells: ['Goodwill', '3,8', '18,735,192', '12,106,307'], bold: true, indent: 1 },
        { id: 'bs-23', type: 'data', cells: ['Other long-term assets', '3', '1,292,937', '1,080,656'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-24', type: 'total', cells: ['Total long–term assets', '', '90,968,701', '66,553,248'], bold: true, indent: 2 },
        { id: 'bs-25', type: 'total', cells: ['Total assets', '', '149,270,429', '99,763,441'], bold: true, shading: '#CCECFF', indent: 2 },
        { id: 'bs-26', type: 'header', cells: ['Liabilities and shareholders’ equity', '', '', ''], bold: true },
        { id: 'bs-27', type: 'section_title', cells: ['Current liabilities', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'bs-28', type: 'data', cells: ['Accounts payable and accrued liabilities', '', '9,466,499', '9,074,281'], bold: true, indent: 1 },
        { id: 'bs-29', type: 'data', cells: ['Warrant liability', '', '16,687,117', '0'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-30', type: 'data', cells: ['Contract Liabilities', '3', '1,784,223', '1,270,958'], bold: true, indent: 1 },
        { id: 'bs-31', type: 'data', cells: ['Lease liability', '3', '1,598,413', '921,068'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-32', type: 'data', cells: ['Current portion of loans payable', '9', '4,443,463', '3,689,457'], bold: true, indent: 1 },
        { id: 'bs-33', type: 'total', cells: ['Total current liabilities', '', '33,979,714', '14,955,764'], bold: true, shading: '#CCECFF', indent: 2 },
        { id: 'bs-34', type: 'section_title', cells: ['Long–term liabilities', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'bs-35', type: 'data', cells: ['Long-term lease obligation', '3', '6,483,504', '3,279,270'], bold: true, indent: 1 },
        { id: 'bs-36', type: 'data', cells: ['Loans payable', '9', '17,437,359', '13,566,956'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-37', type: 'total', cells: ['Total long–term liabilities', '', '23,920,863', '16,846,226'], bold: true, indent: 2 },
        { id: 'bs-38', type: 'total', cells: ['Total liabilities', '', '57,900,577', '31,801,990'], bold: true, shading: '#CCECFF', indent: 2 },
        { id: 'bs-39', type: 'section_title', cells: ['Shareholders’ equity', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'bs-40', type: 'data', cells: ['Super voting stock', '10', '5,550,000', '1,800,000'], bold: true, indent: 1 },
        { id: 'bs-41', type: 'data', cells: ['Preferred stock', '10', '82,710,000', '51,810,000'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-42', type: 'data', cells: ['Common stock', '10', '27,865,258', '14,406,266'], bold: true, indent: 1 },
        { id: 'bs-43', type: 'data', cells: ['Warrants', '10', '361,058', '361,058'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-44', type: 'data', cells: ['Contributed surplus', '', '239,917,894', '110,671,268'], bold: true, indent: 1 },
        { id: 'bs-45', type: 'data', cells: ['Foreign currency translation reserve', '2', '1,686,412', '(606,722)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-46', type: 'data', cells: ['Accumulated deficit', '', '(104,859,747)', '(53,742,186)'], bold: true, indent: 1 },
        { id: 'bs-47', type: 'data', cells: ['Common Control Adjustment Account', '', '(161,861,023)', '(56,738,233)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'bs-48', type: 'total', cells: ['Total shareholders’ equity', '', '91,369,852', '67,961,451'], bold: true, indent: 2 },
        { id: 'bs-49', type: 'total', cells: ['Total liabilities and shareholders’ equity', '', '$149,270,429', '$99,763,441'], bold: true, shading: '#CCECFF', indent: 2 }
      ]
    }
  },
  {
    id: 'income_statement',
    name: 'Income Statement (Comprehensive Loss)',
    badge: '5 Cols',
    description: 'Revenue, operating expenses, other income, comprehensive loss, EPS & share counts',
    icon: TrendingDown,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
    block: {
      title: 'Table: Statements of Comprehensive Loss',
      // Mirrors the live filing's Statements of Comprehensive Loss: the comparative
      // period caption lives in the first three rows of the table body, and every
      // value column is right aligned.
      headers: ['', 'Three Months Ended', 'Six Months Ended', '', ''],
      columnAlignments: ['left', 'right', 'right', 'right', 'right'],
      rows: [
        { id: 'is-1', type: 'header', cells: ['', 'Three Months Ended', 'Six Months Ended', '', ''], bold: true },
        { id: 'is-2', type: 'data', cells: ['', 'June 30,', 'June 30,', '', ''], bold: true },
        { id: 'is-3', type: 'data', cells: ['', '2026', '2025', '2026', '2025'], bold: true },
        { id: 'is-4', type: 'section_title', cells: ['Revenue', '', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'is-5', type: 'data', cells: ['Drone as a Service', '$8,100,566', '$1,580,582', '$16,442,433', '$1,983,348'], bold: true, indent: 1 },
        { id: 'is-6', type: 'data', cells: ['Software as a Service', '1,231,720', '661,080', '1,292,172', '1,393,968'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-7', type: 'total', cells: ['Total revenue', '9,332,286', '2,241,662', '17,734,605', '3,377,316'], bold: true, indent: 2 },
        { id: 'is-8', type: 'section_title', cells: ['General and administrative expenses', '', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'is-9', type: 'data', cells: ['Sales and marketing', '7,118,782', '1,636,621', '11,108,368', '3,237,017'], bold: true, indent: 1 },
        { id: 'is-10', type: 'data', cells: ['Wages and benefits', '12,095,294', '2,413,056', '20,559,782', '3,219,003'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-11', type: 'data', cells: ['Stock-based compensation', '67,275', '35,000', '8,941,526', '430,000'], bold: true, indent: 1 },
        { id: 'is-12', type: 'data', cells: ['Stock issued for services', '–', '84,439', '–', '235,544'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-13', type: 'data', cells: ['General and administrative', '5,537,985', '943,832', '9,322,830', '1,602,653'], bold: true, indent: 1 },
        { id: 'is-14', type: 'data', cells: ['Professional fees', '1,482,748', '191,991', '2,894,467', '494,300'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-15', type: 'data', cells: ['Amortization and depreciation', '1,218,818', '207,791', '2,594,305', '371,189'], bold: true, indent: 1 },
        { id: 'is-16', type: 'data', cells: ['Programming and support fees', '3,714,536', '597,479', '5,785,640', '689,431'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-17', type: 'total', cells: ['Total operating expenses', '31,235,438', '6,151,472', '61,206,918', '10,279,137'], bold: true, indent: 2 },
        { id: 'is-18', type: 'data', cells: ['Loss before other income (expenses)', '(21,903,152)', '(3,909,810)', '(43,472,313)', '(6,901,821)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-19', type: 'section_title', cells: ['Other (Income)/Expenses', '', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'is-20', type: 'data', cells: ['Finance expenses', '(1,573,428)', '2,563,359', '3,509,972', '4,180,908'], bold: true, indent: 1 },
        { id: 'is-21', type: 'data', cells: ['Interest income', '(549,039)', '(7,074)', '(562,928)', '(14,176)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-22', type: 'data', cells: ['Foreign currency exchange (gain)/loss', '2,098,985', '(344,584)', '2,067,798', '(336,723)'], bold: true, indent: 1 },
        { id: 'is-23', type: 'data', cells: ['Unrealized (gain)/loss on marketable securities', '2,687,985', '–', '2,630,405', '–'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-24', type: 'total', cells: ['Net loss for the period', '(24,567,655)', '(6,121,511)', '(51,117,560)', '(10,731,830)'], bold: true, indent: 2 },
        { id: 'is-25', type: 'section_title', cells: ['Other comprehensive items', '', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'is-26', type: 'data', cells: ['Foreign currency translation reserve', '2,949,513', '(676,806)', '2,293,134', '(678,923)'], bold: true, indent: 1 },
        { id: 'is-27', type: 'data', cells: ['Comprehensive (loss) for the period', '$(21,618,143)', '$(6,798,317)', '$(48,824,427)', '$(11,410,753)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-28', type: 'section_title', cells: ['Net (loss) per share:', '', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'is-29', type: 'data', cells: ['Basic', '$(0.30)', '(0.21)', '(0.76)', '$(0.38)'], bold: true, indent: 1 },
        { id: 'is-30', type: 'data', cells: ['Diluted', '$(0.30)', '(0.21)', '(0.76)', '$(0.38)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-31', type: 'data', cells: ['Net comprehensive (loss) loss per share', '', '', '', ''], bold: true, indent: 1 },
        { id: 'is-32', type: 'data', cells: ['Basic', '$(0.27)', '(0.24)', '(0.72)', '$(0.40)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'is-33', type: 'data', cells: ['Diluted', '$(0.27)', '(0.24)', '(0.72)', '$(0.40)'], bold: true, indent: 1 },
        { id: 'is-34', type: 'section_title', cells: ['Shares used in computing earnings per share:', '', '', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'is-35', type: 'data', cells: ['Basic', '80,977,561', '28,526,538', '67,375,487', '28,526,538'], bold: true, indent: 1 },
        { id: 'is-36', type: 'data', cells: ['Diluted', '80,977,561', '28,526,538', '67,375,487', '28,526,538'], bold: true, shading: '#CCECFF', indent: 1 }
      ]
    }
  },
  {
    id: 'cash_flows',
    name: 'Statement of Cash Flows',
    badge: '3 Cols',
    description: 'Operating, Investing & Financing activities with cash reconciliation',
    icon: Activity,
    color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50',
    block: {
      title: 'Table: Statements of Cash Flows',
      // Mirrors the live filing's Statements of Cash Flows: the comparative period
      // caption lives in the first three rows of the table body, and both value
      // columns are right aligned.
      headers: ['', 'Six Months Ended June 30, 2026', 'Six Months Ended June 30, 2025'],
      columnAlignments: ['left', 'right', 'right'],
      rows: [
        { id: 'cf-1', type: 'header', cells: ['', 'Six Months Ended', 'Six Months Ended'], bold: true },
        { id: 'cf-2', type: 'data', cells: ['', 'June 30,', 'June 30,'], bold: true },
        { id: 'cf-3', type: 'data', cells: ['', '2026', '2025'], bold: true },
        { id: 'cf-4', type: 'section_title', cells: ['Operating Activities:', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'cf-5', type: 'data', cells: ['Net loss for the period', '(51,117,560)', '$(10,731,830)'], bold: true },
        { id: 'cf-6', type: 'data', cells: ['Item not affecting cash:', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'cf-7', type: 'data', cells: ['Amortization and depreciation', '2,594,305', '371,189'], bold: true, indent: 1 },
        { id: 'cf-8', type: 'data', cells: ['Bad debts', '176,319', '1,043'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-9', type: 'data', cells: ['Amortization of loan initiation fees', '186,950', '217,550'], bold: true, indent: 1 },
        { id: 'cf-10', type: 'data', cells: ['Loan derivative and non-cash finance expense', '7,977,562', '424,784'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-11', type: 'data', cells: ['Stock-based compensation', '8,941,526', '430,000'], bold: true, indent: 1 },
        { id: 'cf-12', type: 'data', cells: ['Stock issued for services', '–', '395,000'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-13', type: 'data', cells: ['Loss on disposal of assets', '19,921', '–'], bold: true, indent: 1 },
        { id: 'cf-14', type: 'data', cells: ['Lease obligation', '(591,343)', '(28,616)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-15', type: 'data', cells: ['Direct Funding discount (non-cash financing cost)', '18,547,843', '–'], bold: true, indent: 1 },
        { id: 'cf-16', type: 'data', cells: ['Changes in non–cash working capital:', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'cf-17', type: 'data', cells: ['Accounts receivable', '(978,937)', '(1,349,350)'], bold: true, indent: 1 },
        { id: 'cf-18', type: 'data', cells: ['Inventory of drone components', '(1,557,175)', '–'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-19', type: 'data', cells: ['Other current assets', '(7,157,053)', '(946,968)'], bold: true, indent: 1 },
        { id: 'cf-20', type: 'data', cells: ['Accounts payable and accrued liabilities', '392,218', '234,927'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-21', type: 'data', cells: ['Deferred revenue', '513,265', '(501,420)'], bold: true, indent: 1 },
        { id: 'cf-22', type: 'data', cells: ['Change in dues from affiliate', '(4,904,642)', '(2,362,582)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-23', type: 'total', cells: ['Cash Used in Operating Activities', '(26,956,802)', '(10,842,797)'], bold: true, indent: 2 },
        { id: 'cf-24', type: 'section_title', cells: ['Investing Activities:', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'cf-25', type: 'data', cells: ['Purchase of PP&E', '(3,712,754)', '(1,465,045)'], bold: true, indent: 1 },
        { id: 'cf-26', type: 'data', cells: ['Proceeds from sale of assets', '128,000', '–'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-27', type: 'data', cells: ['Marketable securities', '1,902,372', '–'], bold: true, indent: 1 },
        { id: 'cf-28', type: 'data', cells: ['Acquisition costs', '(5,593,182)', '(2,677,023)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-29', type: 'data', cells: ['Product development costs', '(1,449,102)', '(809,609)'], bold: true, indent: 1 },
        { id: 'cf-30', type: 'data', cells: ['Long-term assets (capital advances)', '(951,657)', '6,639'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-31', type: 'data', cells: ['Other Long-term assets', '(212,281)', '–'], bold: true, indent: 1 },
        { id: 'cf-32', type: 'total', cells: ['Cash Used in Investing Activities', '(9,888,603)', '(4,945,038)'], bold: true, shading: '#CCECFF', indent: 2 },
        { id: 'cf-33', type: 'section_title', cells: ['Financing activities:', '', ''], bold: true, shading: '#CCECFF' },
        { id: 'cf-34', type: 'data', cells: ['Loans under line of credit', '11,098,010', '21,779,106'], bold: true, indent: 1 },
        { id: 'cf-35', type: 'data', cells: ['Warrants exercised', '–', '2,476,478'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-36', type: 'data', cells: ['Proceeds from stock sale', '34,172,555', '–'], bold: true, indent: 1 },
        { id: 'cf-37', type: 'data', cells: ['Repayment of loans', '(2,406,393)', '(632,568)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-38', type: 'total', cells: ['Cash Provided by Financing Activities', '42,864,172', '23,623,016'], bold: true, indent: 2 },
        { id: 'cf-39', type: 'data', cells: ['Effect of foreign exchange', '236,126', '(1,296,590)'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-40', type: 'data', cells: ['Change in cash', '6,254,893', '6,531,952'], bold: true, indent: 1 },
        { id: 'cf-41', type: 'data', cells: ['Cash, beginning of the period', '5,980,366', '3,754,075'], bold: true, shading: '#CCECFF', indent: 1 },
        { id: 'cf-42', type: 'total', cells: ['Cash, end of the period', '12,235,259', '$10,286,027'], bold: true, indent: 2 }
      ]
    }
  },
  {
    id: 'shareholders_equity',
    name: 'Shareholders’ Equity Matrix',
    badge: '5 Cols',
    description: 'Rollforward matrix: Common shares, Contributed surplus & Deficit',
    icon: PieChart,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
    block: {
      title: 'Consolidated Statements of Changes in Shareholders’ Equity',
      headers: ['Description / Activity', 'Common Shares ($)', 'Contributed Surplus ($)', 'Deficit ($)', 'Total Equity ($)'],
      columnAlignments: ['left', 'right', 'right', 'right', 'right'],
      columnWidths: ['36%', '16%', '16%', '16%', '16%'],
      rows: [
        { id: 'se-1', type: 'data', cells: ['Balance, December 31, 2025', '38,200,000', '3,850,000', '(13,438,412)', '28,611,588'], bold: true },
        { id: 'se-2', type: 'data', cells: ['Shares issued for cash (private placement)', '19,500,000', '', '', '19,500,000'] },
        { id: 'se-3', type: 'data', cells: ['Share issue transaction costs', '(250,000)', '', '', '(250,000)'] },
        { id: 'se-4', type: 'data', cells: ['Stock-based compensation expense', '', '270,000', '', '270,000'] },
        { id: 'se-5', type: 'data', cells: ['Shares issued on warrant exercises', '1,000,000', '', '', '1,000,000'] },
        { id: 'se-6', type: 'data', cells: ['Net loss and comprehensive loss for period', '', '', '(3,198,295)', '(3,198,295)'] },
        { id: 'se-7', type: 'total', cells: ['Balance, June 30, 2026', '$58,450,000', '$4,120,000', '$(16,302,830)', '$46,267,170'], bold: true, underline: true, doubleUnderline: true }
      ]
    }
  },
  {
    id: 'acquisitions_and_sales',
    name: 'Acquisitions and Sales',
    badge: '4 Cols',
    description: 'Schedule of business acquisitions, purchase dates, consideration & goodwill',
    icon: FileSpreadsheet,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
    block: {
      title: 'Table: ACQUISITIONS AND SALES',
      headers: [
        'Acquired Company - Basis',
        'Acquisition Date',
        'Consideration (CAD)',
        'Goodwill (CAD)'
      ],
      columnAlignments: ['left', 'left', 'right', 'right'],
      columnWidths: ['42%', '22%', '18%', '18%'],
      rows: [
        { id: 'acq-1', type: 'data', cells: ['Weddle Surveying, Inc.', 'January 14, 2025', '720,615', '258,470'] },
        { id: 'acq-2', type: 'data', cells: ['KJM Land Surveying, Inc.', 'January 22, 2025', '549,040', '198,251'] },
        { id: 'acq-3', type: 'data', cells: ['Othership, Limited', 'March 14, 2025', '713,752', '612,071'] },
        { id: 'acq-4', type: 'data', cells: ['Wallace Surveying Corporation', 'April 2, 2025', '1,784,380', '630,956'] },
        { id: 'acq-5', type: 'data', cells: ['Miller Land Corporation', 'April 7, 2025', '1,166,710', '458,497'] },
        { id: 'acq-6', type: 'data', cells: ['Laventure & Associates, Inc. and Atlantic Civil Engineering', 'May 21, 2025', '694,349', '296,893'] },
        { id: 'acq-7', type: 'data', cells: ['Empire Land Surveying', 'June 9, 2025', '274,520', '140,071'] },
        { id: 'acq-8', type: 'data', cells: ['Cardinal Civil Resources', 'August 1, 2025', '3,727,982', '1,562,179'] },
        { id: 'acq-9', type: 'data', cells: ['Morgan Surveying', 'August 4, 2025', '844,149', '354,530'] },
        { id: 'acq-10', type: 'data', cells: ['Lescure Engineers, Inc.', 'September 11, 2025', '520,141', '206,044'] },
        { id: 'acq-11', type: 'data', cells: ['A&J Land Surveyor, Inc.', 'September 23, 2025', '648,492', '122,344'] },
        { id: 'acq-12', type: 'data', cells: ['Putt Land Surveying, Inc.', 'October 3, 2025', '789,245', '354,732'] },
        { id: 'acq-13', type: 'data', cells: ['Rampart Surveys Inc.', 'November 12, 2025', '754,930', '228,655'] },
        { id: 'acq-14', type: 'data', cells: ['Smith Surveying Group LLC', 'November 17, 2025', '2,081,777', '916,193'] },
        { id: 'acq-15', type: 'data', cells: ['Casado Design Ltd.', 'December 9, 2025', '793,819', '387,796'] },
        { id: 'acq-16', type: 'data', cells: ['Vara 3D Inc.', 'December 12, 2025', '1,196,175', '525,396'] },
        { id: 'acq-17', type: 'data', cells: ['Holt Surveying & Mapping, Inc.', 'December 15, 2025', '505,443', '150,800'] },
        { id: 'acq-18', type: 'data', cells: ['L.D. King Engineering', 'December 18, 2025', '4,130,866', '1,971,906'] },
        { id: 'acq-19', type: 'data', cells: ['Andrew Spiewak Land Surveyor, Inc.', 'December 22, 2025', '676,322', '270,793'] },
        { id: 'acq-20', type: 'data', cells: ['Sunrise Window Cleaners', 'December 22, 2025', '249,257', '108,057'] },
        { id: 'acq-21', type: 'data', cells: ['NOW Solutions, Inc.', 'April 6, 2026', '2,413,490', '1,416,443'] },
        { id: 'acq-22', type: 'data', cells: ['Andy Paris & Associates', 'April 8, 2026', '1,475,744', '657,892'] },
        { id: 'acq-23', type: 'data', cells: ['High Prairie Survey Company', 'May 28, 2026', '496,895', '24,574'] },
        { id: 'acq-24', type: 'data', cells: ['NorthGroup Consulting, LLP', 'June 1, 2026', '6,945,180', '2,490,694'] },
        { id: 'acq-25', type: 'data', cells: ['Green Earth Power Washing, LLC', 'June 22, 2026', '3,984,786', '1,922,232'] },
        { id: 'acq-total', type: 'total', cells: ['Total', '', '38,138,059', '18,735,192'], bold: true, underline: true, doubleUnderline: true }
      ]
    }
  },
  {
    id: 'note_schedule',
    name: 'Note Disclosure Schedule',
    badge: '4 Cols',
    description: 'Comparative schedule for loans, leases, receivables, or debt notes',
    icon: FileSpreadsheet,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50',
    block: {
      title: 'Schedule of Financial Details',
      headers: ['Description / Category', 'Note Ref', 'June 30, 2026 ($)', 'December 31, 2025 ($)'],
      columnAlignments: ['left', 'center', 'right', 'right'],
      columnWidths: ['50%', '10%', '20%', '20%'],
      rows: [
        { id: 'ns-1', type: 'category_header', cells: ['Current period balances', '', '', ''], bold: true, shading: '#DAE9F7' },
        { id: 'ns-2', type: 'data', cells: ['Principal / Primary amount', '7', '4,250,000', '3,100,000'] },
        { id: 'ns-3', type: 'data', cells: ['Accrued interest and adjustments', '', '320,000', '180,000'] },
        { id: 'ns-4', type: 'data', cells: ['Unamortized discount / fees', '', '(70,000)', '(90,000)'] },
        { id: 'ns-5', type: 'total', cells: ['Carrying value at period end', '', '4,500,000', '3,190,000'], bold: true, underline: true, doubleUnderline: true }
      ]
    }
  },
  {
    id: 'blank_table',
    name: 'Blank / Custom Financial Table',
    badge: 'Custom',
    description: 'Clean 4-column multi-period grid ready for custom lines and headings',
    icon: Table,
    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-zinc-800',
    block: {
      title: 'Financial Statement Table',
      headers: ['Description / Line Item', 'Notes', 'Current Period', 'Prior Period'],
      columnAlignments: ['left', 'center', 'right', 'right'],
      columnWidths: ['50%', '10%', '20%', '20%'],
      rows: [
        { id: 'bt-1', type: 'category_header', cells: ['Category header', '', '', ''], bold: true, shading: '#DAE9F7' },
        { id: 'bt-2', type: 'data', cells: ['Line item description', '', '', ''], indent: 1 },
        { id: 'bt-3', type: 'total', cells: ['Total net', '', '', ''], bold: true, underline: true, doubleUnderline: true, indent: 2 }
      ]
    }
  }
];

/**
 * Icon names as stored in `sec_financial_table_templates.icon`, mapped back to
 * lucide components. Unknown names fall back to a plain table icon so a template
 * created with a new icon name still renders.
 */
export const TEMPLATE_ICON_BY_NAME: Record<string, ComponentType<{ className?: string }>> = {
  scale: Scale,
  'trending-down': TrendingDown,
  activity: Activity,
  'pie-chart': PieChart,
  'file-spreadsheet': FileSpreadsheet,
  table: Table
};

const DEFAULT_TEMPLATE_COLOR = 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-zinc-800';

/**
 * Converts templates from the API into the shape the block menus consume.
 * `FINANCIAL_TABLE_TEMPLATES` remains the seed source and the offline fallback.
 */
export function resolveTableTemplates(
  apiTemplates: SecFinancialTableTemplate[] | undefined
): FinancialTableTemplate[] {
  if (!apiTemplates || apiTemplates.length === 0) return FINANCIAL_TABLE_TEMPLATES;
  return apiTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    badge: t.badge,
    description: t.description || '',
    icon: TEMPLATE_ICON_BY_NAME[t.icon] || Table,
    color: t.color || DEFAULT_TEMPLATE_COLOR,
    block: t.block as Partial<SecFinancialTableBlock>
  }));
}

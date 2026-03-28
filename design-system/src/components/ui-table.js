/**
 * Shared table behaviour stylesheet — import and adopt in any component
 * that renders tabular data. Provides consistent borders, hover, typography,
 * and alignment.
 *
 * Usage:
 *   import { TABLE_STYLES } from '../../design-system/src/components/ui-table.js';
 *   this.shadow.adoptedStyleSheets = [TABLE_STYLES, ...];
 *
 * Apply to your table: <table class="pos-table">
 * Row classes: .clickable (cursor pointer), .active (selected highlight)
 * Cell classes: .num (right-align + tabular nums), .positive/.negative (color)
 * Sub-value: <span class="sub-value">secondary text</span>
 */

export const TABLE_STYLES = new CSSStyleSheet();
TABLE_STYLES.replaceSync(`
  .pos-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--pos-font-size-sm, 13px);
  }

  .pos-table th {
    text-align: left;
    padding: 10px 12px;
    font-weight: 500;
    font-size: var(--pos-font-size-xs, 11px);
    color: var(--pos-color-text-tertiary, #9b9bb0);
    border-bottom: 2px solid var(--pos-color-border-default, #e2e2e8);
    white-space: nowrap;
    user-select: none;
  }

  /* Two-line header: primary label + sub-header */
  .pos-table th .sub-header {
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--pos-color-text-tertiary, #aaa);
    display: block;
    margin-top: 1px;
  }

  .pos-table th.sortable {
    cursor: pointer;
  }
  .pos-table th.sortable:hover {
    color: var(--pos-color-text-primary, #1a1a2e);
  }
  .pos-table th.sorted {
    color: var(--pos-color-action-primary, #4361ee);
  }

  .pos-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--pos-color-border-subtle, #f0f0f5);
    color: var(--pos-color-text-primary, #1a1a2e);
    vertical-align: top;
  }

  .pos-table tbody tr:hover td {
    background: var(--pos-color-background-secondary, #f8f8fc);
  }

  .pos-table tbody tr.clickable {
    cursor: pointer;
  }

  .pos-table tbody tr.active td {
    background: color-mix(in srgb, var(--pos-color-action-primary, #4361ee) 6%, transparent);
  }

  /* Right-aligned numeric cells */
  .pos-table th.num,
  .pos-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* Color utility classes */
  .pos-table .positive { color: #16a34a; }
  .pos-table .negative { color: #dc2626; }

  /* Secondary text below primary value */
  .pos-table .sub-value {
    display: block;
    font-size: var(--pos-font-size-xs, 11px);
    margin-top: 1px;
    color: var(--pos-color-text-tertiary, #9b9bb0);
  }

  /* Footer / totals row */
  .pos-table tfoot td {
    padding: 10px 10px;
    border-top: 2px solid var(--pos-color-border-default, #e2e2e8);
    border-bottom: none;
    font-weight: 600;
  }

  /* Hover actions inside a cell */
  .pos-table .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    visibility: hidden;
  }
  .pos-table tbody tr:hover .row-actions {
    visibility: visible;
  }
  .pos-table .row-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--pos-radius-sm, 4px);
    background: transparent;
    color: var(--pos-color-text-secondary, #6b6b80);
    cursor: pointer;
    padding: 0;
  }
  .pos-table .row-action-btn:hover {
    background: var(--pos-color-border-default, #e2e2e8);
    color: var(--pos-color-text-primary, #1a1a2e);
  }
  .pos-table .row-action-btn.delete:hover {
    color: var(--pos-color-priority-urgent, #dc2626);
  }
  .pos-table .row-action-btn svg {
    pointer-events: none;
  }
`);

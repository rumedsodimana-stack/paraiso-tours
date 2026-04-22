/**
 * Thin client-safe catalog of tool names → categories.
 *
 * The full tool registry (`agent-tools.ts`) imports server-only modules
 * (db, action files) and can't be used in client components. This file
 * exports just the categorization so the UI knows which proposals
 * auto-execute and which need HITL approval, without pulling server code.
 *
 * Keep in sync with AGENT_TOOLS in agent-tools.ts. A unit test asserts
 * the two lists stay aligned.
 */

export type ToolCategory = "read" | "create" | "update" | "delete" | "send";

export const TOOL_CATEGORY: Record<string, ToolCategory> = {
  // Leads / bookings
  search_leads: "read",
  get_lead: "read",
  create_lead: "create",
  update_lead: "update",
  update_lead_status: "update",
  delete_lead: "delete",

  // Tours
  list_tours: "read",
  get_tour: "read",
  schedule_tour_from_lead: "create",
  update_tour_status: "update",
  mark_tour_completed: "update",
  delete_tour: "delete",

  // Invoices
  list_invoices: "read",
  get_invoice: "read",
  create_invoice_from_lead: "create",
  update_invoice_status: "update",

  // Payments / payables
  list_payments: "read",
  mark_payment_received: "update",
  mark_payable_paid: "update",
  create_invoice_from_payment: "create",

  // Packages
  list_packages: "read",
  get_package: "read",
  create_package: "create",
  update_package: "update",
  delete_package: "delete",

  // Hotels / suppliers
  list_hotels: "read",
  get_hotel: "read",
  create_hotel: "create",
  update_hotel: "update",
  delete_hotel: "delete",

  // Meal plans
  create_meal_plan: "create",
  update_meal_plan: "update",
  delete_meal_plan: "delete",

  // Activities
  create_activity: "create",
  update_activity: "update",
  delete_activity: "delete",

  // Employees
  create_employee: "create",
  update_employee: "update",
  delete_employee: "delete",

  // Quotations
  mark_quotation_sent: "update",
  accept_quotation: "update",
  reject_quotation: "update",
  delete_quotation: "delete",

  // Todos
  list_todos: "read",
  create_todo: "create",
  toggle_todo: "update",
  delete_todo: "delete",

  // Communications
  send_invoice_to_guest: "send",
  send_itinerary_to_guest: "send",
  send_pre_trip_reminder: "send",
  send_post_trip_followup: "send",
  send_booking_change_notice: "send",
  send_supplier_remittance: "send",
  send_supplier_change_notice: "send",

  // Payroll
  list_payroll_runs: "read",
};

export function getToolCategory(name: string): ToolCategory | null {
  return TOOL_CATEGORY[name] ?? null;
}

/** True if this tool category triggers the HITL approval card. */
export function toolRequiresApproval(name: string): boolean {
  const cat = TOOL_CATEGORY[name];
  return cat === "update" || cat === "delete";
}

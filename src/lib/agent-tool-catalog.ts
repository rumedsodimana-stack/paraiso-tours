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

  // Flow-aware catalog reads (destinations, activities, meal plans, pricing)
  list_destinations: "read",
  list_activities: "read",
  list_meal_plans: "read",
  suggest_package_pricing: "read",

  // Communications history (sent/failed emails, derived from audit log)
  list_communications: "read",

  // Full-coverage reads
  list_employees: "read",
  get_employee: "read",
  list_quotations: "read",
  get_quotation: "read",
  get_payment: "read",
  get_todo: "read",
  list_audit_logs: "read",
  list_ai_interactions: "read",
  list_ai_knowledge: "read",
  list_client_bookings: "read",
  get_app_settings: "read",

  // Full-coverage writes
  create_quotation: "create",
  update_quotation: "update",
  create_payment: "create",
  update_payment: "update",
  delete_payment: "delete",
  update_invoice: "update",
  delete_invoice: "delete",
  update_tour: "update",
  update_todo: "update",
  create_planner_activity: "create",
  update_planner_activity: "update",
  delete_planner_activity: "delete",
  create_ai_knowledge: "create",
  update_ai_knowledge: "update",
  create_payroll_run: "create",
  update_payroll_run: "update",

  // Universal fallback — lets the agent handle questions we haven't wired
  // a specific tool for. Read-only; draft_message only returns text.
  inspect_any: "read",
  draft_message: "read",

  // Self-extension: agent records new procedures + context.
  register_procedure: "create",
  remember_context: "create",
};

export function getToolCategory(name: string): ToolCategory | null {
  return TOOL_CATEGORY[name] ?? null;
}

/** True if this tool category triggers the HITL approval card. */
export function toolRequiresApproval(name: string): boolean {
  const cat = TOOL_CATEGORY[name];
  return cat === "update" || cat === "delete";
}

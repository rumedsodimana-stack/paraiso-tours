/**
 * Agent tool registry — full app control via chat.
 *
 * Every admin capability is exposed as a typed tool the agent can propose.
 *
 * Approval policy (simplified — only deletes are gated):
 *
 *   category   | auto-execute? | user confirmation required?
 *   -----------+---------------+----------------------------
 *   read       | YES           | no
 *   create     | YES           | no
 *   update     | YES           | no  (status changes, edits, marks)
 *   send       | YES           | no  (guest/supplier email — irreversible-ish)
 *   delete     | NO            | YES — HITL approval card
 *
 * The dispatcher (`executeProposalAction`) enforces this at the server
 * level, so even if a client tried to auto-approve a delete, the handler
 * would still require the proposal to carry an approved flag.
 *
 * To restore the stricter policy (gate updates too), change
 * `requiresApproval` below to `category === "update" || category === "delete"`.
 */

import { z } from "zod";

// ── Tool registry schema ────────────────────────────────────────────────

export type ToolCategory = "read" | "create" | "update" | "delete" | "send";

export interface ToolDescriptor {
  name: string;
  summary: string;
  category: ToolCategory;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

/** True if the category requires explicit human approval before running. */
export function requiresApproval(category: ToolCategory): boolean {
  return category === "delete";
}

// ── Shared helpers ──────────────────────────────────────────────────────

function ok(summary: string, data?: unknown): ToolResult {
  return { ok: true, summary, data };
}

function fail(error: string): ToolResult {
  return { ok: false, summary: error, error };
}

async function safe<T>(
  label: string,
  fn: () => Promise<T>
): Promise<ToolResult> {
  try {
    const data = await fn();
    return ok(`${label} succeeded.`, data);
  } catch (err) {
    return fail(
      err instanceof Error ? `${label} failed: ${err.message}` : `${label} failed.`
    );
  }
}

// ── Schemas ─────────────────────────────────────────────────────────────

const Id = z.string().min(1).max(200);
const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LimitS = z.number().int().min(1).max(100).optional();
const Search = z.string().max(200).optional();

// Leads / bookings
const SearchLeads = z.object({
  query: Search,
  status: z.enum(["new", "scheduled", "cancelled", "completed"]).optional(),
  limit: LimitS,
});
const LeadRef = z.object({ id: Id });
const CreateLead = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  destination: z.string().max(300).optional(),
  travelDate: Iso.optional(),
  pax: z.number().int().min(1).max(500).optional(),
  packageId: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});
const UpdateLead = CreateLead.partial().extend({ id: Id });
const UpdateLeadStatus = z.object({
  id: Id,
  status: z.enum(["new", "scheduled", "cancelled", "completed"]),
});

// Tours
const TourRef = z.object({ id: Id });
const ScheduleTour = z.object({ leadId: Id, startDate: Iso.optional() });
const UpdateTourStatus = z.object({
  id: Id,
  status: z.enum(["scheduled", "confirmed", "in-progress", "completed", "cancelled"]),
});

// Invoices
const InvoiceRef = z.object({ id: Id });
const UpdateInvoiceStatus = z.object({
  id: Id,
  status: z.enum(["pending_payment", "paid", "overdue", "cancelled"]),
});

// Payments
const PaymentRef = z.object({ id: Id });
const CreatePaymentFromInvoice = z.object({ paymentId: Id });
const MarkPaymentPaid = z.object({ id: Id });

// Packages
const PackageRef = z.object({ id: Id });
const CreatePackage = z.object({
  name: z.string().min(1).max(300),
  destination: z.string().max(300).optional(),
  region: z.string().max(300).optional(),
  duration: z.string().max(100).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  description: z.string().max(5000).optional(),
  featured: z.boolean().optional(),
});
const UpdatePackage = CreatePackage.partial().extend({ id: Id });

// Hotels / suppliers
const HotelRef = z.object({ id: Id });
const CreateHotel = z.object({
  name: z.string().min(1).max(300),
  type: z.enum(["hotel", "transport", "meal", "supplier"]),
  location: z.string().max(300).optional(),
  email: z.string().email().max(320).optional().or(z.literal("")),
  contact: z.string().max(200).optional(),
  defaultPricePerNight: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  destinationId: z.string().max(200).optional(),
});
const UpdateHotel = CreateHotel.partial().extend({ id: Id });

// Meal plans
const MealPlanRef = z.object({ id: Id, hotelId: Id });
const CreateMealPlan = z.object({
  hotelId: Id,
  label: z.string().min(1).max(200),
  pricePerPerson: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  description: z.string().max(2000).optional(),
});
const UpdateMealPlan = CreateMealPlan.partial().extend({ id: Id });

// Activities
const ActivityRef = z.object({ id: Id });
const CreateActivity = z.object({
  destinationId: Id,
  title: z.string().min(1).max(300),
  summary: z.string().max(2000).optional(),
  durationLabel: z.string().max(100).optional(),
  energy: z.enum(["easy", "moderate", "active"]).optional(),
  estimatedPrice: z.number().nonnegative().optional(),
});
const UpdateActivity = CreateActivity.partial().extend({ id: Id });

// Employees
const EmployeeRef = z.object({ id: Id });
const CreateEmployee = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  email: z.string().email().max(320).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  employmentType: z.enum(["employee", "contractor", "driver", "guide"]).optional(),
  salaryAmount: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
});
const UpdateEmployee = CreateEmployee.partial().extend({ id: Id });

// Quotations
const QuotationRef = z.object({ id: Id });
const AcceptQuotation = z.object({ id: Id, startDate: Iso.optional() });

// Todos
const TodoRef = z.object({ id: Id });
const CreateTodo = z.object({ title: z.string().min(1).max(500) });

// Comms
const SendItinerary = z.object({ tourId: Id });
const SendInvoice = z.object({ invoiceId: Id });
const SendPreTrip = z.object({ tourId: Id });
const SendPostTrip = z.object({ tourId: Id });
const SendBookingChange = z.object({
  tourId: Id,
  changeType: z.enum(["revision", "cancellation"]),
  summary: z.string().min(1).max(2000),
});
const SendSupplierRemittance = z.object({ paymentId: Id });
const SendSupplierChange = z.object({
  tourId: Id,
  supplierId: Id,
  supplierName: z.string().max(300).optional(),
  changeType: z.enum(["update", "cancellation"]),
  summary: z.string().min(1).max(2000),
});

// ── Registry ────────────────────────────────────────────────────────────

export const AGENT_TOOLS: ToolDescriptor[] = [
  // ── LEADS / BOOKINGS ───────────────────────────────────────────────
  {
    name: "search_leads",
    category: "read",
    summary: "Search bookings by name/email/reference. Optional status filter. Returns up to 100.",
    inputSchema: SearchLeads,
    handler: async (raw) => {
      const input = SearchLeads.parse(raw);
      const { getLeads } = await import("./db");
      const all = await getLeads();
      const needle = input.query?.toLowerCase().trim();
      let rows = all;
      if (needle) {
        rows = rows.filter(
          (l) =>
            l.name.toLowerCase().includes(needle) ||
            l.email.toLowerCase().includes(needle) ||
            (l.reference ?? "").toLowerCase().includes(needle)
        );
      }
      if (input.status) rows = rows.filter((l) => l.status === input.status);
      rows = rows.slice(0, input.limit ?? 20);
      return ok(`Found ${rows.length} booking${rows.length === 1 ? "" : "s"}.`, rows);
    },
  },
  {
    name: "get_lead",
    category: "read",
    summary: "Load a single booking by id.",
    inputSchema: LeadRef,
    handler: async (raw) => {
      const { id } = LeadRef.parse(raw);
      const { getLead } = await import("./db");
      const lead = await getLead(id);
      if (!lead) return fail(`No booking with id ${id}.`);
      return ok(`Loaded booking ${lead.name}.`, lead);
    },
  },
  {
    name: "create_lead",
    category: "create",
    summary: "Create a new booking (lead).",
    inputSchema: CreateLead,
    handler: async (raw) => {
      const input = CreateLead.parse(raw);
      const { createLead } = await import("./db");
      return safe("Create booking", () =>
        createLead({
          name: input.name,
          email: input.email,
          phone: input.phone ?? "",
          source: input.source ?? "Agent",
          status: "new",
          destination: input.destination,
          travelDate: input.travelDate,
          pax: input.pax ?? 1,
          packageId: input.packageId,
          notes: input.notes,
        })
      );
    },
  },
  {
    name: "update_lead",
    category: "update",
    summary: "Edit a booking's fields.",
    inputSchema: UpdateLead,
    handler: async (raw) => {
      const { id, ...rest } = UpdateLead.parse(raw);
      const { updateLead } = await import("./db");
      return safe("Update booking", async () => {
        const r = await updateLead(id, rest);
        if (!r) throw new Error("Booking not found");
        return r;
      });
    },
  },
  {
    name: "update_lead_status",
    category: "update",
    summary: "Change a booking's status (new/scheduled/completed/cancelled).",
    inputSchema: UpdateLeadStatus,
    handler: async (raw) => {
      const input = UpdateLeadStatus.parse(raw);
      const { updateLeadStatusAction } = await import("@/app/actions/leads");
      return safe("Update booking status", async () => {
        const r = await updateLeadStatusAction(input.id, input.status);
        if (!r?.success) throw new Error(r?.error ?? "Status change failed");
        return r;
      });
    },
  },
  {
    name: "delete_lead",
    category: "delete",
    summary: "Delete a booking permanently.",
    inputSchema: LeadRef,
    handler: async (raw) => {
      const { id } = LeadRef.parse(raw);
      const { deleteLeadAction } = await import("@/app/actions/leads");
      return safe("Delete booking", async () => {
        const r = await deleteLeadAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return { id, deleted: true };
      });
    },
  },

  // ── TOURS ──────────────────────────────────────────────────────────
  {
    name: "list_tours",
    category: "read",
    summary: "List all scheduled tours.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getTours } = await import("./db");
      const all = await getTours();
      return ok(`Found ${all.length} tour${all.length === 1 ? "" : "s"}.`, all.slice(0, limit ?? 50));
    },
  },
  {
    name: "get_tour",
    category: "read",
    summary: "Load a single tour by id.",
    inputSchema: TourRef,
    handler: async (raw) => {
      const { id } = TourRef.parse(raw);
      const { getTour } = await import("./db");
      const tour = await getTour(id);
      if (!tour) return fail(`No tour with id ${id}.`);
      return ok(`Loaded tour ${tour.packageName}.`, tour);
    },
  },
  {
    name: "schedule_tour_from_lead",
    category: "create",
    summary:
      "Schedule the tour for an approved booking. Creates tour, invoice, payment, supplier payables. Sends confirmation emails.",
    inputSchema: ScheduleTour,
    handler: async (raw) => {
      const input = ScheduleTour.parse(raw);
      const { scheduleTourFromLeadAction } = await import("@/app/actions/tours");
      return safe("Schedule tour", async () => {
        const r = await scheduleTourFromLeadAction(input.leadId, input.startDate);
        if (r.error || !r.id) throw new Error(r.error ?? "Scheduling failed");
        return r;
      });
    },
  },
  {
    name: "update_tour_status",
    category: "update",
    summary:
      "Change a tour's status (scheduled|confirmed|in-progress|completed|cancelled).",
    inputSchema: UpdateTourStatus,
    handler: async (raw) => {
      const input = UpdateTourStatus.parse(raw);
      const { updateTourStatusAction } = await import("@/app/actions/tours");
      return safe("Update tour status", async () => {
        const r = await updateTourStatusAction(input.id, input.status);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "mark_tour_completed",
    category: "update",
    summary: "Mark tour completed + paid. Sends payment receipt.",
    inputSchema: TourRef,
    handler: async (raw) => {
      const { id } = TourRef.parse(raw);
      const { markTourCompletedPaidAction } = await import("@/app/actions/tours");
      return safe("Mark tour completed", async () => {
        const r = await markTourCompletedPaidAction(id);
        if (r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_tour",
    category: "delete",
    summary: "Permanently delete a tour.",
    inputSchema: TourRef,
    handler: async (raw) => {
      const { id } = TourRef.parse(raw);
      const { deleteTourAction } = await import("@/app/actions/tours");
      return safe("Delete tour", async () => {
        const r = await deleteTourAction(id);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── INVOICES ───────────────────────────────────────────────────────
  {
    name: "list_invoices",
    category: "read",
    summary: "List invoices, most recent first.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getInvoices } = await import("./db");
      const all = await getInvoices();
      return ok(`Found ${all.length} invoice${all.length === 1 ? "" : "s"}.`, all.slice(0, limit ?? 50));
    },
  },
  {
    name: "get_invoice",
    category: "read",
    summary: "Load a single invoice by id.",
    inputSchema: InvoiceRef,
    handler: async (raw) => {
      const { id } = InvoiceRef.parse(raw);
      const { getInvoice } = await import("./db");
      const inv = await getInvoice(id);
      if (!inv) return fail(`No invoice with id ${id}.`);
      return ok(`Loaded invoice ${inv.invoiceNumber}.`, inv);
    },
  },
  {
    name: "create_invoice_from_lead",
    category: "create",
    summary: "Create an invoice for a booking (if none exists).",
    inputSchema: z.object({ leadId: Id }),
    handler: async (raw) => {
      const input = z.object({ leadId: Id }).parse(raw);
      const { createInvoiceFromLead } = await import("@/app/actions/invoices");
      return safe("Create invoice", async () => {
        const r = await createInvoiceFromLead(input.leadId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "update_invoice_status",
    category: "update",
    summary: "Change invoice status (pending_payment|paid|overdue|cancelled).",
    inputSchema: UpdateInvoiceStatus,
    handler: async (raw) => {
      const input = UpdateInvoiceStatus.parse(raw);
      const { updateInvoiceStatus } = await import("@/app/actions/invoices");
      return safe("Update invoice status", async () => {
        const r = await updateInvoiceStatus(input.id, input.status);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── PAYMENTS / PAYABLES ────────────────────────────────────────────
  {
    name: "list_payments",
    category: "read",
    summary: "List payments, most recent first.",
    inputSchema: z.object({ limit: LimitS, type: z.enum(["incoming", "outgoing"]).optional() }),
    handler: async (raw) => {
      const input = z
        .object({ limit: LimitS, type: z.enum(["incoming", "outgoing"]).optional() })
        .parse(raw);
      const { getPayments } = await import("./db");
      let all = await getPayments();
      if (input.type) all = all.filter((p) => p.type === input.type);
      return ok(`Found ${all.length} payment${all.length === 1 ? "" : "s"}.`, all.slice(0, input.limit ?? 50));
    },
  },
  {
    name: "mark_payment_received",
    category: "update",
    summary: "Mark an incoming payment as received.",
    inputSchema: MarkPaymentPaid,
    handler: async (raw) => {
      const input = MarkPaymentPaid.parse(raw);
      const { markPaymentReceived } = await import("@/app/actions/payments");
      return safe("Mark payment received", async () => {
        const r = await markPaymentReceived(input.id);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "mark_payable_paid",
    category: "update",
    summary:
      "Record that a supplier payable has been settled. Takes supplier id/name/amount/currency and the week range it covers.",
    inputSchema: z.object({
      supplierId: Id,
      supplierName: z.string().max(300),
      amount: z.number().positive(),
      currency: z.string().max(10),
      startDate: Iso,
      endDate: Iso,
    }),
    handler: async (raw) => {
      const input = z
        .object({
          supplierId: Id,
          supplierName: z.string().max(300),
          amount: z.number().positive(),
          currency: z.string().max(10),
          startDate: Iso,
          endDate: Iso,
        })
        .parse(raw);
      const { markPayablePaidAction } = await import("@/app/actions/payables");
      return safe("Mark payable paid", async () => {
        const r = await markPayablePaidAction(input);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "create_invoice_from_payment",
    category: "create",
    summary: "Generate an invoice/voucher from a payment record.",
    inputSchema: CreatePaymentFromInvoice,
    handler: async (raw) => {
      const input = CreatePaymentFromInvoice.parse(raw);
      const { createInvoiceFromPayment } = await import("@/app/actions/invoices");
      return safe("Create invoice from payment", async () => {
        const r = await createInvoiceFromPayment(input.paymentId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── PACKAGES ───────────────────────────────────────────────────────
  {
    name: "list_packages",
    category: "read",
    summary: "List tour packages in the catalog.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getPackages } = await import("./db");
      const all = await getPackages();
      return ok(`Found ${all.length} package${all.length === 1 ? "" : "s"}.`, all.slice(0, limit ?? 50));
    },
  },
  {
    name: "get_package",
    category: "read",
    summary: "Load a single package by id.",
    inputSchema: PackageRef,
    handler: async (raw) => {
      const { id } = PackageRef.parse(raw);
      const { getPackage } = await import("./db");
      const pkg = await getPackage(id);
      if (!pkg) return fail(`No package with id ${id}.`);
      return ok(`Loaded package ${pkg.name}.`, pkg);
    },
  },
  {
    name: "create_package",
    category: "create",
    summary: "Create a new tour package.",
    inputSchema: CreatePackage,
    handler: async (raw) => {
      const input = CreatePackage.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(input)) {
        if (v != null) fd.append(k, String(v));
      }
      const { createPackageAction } = await import("@/app/actions/packages");
      return safe("Create package", async () => {
        const r = await createPackageAction(fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "update_package",
    category: "update",
    summary: "Edit a tour package's fields.",
    inputSchema: UpdatePackage,
    handler: async (raw) => {
      const { id, ...rest } = UpdatePackage.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(rest)) {
        if (v != null) fd.append(k, String(v));
      }
      const { updatePackageAction } = await import("@/app/actions/packages");
      return safe("Update package", async () => {
        const r = await updatePackageAction(id, fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_package",
    category: "delete",
    summary: "Permanently delete a tour package.",
    inputSchema: PackageRef,
    handler: async (raw) => {
      const { id } = PackageRef.parse(raw);
      const { deletePackageAction } = await import("@/app/actions/packages");
      return safe("Delete package", async () => {
        const r = await deletePackageAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── HOTELS / SUPPLIERS ─────────────────────────────────────────────
  {
    name: "list_hotels",
    category: "read",
    summary: "List hotels/suppliers in the catalog.",
    inputSchema: z.object({
      type: z.enum(["hotel", "transport", "meal", "supplier"]).optional(),
      limit: LimitS,
    }),
    handler: async (raw) => {
      const input = z
        .object({
          type: z.enum(["hotel", "transport", "meal", "supplier"]).optional(),
          limit: LimitS,
        })
        .parse(raw);
      const { getHotels } = await import("./db");
      let all = await getHotels();
      if (input.type) all = all.filter((h) => h.type === input.type);
      return ok(`Found ${all.length} supplier${all.length === 1 ? "" : "s"}.`, all.slice(0, input.limit ?? 50));
    },
  },
  {
    name: "get_hotel",
    category: "read",
    summary: "Load a single hotel/supplier by id.",
    inputSchema: HotelRef,
    handler: async (raw) => {
      const { id } = HotelRef.parse(raw);
      const { getHotels } = await import("./db");
      const all = await getHotels();
      const found = all.find((h) => h.id === id);
      if (!found) return fail(`No supplier with id ${id}.`);
      return ok(`Loaded supplier ${found.name}.`, found);
    },
  },
  {
    name: "create_hotel",
    category: "create",
    summary: "Create a new hotel or supplier (type: hotel|transport|meal|supplier).",
    inputSchema: CreateHotel,
    handler: async (raw) => {
      const input = CreateHotel.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(input)) {
        if (v != null) fd.append(k, String(v));
      }
      const { createHotelAction } = await import("@/app/actions/hotels");
      return safe("Create supplier", async () => {
        const r = await createHotelAction(fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "update_hotel",
    category: "update",
    summary: "Edit a hotel/supplier's fields.",
    inputSchema: UpdateHotel,
    handler: async (raw) => {
      const { id, ...rest } = UpdateHotel.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(rest)) {
        if (v != null) fd.append(k, String(v));
      }
      const { updateHotelAction } = await import("@/app/actions/hotels");
      return safe("Update supplier", async () => {
        const r = await updateHotelAction(id, fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_hotel",
    category: "delete",
    summary: "Delete a hotel/supplier.",
    inputSchema: HotelRef,
    handler: async (raw) => {
      const { id } = HotelRef.parse(raw);
      const { deleteHotelAction } = await import("@/app/actions/hotels");
      return safe("Delete supplier", async () => {
        const r = await deleteHotelAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── MEAL PLANS ─────────────────────────────────────────────────────
  {
    name: "create_meal_plan",
    category: "create",
    summary: "Create a meal plan attached to a hotel.",
    inputSchema: CreateMealPlan,
    handler: async (raw) => {
      const input = CreateMealPlan.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(input)) {
        if (v != null) fd.append(k, String(v));
      }
      const { createMealPlanAction } = await import("@/app/actions/meal-plans");
      return safe("Create meal plan", async () => {
        const r = await createMealPlanAction(fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "update_meal_plan",
    category: "update",
    summary: "Edit a meal plan's fields.",
    inputSchema: UpdateMealPlan,
    handler: async (raw) => {
      const { id, ...rest } = UpdateMealPlan.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(rest)) {
        if (v != null) fd.append(k, String(v));
      }
      const { updateMealPlanAction } = await import("@/app/actions/meal-plans");
      return safe("Update meal plan", async () => {
        const r = await updateMealPlanAction(id, fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_meal_plan",
    category: "delete",
    summary: "Delete a meal plan from a hotel.",
    inputSchema: MealPlanRef,
    handler: async (raw) => {
      const input = MealPlanRef.parse(raw);
      const { deleteMealPlanAction } = await import("@/app/actions/meal-plans");
      return safe("Delete meal plan", async () => {
        const r = await deleteMealPlanAction(input.id, input.hotelId);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── ACTIVITIES ─────────────────────────────────────────────────────
  {
    name: "create_activity",
    category: "create",
    summary: "Create a planner activity attached to a destination.",
    inputSchema: CreateActivity,
    handler: async (raw) => {
      const input = CreateActivity.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(input)) {
        if (v != null) fd.append(k, String(v));
      }
      const { createActivityAction } = await import("@/app/actions/planner-activities");
      return safe("Create activity", async () => {
        const r = await createActivityAction(fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "update_activity",
    category: "update",
    summary: "Edit an activity's fields.",
    inputSchema: UpdateActivity,
    handler: async (raw) => {
      const { id, ...rest } = UpdateActivity.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(rest)) {
        if (v != null) fd.append(k, String(v));
      }
      const { updateActivityAction } = await import("@/app/actions/planner-activities");
      return safe("Update activity", async () => {
        const r = await updateActivityAction(id, fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_activity",
    category: "delete",
    summary: "Delete a planner activity.",
    inputSchema: ActivityRef,
    handler: async (raw) => {
      const { id } = ActivityRef.parse(raw);
      const { deleteActivityAction } = await import("@/app/actions/planner-activities");
      return safe("Delete activity", async () => {
        const r = await deleteActivityAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── EMPLOYEES ──────────────────────────────────────────────────────
  {
    name: "create_employee",
    category: "create",
    summary: "Create a new employee/contractor/guide/driver.",
    inputSchema: CreateEmployee,
    handler: async (raw) => {
      const input = CreateEmployee.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(input)) {
        if (v != null) fd.append(k, String(v));
      }
      const { createEmployeeAction } = await import("@/app/actions/employees");
      return safe("Create employee", async () => {
        const r = await createEmployeeAction(fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "update_employee",
    category: "update",
    summary: "Edit an employee's fields.",
    inputSchema: UpdateEmployee,
    handler: async (raw) => {
      const { id, ...rest } = UpdateEmployee.parse(raw);
      const fd = new FormData();
      for (const [k, v] of Object.entries(rest)) {
        if (v != null) fd.append(k, String(v));
      }
      const { updateEmployeeAction } = await import("@/app/actions/employees");
      return safe("Update employee", async () => {
        const r = await updateEmployeeAction(id, fd);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_employee",
    category: "delete",
    summary: "Delete an employee record.",
    inputSchema: EmployeeRef,
    handler: async (raw) => {
      const { id } = EmployeeRef.parse(raw);
      const { deleteEmployeeAction } = await import("@/app/actions/employees");
      return safe("Delete employee", async () => {
        const r = await deleteEmployeeAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── QUOTATIONS ─────────────────────────────────────────────────────
  {
    name: "mark_quotation_sent",
    category: "update",
    summary: "Mark a quotation as sent.",
    inputSchema: QuotationRef,
    handler: async (raw) => {
      const { id } = QuotationRef.parse(raw);
      const { markQuotationSentAction } = await import("@/app/actions/quotations");
      return safe("Mark quotation sent", async () => {
        const r = await markQuotationSentAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "accept_quotation",
    category: "update",
    summary: "Accept a quotation and schedule the tour.",
    inputSchema: AcceptQuotation,
    handler: async (raw) => {
      const input = AcceptQuotation.parse(raw);
      const { acceptQuotationAction } = await import("@/app/actions/quotations");
      return safe("Accept quotation", async () => {
        const r = await acceptQuotationAction(input.id, input.startDate);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "reject_quotation",
    category: "update",
    summary: "Mark a quotation as rejected.",
    inputSchema: QuotationRef,
    handler: async (raw) => {
      const { id } = QuotationRef.parse(raw);
      const { markQuotationRejectedAction } = await import("@/app/actions/quotations");
      return safe("Reject quotation", async () => {
        const r = await markQuotationRejectedAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_quotation",
    category: "delete",
    summary: "Delete a quotation.",
    inputSchema: QuotationRef,
    handler: async (raw) => {
      const { id } = QuotationRef.parse(raw);
      const { deleteQuotationAction } = await import("@/app/actions/quotations");
      return safe("Delete quotation", async () => {
        const r = await deleteQuotationAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── TODOS ──────────────────────────────────────────────────────────
  {
    name: "list_todos",
    category: "read",
    summary: "List all todos.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getTodos } = await import("./db");
      const all = await getTodos();
      return ok(`Found ${all.length} todo${all.length === 1 ? "" : "s"}.`, all.slice(0, limit ?? 50));
    },
  },
  {
    name: "create_todo",
    category: "create",
    summary: "Create a new todo for the team.",
    inputSchema: CreateTodo,
    handler: async (raw) => {
      const input = CreateTodo.parse(raw);
      const { createTodo } = await import("./db");
      return safe("Create todo", async () => {
        return await createTodo({ title: input.title, completed: false });
      });
    },
  },
  {
    name: "toggle_todo",
    category: "update",
    summary: "Toggle a todo's completed state.",
    inputSchema: TodoRef,
    handler: async (raw) => {
      const { id } = TodoRef.parse(raw);
      const { toggleTodoAction } = await import("@/app/actions/todos");
      return safe("Toggle todo", async () => {
        const r = await toggleTodoAction(id);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "delete_todo",
    category: "delete",
    summary: "Delete a todo.",
    inputSchema: TodoRef,
    handler: async (raw) => {
      const { id } = TodoRef.parse(raw);
      const { deleteTodoAction } = await import("@/app/actions/todos");
      return safe("Delete todo", async () => {
        const r = await deleteTodoAction(id);
        if (r && "error" in r && r.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── COMMUNICATIONS ─────────────────────────────────────────────────
  {
    name: "send_invoice_to_guest",
    category: "send",
    summary: "Email the invoice PDF to the guest.",
    inputSchema: SendInvoice,
    handler: async (raw) => {
      const input = SendInvoice.parse(raw);
      const { sendInvoiceToGuestAction } = await import("@/app/actions/invoices");
      return safe("Send invoice", async () => {
        const r = await sendInvoiceToGuestAction(input.invoiceId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_itinerary_to_guest",
    category: "send",
    summary: "Email the tour itinerary PDF to the guest.",
    inputSchema: SendItinerary,
    handler: async (raw) => {
      const input = SendItinerary.parse(raw);
      const { sendItineraryToGuestAction } = await import("@/app/actions/tours");
      return safe("Send itinerary", async () => {
        const r = await sendItineraryToGuestAction(input.tourId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_pre_trip_reminder",
    category: "send",
    summary: "Email the pre-trip reminder to the guest.",
    inputSchema: SendPreTrip,
    handler: async (raw) => {
      const input = SendPreTrip.parse(raw);
      const { sendPreTripReminderAction } = await import("@/app/actions/communications");
      return safe("Send pre-trip reminder", async () => {
        const r = await sendPreTripReminderAction(input.tourId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_post_trip_followup",
    category: "send",
    summary: "Email the post-trip follow-up to the guest.",
    inputSchema: SendPostTrip,
    handler: async (raw) => {
      const input = SendPostTrip.parse(raw);
      const { sendPostTripFollowUpAction } = await import("@/app/actions/communications");
      return safe("Send post-trip follow-up", async () => {
        const r = await sendPostTripFollowUpAction(input.tourId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_booking_change_notice",
    category: "send",
    summary: "Email a revision or cancellation notice to the guest.",
    inputSchema: SendBookingChange,
    handler: async (raw) => {
      const input = SendBookingChange.parse(raw);
      const { sendBookingChangeNoticeAction } = await import("@/app/actions/communications");
      return safe("Send booking change notice", async () => {
        const r = await sendBookingChangeNoticeAction(input.tourId, {
          changeType: input.changeType,
          summary: input.summary,
        });
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_supplier_remittance",
    category: "send",
    summary: "Email a payment remittance advice to a supplier.",
    inputSchema: SendSupplierRemittance,
    handler: async (raw) => {
      const input = SendSupplierRemittance.parse(raw);
      const { sendSupplierRemittanceAction } = await import("@/app/actions/communications");
      return safe("Send supplier remittance", async () => {
        const r = await sendSupplierRemittanceAction(input.paymentId);
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },
  {
    name: "send_supplier_change_notice",
    category: "send",
    summary: "Email a schedule update or cancellation to a supplier.",
    inputSchema: SendSupplierChange,
    handler: async (raw) => {
      const input = SendSupplierChange.parse(raw);
      const { sendSupplierChangeNoticeAction } = await import("@/app/actions/communications");
      return safe("Send supplier change notice", async () => {
        const r = await sendSupplierChangeNoticeAction(input.tourId, {
          supplierId: input.supplierId,
          supplierName: input.supplierName,
          changeType: input.changeType,
          summary: input.summary,
        });
        if (r?.error) throw new Error(r.error);
        return r;
      });
    },
  },

  // ── PAYROLL ────────────────────────────────────────────────────────
  // ── FULL-COVERAGE READS ─────────────────────────────────────────────
  {
    name: "list_employees",
    category: "read",
    summary: "List every employee (with role, employment type, salary).",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getEmployees } = await import("./db");
      const all = await getEmployees();
      return ok(`Found ${all.length} employee${all.length === 1 ? "" : "s"}.`, all.slice(0, limit ?? 50));
    },
  },
  {
    name: "get_employee",
    category: "read",
    summary: "Fetch a single employee by ID.",
    inputSchema: EmployeeRef,
    handler: async (raw) => {
      const { id } = EmployeeRef.parse(raw);
      const { getEmployee } = await import("./db");
      const row = await getEmployee(id);
      return row ? ok(`Employee: ${row.name}.`, row) : fail(`Employee ${id} not found.`);
    },
  },
  {
    name: "list_quotations",
    category: "read",
    summary: "List quotations (drafts, sent, accepted, rejected). Newest first.",
    inputSchema: z.object({
      status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
      limit: LimitS,
    }),
    handler: async (raw) => {
      const input = z
        .object({
          status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
          limit: LimitS,
        })
        .parse(raw);
      const { getQuotations } = await import("./db");
      const all = await getQuotations();
      const rows = input.status ? all.filter((q) => q.status === input.status) : all;
      return ok(`Found ${rows.length} quotation${rows.length === 1 ? "" : "s"}.`, rows.slice(0, input.limit ?? 40));
    },
  },
  {
    name: "get_quotation",
    category: "read",
    summary: "Fetch a single quotation by ID.",
    inputSchema: QuotationRef,
    handler: async (raw) => {
      const { id } = QuotationRef.parse(raw);
      const { getQuotation } = await import("./db");
      const row = await getQuotation(id);
      return row ? ok(`Quotation: ${row.reference ?? row.id}.`, row) : fail(`Quotation ${id} not found.`);
    },
  },
  {
    name: "get_payment",
    category: "read",
    summary: "Fetch a single payment by ID.",
    inputSchema: PaymentRef,
    handler: async (raw) => {
      const { id } = PaymentRef.parse(raw);
      const { getPayment } = await import("./db");
      const row = await getPayment(id);
      return row ? ok(`Payment ${row.id}.`, row) : fail(`Payment ${id} not found.`);
    },
  },
  {
    name: "get_todo",
    category: "read",
    summary: "Fetch a single todo by ID.",
    inputSchema: TodoRef,
    handler: async (raw) => {
      const { id } = TodoRef.parse(raw);
      const { getTodos } = await import("./db");
      const all = await getTodos();
      const row = all.find((t) => t.id === id);
      return row ? ok(`Todo: ${row.title}.`, row) : fail(`Todo ${id} not found.`);
    },
  },
  {
    name: "list_audit_logs",
    category: "read",
    summary: "Raw audit log — every action recorded across the business. Filter by entity type or IDs.",
    inputSchema: z.object({
      entityType: z.enum(["lead", "quotation", "package", "tour", "invoice", "payment", "supplier", "employee", "activity", "meal_plan", "system", "agent"]).optional(),
      entityId: z.string().max(200).optional(),
      limit: LimitS,
    }),
    handler: async (raw) => {
      const input = z
        .object({
          entityType: z.enum(["lead", "quotation", "package", "tour", "invoice", "payment", "supplier", "employee", "activity", "meal_plan", "system", "agent"]).optional(),
          entityId: z.string().max(200).optional(),
          limit: LimitS,
        })
        .parse(raw);
      const { getAuditLogs } = await import("./db");
      const logs = await getAuditLogs({
        entityTypes: input.entityType ? [input.entityType] : undefined,
        entityIds: input.entityId ? [input.entityId] : undefined,
        limit: input.limit ?? 40,
      });
      return ok(`Found ${logs.length} audit log entr${logs.length === 1 ? "y" : "ies"}.`, logs);
    },
  },
  {
    name: "list_ai_interactions",
    category: "read",
    summary: "Recent AI tool calls (request + response + tool name). Useful for 'what did the AI just do' inspections.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getAiInteractions } = await import("./db");
      const rows = await getAiInteractions(limit ?? 30);
      return ok(`Found ${rows.length} AI interaction${rows.length === 1 ? "" : "s"}.`, rows);
    },
  },
  {
    name: "list_ai_knowledge",
    category: "read",
    summary: "Curated AI knowledge documents (distilled responses promoted to reference).",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getAiKnowledgeDocuments } = await import("./db");
      const rows = await getAiKnowledgeDocuments();
      return ok(`Found ${rows.length} knowledge document${rows.length === 1 ? "" : "s"}.`, rows.slice(0, limit ?? 40));
    },
  },
  {
    name: "list_client_bookings",
    category: "read",
    summary: "Every booking tied to a guest email (reopens their client-portal view server-side).",
    inputSchema: z.object({ email: z.string().email().max(320) }),
    handler: async (raw) => {
      const { email } = z.object({ email: z.string().email().max(320) }).parse(raw);
      const { getClientBookings } = await import("./db");
      const data = await getClientBookings(email);
      return ok(`Client ${email}: ${data.requests.length} request${data.requests.length === 1 ? "" : "s"}, ${data.tours.length} tour${data.tours.length === 1 ? "" : "s"}.`, data);
    },
  },
  {
    name: "get_app_settings",
    category: "read",
    summary: "Read the application settings (branding, portal copy, AI config, etc.).",
    inputSchema: z.object({}),
    handler: async () => {
      const { getAppSettings } = await import("./app-config");
      const settings = await getAppSettings();
      return ok("Loaded application settings.", settings);
    },
  },

  // ── FULL-COVERAGE WRITES ────────────────────────────────────────────
  {
    name: "create_quotation",
    category: "create",
    summary: "Create a draft quotation.",
    inputSchema: z.object({
      contactName: z.string().min(1).max(200),
      contactEmail: z.string().email().max(320),
      pax: z.number().int().min(1).max(500),
      destination: z.string().max(200).optional(),
      title: z.string().max(300).optional(),
      notes: z.string().max(4000).optional(),
      currency: z.string().max(10).optional(),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          contactName: z.string().min(1).max(200),
          contactEmail: z.string().email().max(320),
          pax: z.number().int().min(1).max(500),
          destination: z.string().max(200).optional(),
          title: z.string().max(300).optional(),
          notes: z.string().max(4000).optional(),
          currency: z.string().max(10).optional(),
        })
        .parse(raw);
      return safe("create_quotation", async () => {
        const { createQuotation } = await import("./db");
        return await createQuotation({
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          pax: input.pax,
          destination: input.destination,
          title: input.title,
          notes: input.notes,
          itinerary: [],
          lineItems: [],
          subtotal: 0,
          totalAmount: 0,
          currency: input.currency ?? "USD",
          status: "draft",
        } as unknown as Parameters<typeof createQuotation>[0]);
      });
    },
  },
  {
    name: "update_quotation",
    category: "update",
    summary: "Update a quotation's notes, line items, start date, or currency.",
    inputSchema: z.object({
      id: Id,
      startDate: Iso.optional(),
      currency: z.string().max(10).optional(),
      notes: z.string().max(4000).optional(),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          id: Id,
          startDate: Iso.optional(),
          currency: z.string().max(10).optional(),
          notes: z.string().max(4000).optional(),
        })
        .parse(raw);
      return safe("update_quotation", async () => {
        const { updateQuotation } = await import("./db");
        return await updateQuotation(input.id, input);
      });
    },
  },
  {
    name: "create_payment",
    category: "create",
    summary: "Record an incoming or outgoing payment.",
    inputSchema: z.object({
      tourId: Id.optional(),
      invoiceId: Id.optional(),
      supplierId: Id.optional(),
      amount: z.number().nonnegative(),
      currency: z.string().max(10),
      direction: z.enum(["incoming", "outgoing"]),
      status: z.enum(["pending", "received", "paid"]).optional(),
      paidAt: Iso.optional(),
      notes: z.string().max(2000).optional(),
    }),
    handler: async (raw) => {
      return safe("create_payment", async () => {
        const { createPayment } = await import("./db");
        return await createPayment(raw as Parameters<typeof createPayment>[0]);
      });
    },
  },
  {
    name: "update_payment",
    category: "update",
    summary: "Update a payment (amount, status, paidAt, notes).",
    inputSchema: z.object({
      id: Id,
      amount: z.number().nonnegative().optional(),
      status: z.enum(["pending", "completed", "cancelled"]).optional(),
      paidAt: Iso.optional(),
      notes: z.string().max(2000).optional(),
    }),
    handler: async (raw) => {
      const { id, ...rest } = z
        .object({
          id: Id,
          amount: z.number().nonnegative().optional(),
          status: z.enum(["pending", "completed", "cancelled"]).optional(),
          paidAt: Iso.optional(),
          notes: z.string().max(2000).optional(),
        })
        .parse(raw);
      return safe("update_payment", async () => {
        const { updatePayment } = await import("./db");
        return await updatePayment(id, rest);
      });
    },
  },
  {
    name: "delete_payment",
    category: "delete",
    summary: "Delete a payment record. Irreversible.",
    inputSchema: PaymentRef,
    handler: async (raw) => {
      const { id } = PaymentRef.parse(raw);
      return safe("delete_payment", async () => {
        const { deletePayment } = await import("./db");
        return await deletePayment(id);
      });
    },
  },
  {
    name: "update_invoice",
    category: "update",
    summary: "Update invoice fields (amount, dueDate, notes, lineItems).",
    inputSchema: z.object({
      id: Id,
      amount: z.number().nonnegative().optional(),
      currency: z.string().max(10).optional(),
      dueDate: Iso.optional(),
      notes: z.string().max(2000).optional(),
    }),
    handler: async (raw) => {
      const { id, ...rest } = z
        .object({
          id: Id,
          amount: z.number().nonnegative().optional(),
          currency: z.string().max(10).optional(),
          dueDate: Iso.optional(),
          notes: z.string().max(2000).optional(),
        })
        .parse(raw);
      return safe("update_invoice", async () => {
        const { updateInvoice } = await import("./db");
        return await updateInvoice(id, rest);
      });
    },
  },
  {
    name: "delete_invoice",
    category: "delete",
    summary: "Delete an invoice. Irreversible.",
    inputSchema: InvoiceRef,
    handler: async (raw) => {
      const { id } = InvoiceRef.parse(raw);
      return safe("delete_invoice", async () => {
        const { deleteInvoice } = await import("./db");
        return await deleteInvoice(id);
      });
    },
  },
  {
    name: "update_tour",
    category: "update",
    summary: "Update tour fields (startDate, endDate, pax, notes, itinerary, etc.). For status-only changes use update_tour_status.",
    inputSchema: z.object({
      id: Id,
      startDate: Iso.optional(),
      endDate: Iso.optional(),
      pax: z.number().int().min(1).max(500).optional(),
      notes: z.string().max(4000).optional(),
    }),
    handler: async (raw) => {
      const { id, ...rest } = z
        .object({
          id: Id,
          startDate: Iso.optional(),
          endDate: Iso.optional(),
          pax: z.number().int().min(1).max(500).optional(),
          notes: z.string().max(4000).optional(),
        })
        .parse(raw);
      return safe("update_tour", async () => {
        const { updateTour } = await import("./db");
        return await updateTour(id, rest);
      });
    },
  },
  {
    name: "update_todo",
    category: "update",
    summary: "Update a todo's title (not its checked state — use toggle_todo for that).",
    inputSchema: z.object({ id: Id, title: z.string().min(1).max(500) }),
    handler: async (raw) => {
      const input = z.object({ id: Id, title: z.string().min(1).max(500) }).parse(raw);
      return safe("update_todo", async () => {
        const { updateTodo } = await import("./db");
        return await updateTodo(input.id, { title: input.title });
      });
    },
  },
  {
    name: "create_planner_activity",
    category: "create",
    summary: "Create a planner activity for custom-journey day builder.",
    inputSchema: z.object({
      destinationId: Id,
      title: z.string().min(1).max(300),
      summary: z.string().max(2000).optional(),
      durationLabel: z.string().max(100).optional(),
      energy: z.enum(["easy", "moderate", "active"]).optional(),
      estimatedPrice: z.number().nonnegative().optional(),
    }),
    handler: async (raw) => {
      return safe("create_planner_activity", async () => {
        const { createPlannerActivity } = await import("./db");
        return await createPlannerActivity(raw as Parameters<typeof createPlannerActivity>[0]);
      });
    },
  },
  {
    name: "update_planner_activity",
    category: "update",
    summary: "Update a planner activity's title, summary, energy level, or price.",
    inputSchema: z.object({
      id: Id,
      title: z.string().min(1).max(300).optional(),
      summary: z.string().max(2000).optional(),
      durationLabel: z.string().max(100).optional(),
      energy: z.enum(["easy", "moderate", "active"]).optional(),
      estimatedPrice: z.number().nonnegative().optional(),
    }),
    handler: async (raw) => {
      const { id, ...rest } = z
        .object({
          id: Id,
          title: z.string().min(1).max(300).optional(),
          summary: z.string().max(2000).optional(),
          durationLabel: z.string().max(100).optional(),
          energy: z.enum(["easy", "moderate", "active"]).optional(),
          estimatedPrice: z.number().nonnegative().optional(),
        })
        .parse(raw);
      return safe("update_planner_activity", async () => {
        const { updatePlannerActivity } = await import("./db");
        return await updatePlannerActivity(id, rest);
      });
    },
  },
  {
    name: "delete_planner_activity",
    category: "delete",
    summary: "Delete a planner activity. Irreversible.",
    inputSchema: z.object({ id: Id }),
    handler: async (raw) => {
      const { id } = z.object({ id: Id }).parse(raw);
      return safe("delete_planner_activity", async () => {
        const { deletePlannerActivity } = await import("./db");
        return await deletePlannerActivity(id);
      });
    },
  },
  {
    name: "create_ai_knowledge",
    category: "create",
    summary: "Save a curated AI answer into the knowledge base for future reuse.",
    inputSchema: z.object({
      title: z.string().min(1).max(300),
      content: z.string().min(1).max(20000),
      tags: z.array(z.string().max(60)).optional(),
    }),
    handler: async (raw) => {
      return safe("create_ai_knowledge", async () => {
        const { createAiKnowledgeDocument } = await import("./db");
        return await createAiKnowledgeDocument(raw as Parameters<typeof createAiKnowledgeDocument>[0]);
      });
    },
  },
  {
    name: "update_ai_knowledge",
    category: "update",
    summary: "Edit an AI knowledge document's title, content, or tags.",
    inputSchema: z.object({
      id: Id,
      title: z.string().min(1).max(300).optional(),
      content: z.string().min(1).max(20000).optional(),
      tags: z.array(z.string().max(60)).optional(),
    }),
    handler: async (raw) => {
      const { id, ...rest } = z
        .object({
          id: Id,
          title: z.string().min(1).max(300).optional(),
          content: z.string().min(1).max(20000).optional(),
          tags: z.array(z.string().max(60)).optional(),
        })
        .parse(raw);
      return safe("update_ai_knowledge", async () => {
        const { updateAiKnowledgeDocument } = await import("./db");
        return await updateAiKnowledgeDocument(id, rest);
      });
    },
  },
  {
    name: "create_payroll_run",
    category: "create",
    summary: "Create a new payroll run (period + employees).",
    inputSchema: z.object({
      periodStart: Iso,
      periodEnd: Iso,
      notes: z.string().max(2000).optional(),
    }),
    handler: async (raw) => {
      return safe("create_payroll_run", async () => {
        const { createPayrollRun } = await import("./db");
        return await createPayrollRun(raw as Parameters<typeof createPayrollRun>[0]);
      });
    },
  },
  {
    name: "update_payroll_run",
    category: "update",
    summary: "Update a payroll run's notes, status, or line items.",
    inputSchema: z.object({
      id: Id,
      notes: z.string().max(2000).optional(),
      status: z.enum(["draft", "approved", "paid"]).optional(),
    }),
    handler: async (raw) => {
      const { id, ...rest } = z
        .object({
          id: Id,
          notes: z.string().max(2000).optional(),
          status: z.enum(["draft", "approved", "paid"]).optional(),
        })
        .parse(raw);
      return safe("update_payroll_run", async () => {
        const { updatePayrollRun } = await import("./db");
        return await updatePayrollRun(id, rest);
      });
    },
  },

  // ── COMMUNICATIONS HISTORY ─────────────────────────────────────────
  {
    name: "list_communications",
    category: "read",
    summary:
      "List emails that went out (to guests OR suppliers), derived from the audit log. Filter by recipient email, leadId, tourId, template, status (sent/failed), or limit. Returns most-recent first. Use this for 'what was the last email we sent to…' questions.",
    inputSchema: z.object({
      recipient: z.string().max(320).optional(),
      leadId: z.string().max(200).optional(),
      tourId: z.string().max(200).optional(),
      template: z
        .enum([
          "tour_confirmation_with_invoice",
          "supplier_reservation",
          "payment_receipt",
          "invoice",
          "itinerary",
          "pre_trip_reminder",
          "post_trip_followup",
          "booking_change_notice",
          "supplier_change_notice",
          "supplier_remittance",
        ])
        .optional(),
      status: z.enum(["sent", "failed", "skipped", "all"]).optional(),
      limit: LimitS,
    }),
    handler: async (raw) => {
      const input = z
        .object({
          recipient: z.string().max(320).optional(),
          leadId: z.string().max(200).optional(),
          tourId: z.string().max(200).optional(),
          template: z.string().max(60).optional(),
          status: z.enum(["sent", "failed", "skipped", "all"]).optional(),
          limit: LimitS,
        })
        .parse(raw);
      const { getAuditLogs } = await import("./db");
      const logs = await getAuditLogs({ limit: 500 });
      const EMAIL_SUFFIXES = ["_emailed", "_email_failed", "_email_skipped"];
      const recipientNeedle = (input.recipient ?? "").trim().toLowerCase();
      const rows = logs
        .filter((log) => EMAIL_SUFFIXES.some((s) => log.action.endsWith(s)))
        .map((log) => {
          const meta = (log.metadata ?? {}) as Record<string, unknown>;
          const recipient =
            typeof meta.recipient === "string" ? meta.recipient : "";
          const template =
            typeof meta.template === "string" ? meta.template : "other";
          const status: "sent" | "failed" | "skipped" = log.action.endsWith(
            "_failed"
          )
            ? "failed"
            : log.action.endsWith("_skipped")
              ? "skipped"
              : "sent";
          return {
            id: log.id,
            sentAt: log.createdAt,
            action: log.action,
            template,
            status,
            recipient,
            summary: log.summary,
            entityType: log.entityType,
            entityId: log.entityId,
            error: typeof meta.error === "string" ? meta.error : undefined,
          };
        })
        .filter((r) => {
          if (input.leadId && !(r.entityType === "lead" && r.entityId === input.leadId))
            return false;
          if (input.tourId && !(r.entityType === "tour" && r.entityId === input.tourId))
            return false;
          if (input.template && r.template !== input.template) return false;
          if (input.status && input.status !== "all" && r.status !== input.status)
            return false;
          if (recipientNeedle && !r.recipient.toLowerCase().includes(recipientNeedle))
            return false;
          return true;
        })
        .slice(0, input.limit ?? 20);

      if (rows.length === 0) {
        return ok(
          `No matching emails found${input.recipient ? ` for recipient "${input.recipient}"` : ""}.`,
          []
        );
      }
      const latest = rows[0];
      return ok(
        `${rows.length} email${rows.length === 1 ? "" : "s"} — most recent: ${latest.status} "${latest.template}" → ${latest.recipient || "(no recipient)"} at ${latest.sentAt}.`,
        rows
      );
    },
  },

  // ── FLOW-AWARE CATALOG READS ───────────────────────────────────────
  {
    name: "list_destinations",
    category: "read",
    summary:
      "List unique destinations/regions across all packages (with the count of packages per destination). Use during custom-tour and package creation to suggest where to go.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getPackages } = await import("./db");
      const packages = await getPackages();
      const counts = new Map<string, { region?: string; count: number }>();
      for (const p of packages) {
        const key = (p.destination ?? "").trim();
        if (!key) continue;
        const existing = counts.get(key) ?? {
          region: p.region ?? undefined,
          count: 0,
        };
        counts.set(key, {
          region: existing.region ?? p.region ?? undefined,
          count: existing.count + 1,
        });
      }
      const rows = Array.from(counts.entries())
        .map(([destination, v]) => ({
          destination,
          region: v.region,
          packageCount: v.count,
        }))
        .sort((a, b) => b.packageCount - a.packageCount)
        .slice(0, limit ?? 40);
      return ok(
        `Found ${rows.length} distinct destination${rows.length === 1 ? "" : "s"}.`,
        rows
      );
    },
  },
  {
    name: "list_activities",
    category: "read",
    summary:
      "List planner activities, optionally filtered to a specific destination. Use when building a custom day-by-day plan.",
    inputSchema: z.object({
      destination: z.string().max(200).optional(),
      limit: LimitS,
    }),
    handler: async (raw) => {
      const input = z
        .object({ destination: z.string().max(200).optional(), limit: LimitS })
        .parse(raw);
      const {
        getPlannerActivityRecords,
        getPlannerActivityRecordsByDestination,
      } = await import("./db");
      const all = input.destination
        ? await getPlannerActivityRecordsByDestination(input.destination)
        : await getPlannerActivityRecords();
      const rows = all.slice(0, input.limit ?? 40);
      return ok(
        `Found ${all.length} activit${all.length === 1 ? "y" : "ies"}${input.destination ? ` in ${input.destination}` : ""}.`,
        rows
      );
    },
  },
  {
    name: "list_meal_plans",
    category: "read",
    summary:
      "List all meal plans across hotels. Use when building a package or booking and the admin asks about BB/HB/FB/AI options.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getAllMealPlans } = await import("./db");
      const all = await getAllMealPlans();
      return ok(
        `Found ${all.length} meal plan${all.length === 1 ? "" : "s"}.`,
        all.slice(0, limit ?? 60)
      );
    },
  },
  {
    name: "suggest_package_pricing",
    category: "read",
    summary:
      "Suggest a from-price band (p25 / median / p75) for a new package by analyzing existing packages that match the destination + duration window. Use BEFORE create_package so the admin has a grounded price anchor.",
    inputSchema: z.object({
      destination: z.string().min(1).max(200),
      durationNights: z.number().int().min(1).max(60).optional(),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          destination: z.string().min(1).max(200),
          durationNights: z.number().int().min(1).max(60).optional(),
        })
        .parse(raw);
      const { getPackages } = await import("./db");
      const { getFromPrice } = await import("./package-price");
      const all = await getPackages();
      const needle = input.destination.toLowerCase();
      const matches = all.filter((p) => {
        const dest = (p.destination ?? "").toLowerCase();
        const region = (p.region ?? "").toLowerCase();
        if (!dest.includes(needle) && !region.includes(needle)) return false;
        if (input.durationNights != null) {
          const m = (p.duration ?? "").match(/(\d+)\s*[Nn]ight/);
          const nights = m ? parseInt(m[1], 10) : 0;
          if (Math.abs(nights - input.durationNights) > 2) return false;
        }
        return true;
      });
      if (matches.length === 0) {
        return ok(
          `No comparable packages found for "${input.destination}"${input.durationNights ? ` at ~${input.durationNights} nights` : ""}. Price the package from scratch.`,
          { matches: [], p25: null, median: null, p75: null, sample: 0 }
        );
      }
      const prices = matches
        .map((p) => ({ id: p.id, name: p.name, price: getFromPrice(p), currency: p.currency }))
        .filter((r) => Number.isFinite(r.price) && r.price > 0)
        .sort((a, b) => a.price - b.price);
      const pick = (q: number) => {
        if (prices.length === 0) return null;
        const idx = Math.min(
          prices.length - 1,
          Math.max(0, Math.floor(prices.length * q))
        );
        return prices[idx].price;
      };
      const summary = `Comparable packages: ${prices.length}. Price band (${prices[0]?.currency ?? ""}): p25 ${pick(0.25)} · median ${pick(0.5)} · p75 ${pick(0.75)}.`;
      return ok(summary, {
        sample: prices.length,
        p25: pick(0.25),
        median: pick(0.5),
        p75: pick(0.75),
        matches: prices.slice(0, 10),
      });
    },
  },

  // ── SELF-EXTENSION (meta-capability) ─────────────────────────────────
  // The agent can capture new procedures and context mid-conversation so
  // the next session inherits what we learned. This is how it "creates
  // tools and context" without code changes — it writes durable knowledge
  // documents that surface in the system prompt's live-data block.
  {
    name: "register_procedure",
    category: "create",
    summary:
      "Capture a new how-to or playbook the agent can follow next time. Use when the admin teaches you a workflow we don't have a tool for. The procedure is saved to AI knowledge (active) and reappears in future contexts.",
    inputSchema: z.object({
      title: z.string().min(3).max(200),
      content: z.string().min(10).max(8000),
      tags: z.array(z.string().max(60)).max(8).optional(),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          title: z.string().min(3).max(200),
          content: z.string().min(10).max(8000),
          tags: z.array(z.string().max(60)).max(8).optional(),
        })
        .parse(raw);
      return safe("register_procedure", async () => {
        const { createAiKnowledgeDocument } = await import("./db");
        return await createAiKnowledgeDocument({
          title: input.title,
          content: input.content,
          sourceType: "learned",
          tags: input.tags ?? ["procedure"],
          active: true,
        } as unknown as Parameters<typeof createAiKnowledgeDocument>[0]);
      });
    },
  },
  {
    name: "remember_context",
    category: "create",
    summary:
      "Pin an important fact, preference, or mid-conversation observation so it persists for future sessions (saved as an AI knowledge note tagged 'context'). Use for things like 'admin prefers USD over EUR', 'guest X always books two rooms', 'supplier Y invoices in arrears'.",
    inputSchema: z.object({
      fact: z.string().min(5).max(2000),
      tags: z.array(z.string().max(60)).max(8).optional(),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          fact: z.string().min(5).max(2000),
          tags: z.array(z.string().max(60)).max(8).optional(),
        })
        .parse(raw);
      return safe("remember_context", async () => {
        const { createAiKnowledgeDocument } = await import("./db");
        return await createAiKnowledgeDocument({
          title: input.fact.slice(0, 80),
          content: input.fact,
          sourceType: "learned",
          tags: input.tags ?? ["context"],
          active: true,
        } as unknown as Parameters<typeof createAiKnowledgeDocument>[0]);
      });
    },
  },

  // ── UNIVERSAL FALLBACK ──────────────────────────────────────────────
  // When no specific tool fits, this dispatcher fuzzy-matches a free-form
  // target string ("last payment", "tours this week", "employee salaries")
  // to any known read surface and applies simple filters. The agent uses
  // this instead of refusing when a user asks something we haven't wired.
  {
    name: "inspect_any",
    category: "read",
    summary:
      "Universal read fallback. Give it a target noun (e.g. 'leads', 'tours', 'payments', 'invoices', 'employees', 'hotels', 'packages', 'quotations', 'todos', 'communications', 'audit', 'ai_interactions', 'ai_knowledge', 'settings', 'destinations', 'activities', 'meal_plans', 'payroll', 'bookings') plus optional free-form filters (email, status, text, sinceDays, limit) and it returns the raw rows. Use this whenever no specific tool covers the question.",
    inputSchema: z.object({
      target: z.string().min(1).max(80),
      email: z.string().max(320).optional(),
      status: z.string().max(60).optional(),
      text: z.string().max(200).optional(),
      sinceDays: z.number().int().min(1).max(3650).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          target: z.string().min(1).max(80),
          email: z.string().max(320).optional(),
          status: z.string().max(60).optional(),
          text: z.string().max(200).optional(),
          sinceDays: z.number().int().min(1).max(3650).optional(),
          limit: z.number().int().min(1).max(500).optional(),
        })
        .parse(raw);
      const t = input.target.toLowerCase().trim();
      const limit = input.limit ?? 50;
      const sinceMs = input.sinceDays ? Date.now() - input.sinceDays * 86400_000 : 0;
      const db = await import("./db");

      // Map fuzzy target → loader
      type Loader = () => Promise<unknown[]>;
      const table: Array<[RegExp, Loader]> = [
        [/lead|request|inquir/, async () => db.getLeads()],
        [/tour|trip|booking/, async () => db.getTours()],
        [/invoice|bill/, async () => db.getInvoices()],
        [/payment|receipt|receive|payable/, async () => db.getPayments()],
        [/employee|staff|team/, async () => db.getEmployees()],
        [/hotel|supplier/, async () => db.getHotels()],
        [/package|tour\s*package|itiner/, async () => db.getPackages()],
        [/quotation|quote/, async () => db.getQuotations()],
        [/todo|task/, async () => db.getTodos()],
        [/communication|email|sent|message/, async () => db.getAuditLogs({ limit: 500 })],
        [/audit|log|history/, async () => db.getAuditLogs({ limit: 500 })],
        [/ai.*interaction|prompt/, async () => db.getAiInteractions(500)],
        [/ai.*knowledge|kb|doc/, async () => db.getAiKnowledgeDocuments()],
        [/activity|excursion/, async () => db.getPlannerActivityRecords()],
        [/meal|food|board/, async () => db.getAllMealPlans()],
        [/payroll|salary|wage/, async () => db.getPayrollRuns()],
        [/destination/, async () => {
          const pkgs = await db.getPackages();
          const byDest = new Map<string, number>();
          for (const p of pkgs) {
            const d = p.destination ?? "unknown";
            byDest.set(d, (byDest.get(d) ?? 0) + 1);
          }
          return [...byDest.entries()].map(([destination, count]) => ({ destination, count }));
        }],
        [/setting|config|branding/, async () => {
          const { getAppSettings } = await import("./app-config");
          return [await getAppSettings()];
        }],
      ];

      const hit = table.find(([re]) => re.test(t));
      if (!hit) {
        return fail(
          `Unknown target "${input.target}". Try one of: leads, tours, invoices, payments, employees, hotels, packages, quotations, todos, communications, audit, ai_interactions, ai_knowledge, activities, meal_plans, payroll, destinations, settings.`
        );
      }

      let rows: unknown[] = [];
      try {
        rows = await hit[1]();
      } catch (e) {
        return fail(`inspect_any load failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Filter generically — operate on any row with matching fields
      const emailNeedle = input.email?.toLowerCase();
      const statusNeedle = input.status?.toLowerCase();
      const textNeedle = input.text?.toLowerCase();

      const filtered = rows.filter((r) => {
        if (typeof r !== "object" || r === null) return true;
        const row = r as Record<string, unknown>;
        if (emailNeedle) {
          const hay = JSON.stringify(row).toLowerCase();
          if (!hay.includes(emailNeedle)) return false;
        }
        if (statusNeedle) {
          const s = (row.status ?? row.state ?? "").toString().toLowerCase();
          if (!s.includes(statusNeedle)) return false;
        }
        if (textNeedle) {
          const hay = JSON.stringify(row).toLowerCase();
          if (!hay.includes(textNeedle)) return false;
        }
        if (sinceMs > 0) {
          const ts = row.createdAt ?? row.at ?? row.sentAt ?? row.updatedAt;
          if (typeof ts === "string") {
            const d = Date.parse(ts);
            if (!Number.isNaN(d) && d < sinceMs) return false;
          } else if (typeof ts === "number" && ts < sinceMs) {
            return false;
          }
        }
        return true;
      });

      // Sort newest-first when a timestamp exists
      filtered.sort((a, b) => {
        const ta = (a as Record<string, unknown>)?.createdAt ?? (a as Record<string, unknown>)?.at ?? "";
        const tb = (b as Record<string, unknown>)?.createdAt ?? (b as Record<string, unknown>)?.at ?? "";
        return Date.parse(String(tb)) - Date.parse(String(ta));
      });

      const sliced = filtered.slice(0, limit);
      return ok(
        `inspect_any[${input.target}] → ${sliced.length} of ${filtered.length} row${filtered.length === 1 ? "" : "s"} (total ${rows.length}).`,
        { target: input.target, rows: sliced, totalMatched: filtered.length, totalScanned: rows.length }
      );
    },
  },

  // Draft-only composer for messages the system has no dedicated sender for.
  // Returns the drafted body — the admin sends it through their normal channel.
  {
    name: "draft_message",
    category: "read",
    summary:
      "Draft a message (email/slack/sms) body for admin review when no dedicated sender exists. Returns the text; does NOT send. Use for novel communications (supplier disputes, ad-hoc guest notes, internal memos).",
    inputSchema: z.object({
      audience: z.string().max(120),
      purpose: z.string().max(500),
      tone: z.enum(["formal", "friendly", "urgent", "apologetic", "neutral"]).optional(),
      keyPoints: z.array(z.string().max(500)).max(10).optional(),
      language: z.string().max(20).optional(),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          audience: z.string().max(120),
          purpose: z.string().max(500),
          tone: z.enum(["formal", "friendly", "urgent", "apologetic", "neutral"]).optional(),
          keyPoints: z.array(z.string().max(500)).max(10).optional(),
          language: z.string().max(20).optional(),
        })
        .parse(raw);
      // The agent composes the body in its next turn from this structured
      // brief — we just echo the structured request so it shows up in the
      // tool-result stream and the agent can ground its draft.
      return ok(
        `Drafting brief prepared for ${input.audience}. Agent will compose the body in the next assistant message.`,
        input
      );
    },
  },

  {
    name: "list_payroll_runs",
    category: "read",
    summary: "List recent payroll runs.",
    inputSchema: z.object({ limit: LimitS }),
    handler: async (raw) => {
      const { limit } = z.object({ limit: LimitS }).parse(raw);
      const { getPayrollRuns } = await import("./db");
      const all = await getPayrollRuns();
      return ok(`Found ${all.length} payroll run${all.length === 1 ? "" : "s"}.`, all.slice(0, limit ?? 50));
    },
  },

  // ── Sub-agent dispatch (Cowork Phase C.1) ─────────────────────────────
  //
  // Spawns a focused sub-agent for a scoped research/analysis task.
  // Category is `read` because from the parent admin's perspective the
  // dispatch itself is non-destructive — every mutating action a sub-
  // agent might take is governed by the sub-agent's own filtered tool
  // catalog, which excludes deletes. So no HITL gate fires on dispatch.
  //
  // Concurrency: when the model emits multiple dispatch_subagent calls
  // in one turn, the parent runLoop fires them in parallel via
  // Promise.all (same fan-out path as any safe-tool batch). 3 dispatches
  // = 3 concurrent sub-agent runs, not sequential.
  {
    name: "dispatch_subagent",
    category: "read",
    summary:
      "Spawn a focused sub-agent for a scoped research/analysis task. Sub-agents have a fresh context, can call read/create/update/send tools, and return a single text summary. Use for parallel research (call this multiple times in one turn — they run concurrently), deep dives, or specialized analysis that would crowd your main context. Sub-agents cannot delete or spawn nested sub-agents.",
    inputSchema: z.object({
      task: z
        .string()
        .min(1)
        .max(2000)
        .describe(
          "Specific scoped task. Be precise about what to find or do. Example: 'List all bookings for destination Bali in Q3 2026 and summarize the top 3 most-booked packages.'"
        ),
      context: z
        .string()
        .max(2000)
        .optional()
        .describe(
          "Optional 1-3 line briefing if the sub-agent needs context the task statement doesn't carry (e.g. relevant entity IDs, prior decisions)."
        ),
    }),
    handler: async (raw) => {
      const input = z
        .object({
          task: z.string().min(1).max(2000),
          context: z.string().max(2000).optional(),
        })
        .parse(raw);
      const { runSubagent } = await import("./agent-runtime");
      const result = await runSubagent(input);
      if (!result.ok) {
        return fail(result.summary);
      }
      return ok(result.summary, result.data);
    },
  },
];

// ── Lookup helpers ──────────────────────────────────────────────────────

const TOOLS_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDescriptor | null {
  return TOOLS_BY_NAME.get(name) ?? null;
}

/** LLM-facing catalog. Groups by category so the model understands which
 *  tools will execute immediately vs need admin approval. */
export function listToolsForPrompt(): string {
  const byCat: Record<ToolCategory, ToolDescriptor[]> = {
    read: [],
    create: [],
    update: [],
    delete: [],
    send: [],
  };
  for (const t of AGENT_TOOLS) byCat[t.category].push(t);

  const parts: string[] = [];
  const header = (cat: ToolCategory) => {
    if (cat === "read") return "READ TOOLS (auto-execute, no approval needed):";
    if (cat === "create") return "CREATE TOOLS (auto-execute, no approval needed):";
    if (cat === "send") return "SEND TOOLS (auto-execute — emails go out immediately):";
    if (cat === "update") return "UPDATE TOOLS (auto-execute — status changes, edits, marks):";
    return "DELETE TOOLS (REQUIRE admin approval — proposal card):";
  };
  for (const cat of ["read", "create", "send", "update", "delete"] as ToolCategory[]) {
    const tools = byCat[cat];
    if (tools.length === 0) continue;
    parts.push(header(cat));
    for (const t of tools) {
      parts.push(`  - ${t.name}: ${t.summary}\n    input: ${describeSchema(t.inputSchema)}`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

/** Zod-version-safe object schema description for the prompt. */
function describeSchema(schema: z.ZodTypeAny): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shape: Record<string, z.ZodTypeAny> | undefined;
  if (typeof def.shape === "function") {
    shape = def.shape();
  } else if (def.shape && typeof def.shape === "object") {
    shape = def.shape as Record<string, z.ZodTypeAny>;
  }
  if (!shape) return "object";
  const parts: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fdef = (field as any)._def ?? {};
    const type =
      (typeof fdef.typeName === "string" && fdef.typeName) ||
      (typeof fdef.type === "string" && fdef.type) ||
      "unknown";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const optional = (field as any).isOptional?.() ? "?" : "";
    parts.push(`${key}${optional}: ${String(type).replace(/^Zod/, "")}`);
  }
  return `{ ${parts.join(", ")} }`;
}

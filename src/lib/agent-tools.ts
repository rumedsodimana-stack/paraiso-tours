/**
 * Agent tool registry — full app control via chat.
 *
 * Every admin capability is exposed as a typed tool the agent can propose.
 *
 * Approval policy (matches the user's contract: "ask permission only for
 * edits and deletes"):
 *
 *   category   | auto-execute? | user confirmation required?
 *   -----------+---------------+----------------------------
 *   read       | YES           | no
 *   create     | YES           | no
 *   send       | YES           | no (guest/supplier email — irreversible-ish)
 *   update     | NO            | YES — HITL approval card
 *   delete     | NO            | YES — HITL approval card
 *
 * The dispatcher (`executeProposalAction`) enforces this at the server
 * level, so even if a client tried to auto-approve a delete, the handler
 * would still require the proposal to carry an approved flag.
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
  return category === "update" || category === "delete";
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
  status: z.enum(["new", "hold", "cancelled", "won"]).optional(),
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
  status: z.enum(["new", "hold", "cancelled", "won"]),
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
    summary: "Approve or cancel a booking (status: new|hold|won|cancelled).",
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
    if (cat === "update") return "UPDATE TOOLS (REQUIRE admin approval — proposal card):";
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

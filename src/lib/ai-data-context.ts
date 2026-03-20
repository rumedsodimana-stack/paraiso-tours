import {
  getEmployees,
  getHotels,
  getInvoices,
  getLeads,
  getPackages,
  getPayments,
  getTodos,
  getTours,
} from "./db";
import type {
  Employee,
  HotelSupplier,
  Invoice,
  Lead,
  Payment,
  Todo,
  Tour,
  TourPackage,
} from "./types";

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchQuery(
  query: string,
  ...values: Array<string | number | null | undefined>
) {
  const lower = normalizeText(query);
  if (!lower) return false;
  const words = lower.split(/\s+/).filter(Boolean);
  const haystack = values.map(normalizeText).join(" ");
  if (!haystack) return false;
  return words.every((word) => haystack.includes(word));
}

function takeMatches<T>(
  query: string,
  items: T[],
  matcher: (item: T) => boolean,
  limit = 5
) {
  return items.filter(matcher).slice(0, limit);
}

function formatMoney(amount: number, currency = "USD") {
  return `${Math.round((amount + Number.EPSILON) * 100) / 100} ${currency}`;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function formatCountMap(map: Record<string, number>) {
  return Object.entries(map)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function formatLead(lead: Lead) {
  return `${lead.reference ?? lead.id} | ${lead.name} | ${lead.status} | ${
    lead.travelDate || "no travel date"
  } | pax ${lead.pax ?? "?"} | ${lead.destination || "no destination"} | ${
    lead.email
  }`;
}

function formatPackage(pkg: TourPackage) {
  return `${pkg.name} | ${pkg.destination} | ${pkg.duration} | ${formatMoney(
    pkg.price,
    pkg.currency
  )} | ${pkg.published === false ? "unpublished" : "published"}`;
}

function formatTour(tour: Tour) {
  return `${tour.id} | ${tour.clientName} | ${tour.packageName} | ${
    tour.status
  } | ${tour.startDate} to ${tour.endDate} | ${formatMoney(
    tour.totalValue,
    tour.currency
  )}`;
}

function formatInvoice(invoice: Invoice) {
  return `${invoice.invoiceNumber} | ${invoice.clientName} | ${
    invoice.status
  } | ${formatMoney(invoice.totalAmount, invoice.currency)} | ${
    invoice.travelDate || "no travel date"
  }`;
}

function formatPayment(payment: Payment) {
  return `${payment.reference ?? payment.id} | ${payment.type} | ${
    payment.status
  } | ${formatMoney(payment.amount, payment.currency)} | ${
    payment.clientName || payment.supplierName || payment.description
  } | ${payment.date}`;
}

function formatHotel(hotel: HotelSupplier) {
  return `${hotel.name} | ${hotel.type} | ${hotel.location || "no location"} | ${
    hotel.currency
  } ${
    hotel.defaultPricePerNight ?? 0
  } | ${hotel.email || "no email"}`;
}

function formatTodo(todo: Todo) {
  return `${todo.completed ? "done" : "open"} | ${todo.title}`;
}

function formatEmployee(employee: Employee) {
  return `${employee.name} | ${employee.role} | ${employee.department || "no department"} | ${
    employee.status
  } | ${employee.email}`;
}

export async function buildAppDataContext(input: {
  query?: string;
  maxItemsPerType?: number;
}) {
  const query = input.query?.trim() ?? "";
  const limit = input.maxItemsPerType ?? 5;
  const [
    leads,
    packages,
    tours,
    invoices,
    payments,
    hotels,
    todos,
    employees,
  ] = await Promise.all([
    getLeads(),
    getPackages(),
    getTours(),
    getInvoices(),
    getPayments(),
    getHotels(),
    getTodos(),
    getEmployees(),
  ]);

  const activeTours = tours.filter((tour) => tour.status !== "cancelled");
  const receivables = invoices
    .filter((invoice) =>
      invoice.status === "pending_payment" || invoice.status === "overdue"
    )
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const completedIncoming = payments
    .filter((payment) => payment.type === "incoming" && payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const completedOutgoing = payments
    .filter((payment) => payment.type === "outgoing" && payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const tourRevenue = activeTours.reduce((sum, tour) => sum + tour.totalValue, 0);

  const matchedLeads = query
    ? takeMatches(
        query,
        leads,
        (lead) =>
          matchQuery(
            query,
            lead.id,
            lead.reference,
            lead.name,
            lead.email,
            lead.phone,
            lead.destination,
            lead.notes,
            lead.status
          ),
        limit
      )
    : [];
  const matchedPackages = query
    ? takeMatches(
        query,
        packages,
        (pkg) =>
          matchQuery(
            query,
            pkg.id,
            pkg.name,
            pkg.destination,
            pkg.region,
            pkg.description
          ),
        limit
      )
    : [];
  const matchedTours = query
    ? takeMatches(
        query,
        tours,
        (tour) =>
          matchQuery(
            query,
            tour.id,
            tour.clientName,
            tour.packageName,
            tour.status,
            tour.startDate,
            tour.endDate
          ),
        limit
      )
    : [];
  const matchedInvoices = query
    ? takeMatches(
        query,
        invoices,
        (invoice) =>
          matchQuery(
            query,
            invoice.id,
            invoice.invoiceNumber,
            invoice.reference,
            invoice.clientName,
            invoice.clientEmail,
            invoice.packageName,
            invoice.status
          ),
        limit
      )
    : [];
  const matchedPayments = query
    ? takeMatches(
        query,
        payments,
        (payment) =>
          matchQuery(
            query,
            payment.id,
            payment.reference,
            payment.clientName,
            payment.supplierName,
            payment.description,
            payment.status,
            payment.type
          ),
        limit
      )
    : [];
  const matchedHotels = query
    ? takeMatches(
        query,
        hotels,
        (hotel) =>
          matchQuery(
            query,
            hotel.id,
            hotel.name,
            hotel.location,
            hotel.type,
            hotel.email,
            hotel.contact,
            hotel.notes
          ),
        limit
      )
    : [];
  const matchedTodos = query
    ? takeMatches(
        query,
        todos,
        (todo) => matchQuery(query, todo.id, todo.title, todo.completed ? "done" : "open"),
        limit
      )
    : [];
  const matchedEmployees = query
    ? takeMatches(
        query,
        employees,
        (employee) =>
          matchQuery(
            query,
            employee.id,
            employee.name,
            employee.email,
            employee.role,
            employee.department,
            employee.status
          ),
        limit
      )
    : [];

  return [
    `Live app data snapshot as of ${new Date().toISOString()}:`,
    `- Bookings: ${leads.length} total (${formatCountMap(
      countBy(leads.map((lead) => lead.status))
    )})`,
    `- Packages: ${packages.length} total (${packages.filter((pkg) => pkg.published !== false).length} published)`,
    `- Tours: ${tours.length} total (${formatCountMap(
      countBy(tours.map((tour) => tour.status))
    )})`,
    `- Invoices: ${invoices.length} total (${formatCountMap(
      countBy(invoices.map((invoice) => invoice.status))
    )})`,
    `- Payments: ${payments.length} total (${formatCountMap(
      countBy(payments.map((payment) => `${payment.type}_${payment.status}`))
    )})`,
    `- Suppliers: ${hotels.length} total (${formatCountMap(
      countBy(hotels.map((hotel) => hotel.type))
    )})`,
    `- Todos: ${todos.length} total (${todos.filter((todo) => !todo.completed).length} open)`,
    `- Employees: ${employees.length} total (${formatCountMap(
      countBy(employees.map((employee) => employee.status))
    )})`,
    `- Revenue snapshot from active tours: ${formatMoney(tourRevenue)}`,
    `- Receivables snapshot from pending or overdue invoices: ${formatMoney(
      receivables
    )}`,
    `- Cash snapshot from completed payments: ${formatMoney(
      completedIncoming - completedOutgoing
    )}`,
    "",
    query
      ? `Query-matched records for "${query}":`
      : "No specific query provided for matched records.",
    matchedLeads.length
      ? `- Matching bookings: ${matchedLeads.map(formatLead).join(" || ")}`
      : "",
    matchedPackages.length
      ? `- Matching packages: ${matchedPackages.map(formatPackage).join(" || ")}`
      : "",
    matchedTours.length
      ? `- Matching tours: ${matchedTours.map(formatTour).join(" || ")}`
      : "",
    matchedInvoices.length
      ? `- Matching invoices: ${matchedInvoices.map(formatInvoice).join(" || ")}`
      : "",
    matchedPayments.length
      ? `- Matching payments: ${matchedPayments.map(formatPayment).join(" || ")}`
      : "",
    matchedHotels.length
      ? `- Matching suppliers: ${matchedHotels.map(formatHotel).join(" || ")}`
      : "",
    matchedTodos.length
      ? `- Matching todos: ${matchedTodos.map(formatTodo).join(" || ")}`
      : "",
    matchedEmployees.length
      ? `- Matching employees: ${matchedEmployees
          .map(formatEmployee)
          .join(" || ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

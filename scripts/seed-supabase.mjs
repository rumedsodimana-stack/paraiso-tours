import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);


async function seedData() {
  const packagesData = JSON.parse(readFileSync("data/packages.json", "utf-8"));

  // Seed packages
  console.log("Seeding packages...");
  for (const pkg of packagesData) {
    const { error } = await supabase.from("packages").upsert({
      id: pkg.id,
      name: pkg.name,
      duration: pkg.duration,
      destination: pkg.destination,
      price: pkg.price,
      currency: pkg.currency,
      description: pkg.description,
      itinerary: pkg.itinerary,
      inclusions: pkg.inclusions,
      exclusions: pkg.exclusions,
      region: pkg.region || null,
      image_url: pkg.imageUrl || null,
      rating: pkg.rating || null,
      review_count: pkg.reviewCount || null,
      featured: pkg.featured || false,
      published: pkg.published !== false,
      cancellation_policy: pkg.cancellationPolicy || null,
      meal_options: pkg.mealOptions || [],
      transport_options: pkg.transportOptions || [],
      accommodation_options: pkg.accommodationOptions || [],
      custom_options: [],
      created_at: pkg.createdAt || new Date().toISOString(),
    });
    if (error) console.error(`  Package ${pkg.id}: ${error.message}`);
    else console.log(`  Package ${pkg.id} ✓`);
  }

  // Read seed SQL and parse INSERT statements, then use supabase client
  console.log("\nSeeding hotels...");
  const hotels = [
    { id: 'h1', name: 'Jetwing Lagoon', type: 'hotel', location: 'Negombo', email: 'reservations@jetwinglagoon.com', contact: '+94 31 233 0100', default_price_per_night: 120, currency: 'USD', max_concurrent_bookings: 10, star_rating: 4.5, notes: 'Beachfront resort with pool and spa.', bank_name: 'Commercial Bank', account_name: 'Jetwing Hotels Ltd', account_number: '1040012345' },
    { id: 'h2', name: 'Heritance Kandalama', type: 'hotel', location: 'Dambulla', email: 'reservations@heritancehotels.com', contact: '+94 66 555 5000', default_price_per_night: 185, currency: 'USD', max_concurrent_bookings: 8, star_rating: 5, notes: 'Geoffrey Bawa masterpiece overlooking Kandalama lake.', bank_name: 'Sampath Bank', account_name: 'Aitken Spence Hotels', account_number: '1102009876' },
    { id: 'h3', name: 'Fort Bazaar', type: 'boutique', location: 'Galle Fort', email: 'stay@fortbazaar.com', contact: '+94 91 224 2870', default_price_per_night: 95, currency: 'USD', max_concurrent_bookings: 6, star_rating: 4, notes: 'Boutique hotel inside Galle Fort walls.', bank_name: 'HNB', account_name: 'Teardrop Hotels', account_number: '2500045678' },
    { id: 'h4', name: '98 Acres Resort', type: 'hotel', location: 'Ella', email: 'info@98acres.com', contact: '+94 57 205 0860', default_price_per_night: 150, currency: 'USD', max_concurrent_bookings: 5, star_rating: 4, notes: 'Mountain retreat with valley views.', bank_name: 'Commercial Bank', account_name: '98 Acres Pvt Ltd', account_number: '1040098765' },
    { id: 'h5', name: 'Heritance Tea Factory', type: 'hotel', location: 'Nuwara Eliya', email: 'teafactory@heritancehotels.com', contact: '+94 52 555 5000', default_price_per_night: 200, currency: 'USD', max_concurrent_bookings: 6, star_rating: 5, notes: 'Converted colonial tea factory at 2000m altitude.', bank_name: 'Sampath Bank', account_name: 'Aitken Spence Hotels', account_number: '1102006543' },
    { id: 'h6', name: 'Cinnamon Wild', type: 'hotel', location: 'Yala', email: 'wild@cinnamonhotels.com', contact: '+94 47 223 9450', default_price_per_night: 220, currency: 'USD', max_concurrent_bookings: 8, star_rating: 4, notes: 'Eco-lodge bordering Yala National Park.', bank_name: 'BOC', account_name: 'John Keells Hotels', account_number: '8001122334' },
    { id: 'h7', name: 'Jetwing Yala', type: 'hotel', location: 'Yala', email: 'yala@jetwinghotels.com', contact: '+94 47 203 9200', default_price_per_night: 180, currency: 'USD', max_concurrent_bookings: 10, star_rating: 4.5, notes: 'Modern beach resort near Yala entrance.', bank_name: 'Commercial Bank', account_name: 'Jetwing Hotels Ltd', account_number: '1040011223' },
    { id: 'h8', name: 'Shangri-La Colombo', type: 'hotel', location: 'Colombo', email: 'slcb@shangri-la.com', contact: '+94 11 788 8288', default_price_per_night: 250, currency: 'USD', max_concurrent_bookings: 20, star_rating: 5, notes: 'Luxury city hotel on Galle Face.', bank_name: 'HSBC', account_name: 'Shangri-La Lanka Ltd', account_number: '0011230099' },
    { id: 'ht1', name: 'Lanka Chauffeur Service', type: 'transport', location: 'Colombo', email: 'info@lankachauffeur.lk', contact: '+94 77 123 4567', default_price_per_night: null, currency: 'USD', notes: 'Premium private car & driver service island-wide.', bank_name: 'Sampath Bank', account_name: 'Lanka Chauffeur Pvt Ltd', account_number: '1102099887' },
    { id: 'ht2', name: 'Comfort Van Hire', type: 'transport', location: 'Kandy', email: 'bookings@comfortvanhire.lk', contact: '+94 77 765 4321', default_price_per_night: null, currency: 'USD', notes: 'Premium vans for group travel.', bank_name: 'BOC', account_name: 'Comfort Van Hire', account_number: '8005544332' },
    { id: 'ht3', name: 'Island Coach Tours', type: 'transport', location: 'Colombo', email: 'info@islandcoach.lk', contact: '+94 11 258 0099', default_price_per_night: null, currency: 'USD', notes: 'Luxury coach services.', bank_name: 'HNB', account_name: 'Island Coach Tours', account_number: '2500011222' },
    { id: 'ht4', name: 'Yala Safari Jeeps', type: 'transport', location: 'Tissamaharama', email: 'jeeps@yalasafari.lk', contact: '+94 47 223 7788', default_price_per_night: null, currency: 'USD', notes: 'Licensed Yala National Park safari vehicles.', bank_name: 'BOC', account_name: 'Yala Safari Jeeps', account_number: '8009988776' },
    { id: 'ht5', name: 'South Coast Transfers', type: 'transport', location: 'Matara', email: 'rides@southcoast.lk', contact: '+94 41 222 3344', default_price_per_night: null, currency: 'USD', notes: 'Minivan service along southern coast.', bank_name: 'Sampath Bank', account_name: 'South Coast Transfers', account_number: '1102077665' },
  ];
  const { error: hErr } = await supabase.from("hotels").upsert(hotels);
  if (hErr) console.error(`  Hotels: ${hErr.message}`);
  else console.log(`  ${hotels.length} hotels/suppliers ✓`);

  console.log("\nSeeding employees...");
  const employees = [
    { id: 'emp1', name: 'Nimal Perera', email: 'nimal@paraisotours.lk', phone: '+94 77 100 2001', role: 'Operations Manager', department: 'Operations', pay_type: 'salary', salary: 3200, tax_pct: 12, benefits_amount: 150, currency: 'USD', bank_name: 'Commercial Bank', account_number: '1040055001', status: 'active', start_date: '2025-06-01' },
    { id: 'emp2', name: 'Sanduni Fernando', email: 'sanduni@paraisotours.lk', phone: '+94 77 100 2002', role: 'Sales Agent', department: 'Sales', pay_type: 'salary', salary: 1800, commission_pct: 5, tax_pct: 12, benefits_amount: 80, currency: 'USD', bank_name: 'Sampath Bank', account_number: '1102055002', status: 'active', start_date: '2025-08-15' },
    { id: 'emp3', name: 'Kasun Silva', email: 'kasun@paraisotours.lk', phone: '+94 77 100 2003', role: 'Tour Guide', department: 'Tours', pay_type: 'commission', commission_pct: 10, tax_pct: 8, benefits_amount: 0, currency: 'USD', bank_name: 'BOC', account_number: '8005055003', status: 'active', start_date: '2025-10-01' },
    { id: 'emp4', name: 'Anjali Dias', email: 'anjali@paraisotours.lk', phone: '+94 77 100 2004', role: 'Accountant', department: 'Finance', pay_type: 'salary', salary: 2400, tax_pct: 12, benefits_amount: 120, currency: 'USD', bank_name: 'HNB', account_number: '2500055004', status: 'active', start_date: '2025-07-01' },
    { id: 'emp5', name: 'Ruwan Jayawardena', email: 'ruwan@paraisotours.lk', phone: '+94 77 100 2005', role: 'Driver', department: 'Operations', pay_type: 'hourly', hourly_rate: 8, tax_pct: 6, benefits_amount: 0, currency: 'USD', bank_name: 'BOC', account_number: '8005055005', status: 'active', start_date: '2025-11-01' },
  ];
  const { error: eErr } = await supabase.from("employees").upsert(employees);
  if (eErr) console.error(`  Employees: ${eErr.message}`);
  else console.log(`  ${employees.length} employees ✓`);

  console.log("\nSeeding leads...");
  const leads = [
    { id: 'lead1', reference: 'PCT-20260315-A1B2C', name: 'Emma Thompson', email: 'emma.thompson@gmail.com', phone: '+44 7700 900123', source: 'website', status: 'confirmed', destination: 'Sri Lanka', travel_date: '2026-05-10', pax: 2, notes: 'Honeymoon trip — wants a surprise cake at Fort Bazaar.', package_id: 'p1', selected_accommodation_option_id: 'acc1', selected_transport_option_id: 'tr1', selected_meal_option_id: 'm2', total_price: 2290, created_at: '2026-03-15T10:30:00Z', updated_at: '2026-03-20T14:00:00Z' },
    { id: 'lead2', reference: 'PCT-20260320-D3E4F', name: 'Hans Müller', email: 'hans.mueller@web.de', phone: '+49 170 1234567', source: 'referral', status: 'confirmed', destination: 'Sri Lanka', travel_date: '2026-04-20', pax: 4, notes: 'Family of 4 including 2 kids (8 & 12). Need child-friendly activities.', package_id: 'p6', selected_accommodation_option_id: 'acc11', selected_transport_option_id: 'tr12', selected_meal_option_id: 'm14', total_price: 3860, created_at: '2026-03-20T08:15:00Z', updated_at: '2026-03-22T09:00:00Z' },
    { id: 'lead3', reference: 'PCT-20260325-G5H6I', name: 'Yuki Tanaka', email: 'yuki.tanaka@yahoo.co.jp', phone: '+81 90 1234 5678', source: 'website', status: 'new', destination: 'Sri Lanka', travel_date: '2026-06-05', pax: 1, notes: 'Solo traveller. Interested in photography workshops.', package_id: 'p3', selected_accommodation_option_id: 'acc5', selected_transport_option_id: 'tr5', selected_meal_option_id: 'm7', total_price: 520, created_at: '2026-03-25T16:45:00Z', updated_at: '2026-03-25T16:45:00Z' },
    { id: 'lead4', reference: 'PCT-20260328-J7K8L', name: 'Sarah & James Mitchell', email: 'sarah.mitchell@outlook.com', phone: '+1 555 234 5678', source: 'instagram', status: 'quoted', destination: 'Sri Lanka', travel_date: '2026-07-15', pax: 2, notes: 'Anniversary trip. Want luxury all the way. Interested in wellness add-on.', package_id: 'p8', selected_accommodation_option_id: 'acc15', selected_transport_option_id: 'tr15', selected_meal_option_id: 'm19', total_price: 1890, created_at: '2026-03-28T12:00:00Z', updated_at: '2026-03-30T11:00:00Z' },
    { id: 'lead5', reference: 'PCT-20260401-M9N0P', name: 'Pierre Dubois', email: 'pierre.dubois@free.fr', phone: '+33 6 12 34 56 78', source: 'tripadvisor', status: 'confirmed', destination: 'Sri Lanka', travel_date: '2026-04-25', pax: 3, notes: 'Group of 3 friends. Keen on surfing and nightlife.', package_id: 'p10', selected_accommodation_option_id: 'acc19', selected_transport_option_id: 'tr17', selected_meal_option_id: 'm21', total_price: 1860, created_at: '2026-04-01T09:20:00Z', updated_at: '2026-04-05T15:30:00Z' },
    { id: 'lead6', reference: 'PCT-20260405-Q1R2S', name: 'Liu Wei', email: 'liuwei88@163.com', phone: '+86 138 0013 8000', source: 'website', status: 'contacted', destination: 'Sri Lanka', travel_date: '2026-08-01', pax: 6, notes: 'Large group, corporate team-building trip. Needs conference room at hotel.', package_id: 'p1', selected_accommodation_option_id: 'acc2', selected_transport_option_id: 'tr2', selected_meal_option_id: 'm3', total_price: 4200, created_at: '2026-04-05T07:30:00Z', updated_at: '2026-04-07T10:00:00Z' },
    { id: 'lead7', reference: 'PCT-20260408-T3U4V', name: 'Olivia Chen', email: 'olivia.chen@gmail.com', phone: '+61 412 345 678', source: 'website', status: 'completed', destination: 'Sri Lanka', travel_date: '2026-03-01', pax: 2, notes: 'Completed tour. Left a 5-star review.', package_id: 'p2', selected_accommodation_option_id: 'acc4', selected_transport_option_id: 'tr4', selected_meal_option_id: 'm5', total_price: 1380, created_at: '2026-02-10T11:00:00Z', updated_at: '2026-03-06T18:00:00Z' },
    { id: 'lead8', reference: 'PCT-20260410-W5X6Y', name: 'Ahmed Al-Rashid', email: 'ahmed.rashid@gmail.com', phone: '+971 50 123 4567', source: 'referral', status: 'new', destination: 'Sri Lanka', travel_date: '2026-09-10', pax: 2, notes: 'Looking for halal food options. Wants to visit Colombo mosques.', package_id: 'p5', selected_accommodation_option_id: 'acc9', selected_transport_option_id: 'tr9', selected_meal_option_id: 'm12', total_price: 460, created_at: '2026-04-10T14:20:00Z', updated_at: '2026-04-10T14:20:00Z' },
    { id: 'lead9', reference: 'PCT-20260412-Z7A8B', name: 'Maria Santos', email: 'maria.santos@hotmail.com', phone: '+55 11 91234 5678', source: 'facebook', status: 'cancelled', destination: 'Sri Lanka', travel_date: '2026-05-20', pax: 2, notes: 'Cancelled due to visa issues. May rebook for later date.', package_id: 'p7', selected_accommodation_option_id: 'acc14', selected_transport_option_id: 'tr13', selected_meal_option_id: 'm16', total_price: 1780, created_at: '2026-04-12T06:45:00Z', updated_at: '2026-04-13T08:00:00Z' },
    { id: 'lead10', reference: 'PCT-20260413-C9D0E', name: 'David & Anna Kowalski', email: 'david.kowalski@gmail.com', phone: '+48 501 234 567', source: 'website', status: 'new', destination: 'Sri Lanka', travel_date: '2026-06-20', pax: 2, notes: 'First time in Asia. Want comprehensive cultural experience.', package_id: 'p6', selected_accommodation_option_id: 'acc12', selected_transport_option_id: 'tr11', selected_meal_option_id: 'm15', total_price: 5480, created_at: '2026-04-13T10:00:00Z', updated_at: '2026-04-13T10:00:00Z' },
  ];
  const { error: lErr } = await supabase.from("leads").upsert(leads);
  if (lErr) console.error(`  Leads: ${lErr.message}`);
  else console.log(`  ${leads.length} leads ✓`);

  console.log("\nSeeding tours...");
  const tours = [
    { id: 'tour1', package_id: 'p1', package_name: 'Ceylon Heritage & Wildlife', lead_id: 'lead1', client_name: 'Emma Thompson', start_date: '2026-05-10', end_date: '2026-05-17', pax: 2, status: 'scheduled', total_value: 2290, currency: 'USD', availability_status: 'confirmed', created_at: '2026-03-21T10:00:00Z', updated_at: '2026-03-21T10:00:00Z' },
    { id: 'tour2', package_id: 'p6', package_name: 'Extended Heritage Journey', lead_id: 'lead2', client_name: 'Hans Müller', start_date: '2026-04-20', end_date: '2026-04-29', pax: 4, status: 'scheduled', total_value: 3860, currency: 'USD', availability_status: 'confirmed', created_at: '2026-03-23T09:00:00Z', updated_at: '2026-03-23T09:00:00Z' },
    { id: 'tour3', package_id: 'p10', package_name: 'East Coast Beaches', lead_id: 'lead5', client_name: 'Pierre Dubois', start_date: '2026-04-25', end_date: '2026-04-29', pax: 3, status: 'scheduled', total_value: 1860, currency: 'USD', availability_status: 'confirmed', created_at: '2026-04-06T12:00:00Z', updated_at: '2026-04-06T12:00:00Z' },
    { id: 'tour4', package_id: 'p2', package_name: 'Beach & Culture Escape', lead_id: 'lead7', client_name: 'Olivia Chen', start_date: '2026-03-01', end_date: '2026-03-05', pax: 2, status: 'completed', total_value: 1380, currency: 'USD', availability_status: 'confirmed', created_at: '2026-02-15T14:00:00Z', updated_at: '2026-03-06T18:00:00Z' },
  ];
  const { error: tErr } = await supabase.from("tours").upsert(tours);
  if (tErr) console.error(`  Tours: ${tErr.message}`);
  else console.log(`  ${tours.length} tours ✓`);

  console.log("\nSeeding invoices...");
  const invoices = [
    { id: 'inv1', lead_id: 'lead1', reference: 'PCT-20260315-A1B2C', invoice_number: 'INV-2026-0001', status: 'paid', client_name: 'Emma Thompson', client_email: 'emma.thompson@gmail.com', client_phone: '+44 7700 900123', package_name: 'Ceylon Heritage & Wildlife', travel_date: '2026-05-10', pax: 2, base_amount: 1890, line_items: [{ description: 'Base package (2 pax)', amount: 1890 }, { description: 'HB Meal upgrade (2 pax)', amount: 200 }, { description: 'Private Car & Driver (8 days)', amount: 200 }], total_amount: 2290, currency: 'USD', notes: 'Paid in full via bank transfer.', paid_at: '2026-03-25T12:00:00Z', created_at: '2026-03-21T10:00:00Z', updated_at: '2026-03-25T12:00:00Z' },
    { id: 'inv2', lead_id: 'lead2', reference: 'PCT-20260320-D3E4F', invoice_number: 'INV-2026-0002', status: 'paid', client_name: 'Hans Müller', client_email: 'hans.mueller@web.de', client_phone: '+49 170 1234567', package_name: 'Extended Heritage Journey', travel_date: '2026-04-20', pax: 4, base_amount: 2490, line_items: [{ description: 'Base package (4 pax)', amount: 2490 }, { description: 'HB Meal upgrade (4 pax)', amount: 560 }, { description: 'Premium Van (10 days)', amount: 810 }], total_amount: 3860, currency: 'USD', notes: '50% deposit paid. Balance due 7 days before travel.', paid_at: '2026-03-28T10:00:00Z', created_at: '2026-03-23T09:00:00Z', updated_at: '2026-03-28T10:00:00Z' },
    { id: 'inv3', lead_id: 'lead5', reference: 'PCT-20260401-M9N0P', invoice_number: 'INV-2026-0003', status: 'sent', client_name: 'Pierre Dubois', client_email: 'pierre.dubois@free.fr', client_phone: '+33 6 12 34 56 78', package_name: 'East Coast Beaches', travel_date: '2026-04-25', pax: 3, base_amount: 620, line_items: [{ description: 'Base package (3 pax)', amount: 620 }, { description: 'Private Car & Driver (5 days)', amount: 350 }, { description: 'Accommodation (4 nights)', amount: 480 }], total_amount: 1860, currency: 'USD', notes: 'Invoice sent, awaiting payment.', created_at: '2026-04-06T12:00:00Z', updated_at: '2026-04-06T12:00:00Z' },
    { id: 'inv4', lead_id: 'lead7', reference: 'PCT-20260408-T3U4V', invoice_number: 'INV-2026-0004', status: 'paid', client_name: 'Olivia Chen', client_email: 'olivia.chen@gmail.com', client_phone: '+61 412 345 678', package_name: 'Beach & Culture Escape', travel_date: '2026-03-01', pax: 2, base_amount: 690, line_items: [{ description: 'Base package (2 pax)', amount: 690 }, { description: 'Private Car & Driver (5 days)', amount: 300 }, { description: 'Accommodation (4 nights)', amount: 380 }], total_amount: 1380, currency: 'USD', notes: 'Fully paid and completed. Guest tipped guide.', paid_at: '2026-02-20T16:00:00Z', created_at: '2026-02-15T14:00:00Z', updated_at: '2026-03-06T18:00:00Z' },
  ];
  const { error: iErr } = await supabase.from("invoices").upsert(invoices);
  if (iErr) console.error(`  Invoices: ${iErr.message}`);
  else console.log(`  ${invoices.length} invoices ✓`);

  console.log("\nSeeding payments...");
  const payments = [
    { id: 'pay1', type: 'incoming', amount: 2290, currency: 'USD', description: 'Full payment — Ceylon Heritage & Wildlife', client_name: 'Emma Thompson', reference: 'PCT-20260315-A1B2C', lead_id: 'lead1', tour_id: 'tour1', invoice_id: 'inv1', status: 'completed', date: '2026-03-25' },
    { id: 'pay2', type: 'incoming', amount: 1930, currency: 'USD', description: '50% deposit — Extended Heritage Journey', client_name: 'Hans Müller', reference: 'PCT-20260320-D3E4F', lead_id: 'lead2', tour_id: 'tour2', invoice_id: 'inv2', status: 'completed', date: '2026-03-28' },
    { id: 'pay3', type: 'incoming', amount: 1380, currency: 'USD', description: 'Full payment — Beach & Culture Escape', client_name: 'Olivia Chen', reference: 'PCT-20260408-T3U4V', lead_id: 'lead7', tour_id: 'tour4', invoice_id: 'inv4', status: 'completed', date: '2026-02-20' },
    { id: 'pay4', type: 'outgoing', amount: 840, currency: 'USD', description: 'Accommodation — Jetwing Lagoon (7 nights)', reference: 'SUP-2026-001', lead_id: 'lead1', tour_id: 'tour1', supplier_id: 'h1', status: 'completed', date: '2026-04-01' },
    { id: 'pay5', type: 'outgoing', amount: 640, currency: 'USD', description: 'Transport — Lanka Chauffeur Service (8 days)', reference: 'SUP-2026-002', lead_id: 'lead1', tour_id: 'tour1', supplier_id: 'ht1', status: 'completed', date: '2026-04-01' },
    { id: 'pay6', type: 'outgoing', amount: 1080, currency: 'USD', description: 'Accommodation — Jetwing Lagoon (9 nights)', reference: 'SUP-2026-003', lead_id: 'lead2', tour_id: 'tour2', supplier_id: 'h1', status: 'pending', date: '2026-04-15' },
    { id: 'pay7', type: 'outgoing', amount: 1200, currency: 'USD', description: 'Transport — Comfort Van Hire (10 days)', reference: 'SUP-2026-004', lead_id: 'lead2', tour_id: 'tour2', supplier_id: 'ht2', status: 'pending', date: '2026-04-15' },
    { id: 'pay8', type: 'outgoing', amount: 380, currency: 'USD', description: 'Accommodation — Fort Bazaar (4 nights)', reference: 'SUP-2026-005', lead_id: 'lead7', tour_id: 'tour4', supplier_id: 'h3', status: 'completed', date: '2026-02-25' },
    { id: 'pay9', type: 'outgoing', amount: 300, currency: 'USD', description: 'Transport — Lanka Chauffeur Service (5 days)', reference: 'SUP-2026-006', lead_id: 'lead7', tour_id: 'tour4', supplier_id: 'ht1', status: 'completed', date: '2026-02-25' },
  ];
  const { error: pErr } = await supabase.from("payments").upsert(payments);
  if (pErr) console.error(`  Payments: ${pErr.message}`);
  else console.log(`  ${payments.length} payments ✓`);

  console.log("\nSeeding payroll runs...");
  const payroll = [
    { id: 'pr1', period_start: '2026-03-01', period_end: '2026-03-31', pay_date: '2026-04-05', status: 'paid', items: [
      { employeeId: 'emp1', employeeName: 'Nimal Perera', role: 'Operations Manager', grossPay: 3200, deductions: 534, netPay: 2666 },
      { employeeId: 'emp2', employeeName: 'Sanduni Fernando', role: 'Sales Agent', grossPay: 1800, deductions: 296, netPay: 1504 },
      { employeeId: 'emp3', employeeName: 'Kasun Silva', role: 'Tour Guide', grossPay: 420, deductions: 33.6, netPay: 386.4 },
      { employeeId: 'emp4', employeeName: 'Anjali Dias', role: 'Accountant', grossPay: 2400, deductions: 408, netPay: 1992 },
      { employeeId: 'emp5', employeeName: 'Ruwan Jayawardena', role: 'Driver', grossPay: 1280, deductions: 76.8, netPay: 1203.2 },
    ], total_gross: 9100, total_deductions: 1348.4, total_net: 7751.6, currency: 'USD', paid_at: '2026-04-05T10:00:00Z', created_at: '2026-04-01T08:00:00Z' },
  ];
  const { error: prErr } = await supabase.from("payroll_runs").upsert(payroll);
  if (prErr) console.error(`  Payroll: ${prErr.message}`);
  else console.log(`  ${payroll.length} payroll runs ✓`);

  console.log("\nSeeding todos...");
  const todos = [
    { id: 'todo1', title: 'Follow up with Liu Wei on conference room requirements', completed: false },
    { id: 'todo2', title: 'Send Pierre Dubois payment reminder for INV-2026-0003', completed: false },
    { id: 'todo3', title: 'Prepare honeymoon surprise cake order for Emma Thompson tour', completed: false },
    { id: 'todo4', title: 'Arrange halal restaurant list for Ahmed Al-Rashid', completed: false },
    { id: 'todo5', title: 'Collect remaining 50% balance from Hans Müller before Apr 13', completed: false },
    { id: 'todo6', title: 'Contact Maria Santos about rebooking after visa resolved', completed: false },
    { id: 'todo7', title: 'Request Olivia Chen 5-star review for TripAdvisor', completed: true },
    { id: 'todo8', title: 'Update Yuki Tanaka with photography workshop options', completed: false },
  ];
  const { error: tdErr } = await supabase.from("todos").upsert(todos);
  if (tdErr) console.error(`  Todos: ${tdErr.message}`);
  else console.log(`  ${todos.length} todos ✓`);

  console.log("\nSeeding audit logs...");
  const auditLogs = [
    { id: 'aud1', entity_type: 'lead', entity_id: 'lead1', action: 'status_change', summary: 'Lead status changed from new to confirmed', actor: 'admin', details: [{ field: 'status', from: 'new', to: 'confirmed' }], created_at: '2026-03-20T14:00:00Z' },
    { id: 'aud2', entity_type: 'lead', entity_id: 'lead2', action: 'status_change', summary: 'Lead status changed from new to confirmed', actor: 'admin', details: [{ field: 'status', from: 'new', to: 'confirmed' }], created_at: '2026-03-22T09:00:00Z' },
    { id: 'aud3', entity_type: 'tour', entity_id: 'tour1', action: 'created', summary: 'Tour scheduled for Emma Thompson — Ceylon Heritage & Wildlife', actor: 'admin', details: [], created_at: '2026-03-21T10:00:00Z' },
    { id: 'aud4', entity_type: 'tour', entity_id: 'tour2', action: 'created', summary: 'Tour scheduled for Hans Müller — Extended Heritage Journey', actor: 'admin', details: [], created_at: '2026-03-23T09:00:00Z' },
    { id: 'aud5', entity_type: 'invoice', entity_id: 'inv1', action: 'created', summary: 'Invoice INV-2026-0001 created for Emma Thompson', actor: 'admin', details: [], created_at: '2026-03-21T10:30:00Z' },
    { id: 'aud6', entity_type: 'payment', entity_id: 'pay1', action: 'created', summary: 'Payment of $2,290 received from Emma Thompson', actor: 'admin', details: [], created_at: '2026-03-25T12:00:00Z' },
    { id: 'aud7', entity_type: 'lead', entity_id: 'lead7', action: 'status_change', summary: 'Lead status changed from confirmed to completed', actor: 'admin', details: [{ field: 'status', from: 'confirmed', to: 'completed' }], created_at: '2026-03-06T18:00:00Z' },
    { id: 'aud8', entity_type: 'lead', entity_id: 'lead9', action: 'status_change', summary: 'Lead status changed from new to cancelled', actor: 'admin', details: [{ field: 'status', from: 'new', to: 'cancelled' }], created_at: '2026-04-13T08:00:00Z' },
    { id: 'aud9', entity_type: 'employee', entity_id: 'emp1', action: 'created', summary: 'Employee Nimal Perera added as Operations Manager', actor: 'admin', details: [], created_at: '2025-06-01T08:00:00Z' },
    { id: 'aud10', entity_type: 'payroll', entity_id: 'pr1', action: 'created', summary: 'March 2026 payroll run processed — $7,751.60 net', actor: 'admin', details: [], created_at: '2026-04-01T08:00:00Z' },
  ];
  const { error: aErr } = await supabase.from("audit_logs").upsert(auditLogs);
  if (aErr) console.error(`  Audit logs: ${aErr.message}`);
  else console.log(`  ${auditLogs.length} audit logs ✓`);

  console.log("\nSeeding app settings...");
  const { error: sErr } = await supabase.from("app_settings").upsert({
    id: 'main',
    company: { name: 'Paraíso Ceylon Tours', tagline: 'Your Gateway to Sri Lanka', email: 'hello@paraisotours.lk', phone: '+94 77 100 2000', address: '42 Galle Road, Colombo 03, Sri Lanka', website: 'https://paraiso-tours.vercel.app', currency: 'USD', timezone: 'Asia/Colombo', logo: '' },
    portal: { heroTitle: 'Discover Sri Lanka with Paraíso', heroSubtitle: 'Curated tours, authentic experiences, unforgettable memories', primaryColor: '#0d9488', accentColor: '#b45309' },
    ai: { provider: 'none', model: '' },
  });
  if (sErr) console.error(`  Settings: ${sErr.message}`);
  else console.log(`  Settings ✓`);

  console.log("\nSeeding AI knowledge base...");
  const knowledge = [
    { id: 'aikb1', title: 'Visa Requirements for Sri Lanka', content: 'Most nationalities can obtain an Electronic Travel Authorization (ETA) online at eta.gov.lk. Cost is $50 USD for tourism. Valid for 30 days, extendable to 90 days.', source_type: 'manual', tags: ['visa', 'travel-info', 'faq'], active: true },
    { id: 'aikb2', title: 'Best Time to Visit Sri Lanka', content: 'Southwest coast & hill country: December to March (dry season). East coast: April to September. Cultural Triangle: year-round, best Jan–Apr. Whale watching in Mirissa: November to April.', source_type: 'manual', tags: ['weather', 'seasons', 'planning'], active: true },
    { id: 'aikb3', title: 'Cancellation & Refund Policy', content: 'Free cancellation up to 14 days before tour start — full refund. 7–14 days: 50% refund. Under 7 days: no refund, but credit note valid 12 months.', source_type: 'manual', tags: ['policy', 'cancellation', 'refund'], active: true },
  ];
  const { error: kErr } = await supabase.from("ai_knowledge_documents").upsert(knowledge);
  if (kErr) console.error(`  Knowledge: ${kErr.message}`);
  else console.log(`  ${knowledge.length} knowledge docs ✓`);

  console.log("\n✅ Seed complete!");
}

seedData().catch(console.error);

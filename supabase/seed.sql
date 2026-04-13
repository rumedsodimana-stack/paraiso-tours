-- Paraíso Ceylon Tours — Full Demo Seed
-- Run AFTER schema.sql

-- ============================================================
-- HOTELS / SUPPLIERS
-- ============================================================
INSERT INTO hotels (id, name, type, location, email, contact, default_price_per_night, currency, max_concurrent_bookings, star_rating, notes, bank_name, account_name, account_number, created_at) VALUES
('h1', 'Jetwing Lagoon', 'hotel', 'Negombo', 'reservations@jetwinglagoon.com', '+94 31 233 0100', 120, 'USD', 10, 4.5, 'Beachfront resort with pool and spa.', 'Commercial Bank', 'Jetwing Hotels Ltd', '1040012345', NOW()),
('h2', 'Heritance Kandalama', 'hotel', 'Dambulla', 'reservations@heritancehotels.com', '+94 66 555 5000', 185, 'USD', 8, 5, 'Geoffrey Bawa masterpiece overlooking Kandalama lake.', 'Sampath Bank', 'Aitken Spence Hotels', '1102009876', NOW()),
('h3', 'Fort Bazaar', 'boutique', 'Galle Fort', 'stay@fortbazaar.com', '+94 91 224 2870', 95, 'USD', 6, 4, 'Boutique hotel inside Galle Fort walls.', 'HNB', 'Teardrop Hotels', '2500045678', NOW()),
('h4', '98 Acres Resort', 'hotel', 'Ella', 'info@98acres.com', '+94 57 205 0860', 150, 'USD', 5, 4, 'Mountain retreat with valley views.', 'Commercial Bank', '98 Acres Pvt Ltd', '1040098765', NOW()),
('h5', 'Heritance Tea Factory', 'hotel', 'Nuwara Eliya', 'teafactory@heritancehotels.com', '+94 52 555 5000', 200, 'USD', 6, 5, 'Converted colonial tea factory at 2000m altitude.', 'Sampath Bank', 'Aitken Spence Hotels', '1102006543', NOW()),
('h6', 'Cinnamon Wild', 'hotel', 'Yala', 'wild@cinnamonhotels.com', '+94 47 223 9450', 220, 'USD', 8, 4, 'Eco-lodge bordering Yala National Park.', 'BOC', 'John Keells Hotels', '8001122334', NOW()),
('h7', 'Jetwing Yala', 'hotel', 'Yala', 'yala@jetwinghotels.com', '+94 47 203 9200', 180, 'USD', 10, 4.5, 'Modern beach resort near Yala entrance.', 'Commercial Bank', 'Jetwing Hotels Ltd', '1040011223', NOW()),
('h8', 'Shangri-La Colombo', 'hotel', 'Colombo', 'slcb@shangri-la.com', '+94 11 788 8288', 250, 'USD', 20, 5, 'Luxury city hotel on Galle Face.', 'HSBC', 'Shangri-La Lanka Ltd', '0011230099', NOW()),
('ht1', 'Lanka Chauffeur Service', 'transport', 'Colombo', 'info@lankachauffeur.lk', '+94 77 123 4567', NULL, 'USD', NULL, NULL, 'Premium private car & driver service island-wide.', 'Sampath Bank', 'Lanka Chauffeur Pvt Ltd', '1102099887', NOW()),
('ht2', 'Comfort Van Hire', 'transport', 'Kandy', 'bookings@comfortvanhire.lk', '+94 77 765 4321', NULL, 'USD', NULL, NULL, 'Premium vans for group travel.', 'BOC', 'Comfort Van Hire', '8005544332', NOW()),
('ht3', 'Island Coach Tours', 'transport', 'Colombo', 'info@islandcoach.lk', '+94 11 258 0099', NULL, 'USD', NULL, NULL, 'Luxury coach services.', 'HNB', 'Island Coach Tours', '2500011222', NOW()),
('ht4', 'Yala Safari Jeeps', 'transport', 'Tissamaharama', 'jeeps@yalasafari.lk', '+94 47 223 7788', NULL, 'USD', NULL, NULL, 'Licensed Yala National Park safari vehicles.', 'BOC', 'Yala Safari Jeeps', '8009988776', NOW()),
('ht5', 'South Coast Transfers', 'transport', 'Matara', 'rides@southcoast.lk', '+94 41 222 3344', NULL, 'USD', NULL, NULL, 'Minivan service along southern coast.', 'Sampath Bank', 'South Coast Transfers', '1102077665', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- EMPLOYEES
-- ============================================================
INSERT INTO employees (id, name, email, phone, role, department, pay_type, salary, commission_pct, hourly_rate, tax_pct, benefits_amount, currency, bank_name, account_number, status, start_date, created_at) VALUES
('emp1', 'Nimal Perera', 'nimal@paraisotours.lk', '+94 77 100 2001', 'Operations Manager', 'Operations', 'salary', 3200, NULL, NULL, 12, 150, 'USD', 'Commercial Bank', '1040055001', 'active', '2025-06-01', NOW()),
('emp2', 'Sanduni Fernando', 'sanduni@paraisotours.lk', '+94 77 100 2002', 'Sales Agent', 'Sales', 'salary', 1800, 5, NULL, 12, 80, 'USD', 'Sampath Bank', '1102055002', 'active', '2025-08-15', NOW()),
('emp3', 'Kasun Silva', 'kasun@paraisotours.lk', '+94 77 100 2003', 'Tour Guide', 'Tours', 'commission', NULL, 10, NULL, 8, 0, 'USD', 'BOC', '8005055003', 'active', '2025-10-01', NOW()),
('emp4', 'Anjali Dias', 'anjali@paraisotours.lk', '+94 77 100 2004', 'Accountant', 'Finance', 'salary', 2400, NULL, NULL, 12, 120, 'USD', 'HNB', '2500055004', 'active', '2025-07-01', NOW()),
('emp5', 'Ruwan Jayawardena', 'ruwan@paraisotours.lk', '+94 77 100 2005', 'Driver', 'Operations', 'hourly', NULL, NULL, 8, 6, 0, 'USD', 'BOC', '8005055005', 'active', '2025-11-01', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- LEADS (BOOKINGS)
-- ============================================================
INSERT INTO leads (id, reference, name, email, phone, source, status, destination, travel_date, pax, notes, package_id, selected_accommodation_option_id, selected_transport_option_id, selected_meal_option_id, total_price, created_at, updated_at) VALUES
('lead1', 'PCT-20260315-A1B2C', 'Emma Thompson', 'emma.thompson@gmail.com', '+44 7700 900123', 'website', 'confirmed', 'Sri Lanka', '2026-05-10', 2, 'Honeymoon trip — wants a surprise cake at Fort Bazaar.', 'p1', 'acc1', 'tr1', 'm2', 2290, '2026-03-15T10:30:00Z', '2026-03-20T14:00:00Z'),
('lead2', 'PCT-20260320-D3E4F', 'Hans Müller', 'hans.mueller@web.de', '+49 170 1234567', 'referral', 'confirmed', 'Sri Lanka', '2026-04-20', 4, 'Family of 4 including 2 kids (8 & 12). Need child-friendly activities.', 'p6', 'acc11', 'tr12', 'm14', 3860, '2026-03-20T08:15:00Z', '2026-03-22T09:00:00Z'),
('lead3', 'PCT-20260325-G5H6I', 'Yuki Tanaka', 'yuki.tanaka@yahoo.co.jp', '+81 90 1234 5678', 'website', 'new', 'Sri Lanka', '2026-06-05', 1, 'Solo traveller. Interested in photography workshops.', 'p3', 'acc5', 'tr5', 'm7', 520, '2026-03-25T16:45:00Z', '2026-03-25T16:45:00Z'),
('lead4', 'PCT-20260328-J7K8L', 'Sarah & James Mitchell', 'sarah.mitchell@outlook.com', '+1 555 234 5678', 'instagram', 'quoted', 'Sri Lanka', '2026-07-15', 2, 'Anniversary trip. Want luxury all the way. Interested in wellness add-on.', 'p8', 'acc15', 'tr15', 'm19', 1890, '2026-03-28T12:00:00Z', '2026-03-30T11:00:00Z'),
('lead5', 'PCT-20260401-M9N0P', 'Pierre Dubois', 'pierre.dubois@free.fr', '+33 6 12 34 56 78', 'tripadvisor', 'confirmed', 'Sri Lanka', '2026-04-25', 3, 'Group of 3 friends. Keen on surfing and nightlife.', 'p10', 'acc19', 'tr17', 'm21', 1860, '2026-04-01T09:20:00Z', '2026-04-05T15:30:00Z'),
('lead6', 'PCT-20260405-Q1R2S', 'Liu Wei', 'liuwei88@163.com', '+86 138 0013 8000', 'website', 'contacted', 'Sri Lanka', '2026-08-01', 6, 'Large group, corporate team-building trip. Needs conference room at hotel.', 'p1', 'acc2', 'tr2', 'm3', 4200, '2026-04-05T07:30:00Z', '2026-04-07T10:00:00Z'),
('lead7', 'PCT-20260408-T3U4V', 'Olivia Chen', 'olivia.chen@gmail.com', '+61 412 345 678', 'website', 'completed', 'Sri Lanka', '2026-03-01', 2, 'Completed tour. Left a 5-star review.', 'p2', 'acc4', 'tr4', 'm5', 1380, '2026-02-10T11:00:00Z', '2026-03-06T18:00:00Z'),
('lead8', 'PCT-20260410-W5X6Y', 'Ahmed Al-Rashid', 'ahmed.rashid@gmail.com', '+971 50 123 4567', 'referral', 'new', 'Sri Lanka', '2026-09-10', 2, 'Looking for halal food options. Wants to visit Colombo mosques.', 'p5', 'acc9', 'tr9', 'm12', 460, '2026-04-10T14:20:00Z', '2026-04-10T14:20:00Z'),
('lead9', 'PCT-20260412-Z7A8B', 'Maria Santos', 'maria.santos@hotmail.com', '+55 11 91234 5678', 'facebook', 'cancelled', 'Sri Lanka', '2026-05-20', 2, 'Cancelled due to visa issues. May rebook for later date.', 'p7', 'acc14', 'tr13', 'm16', 1780, '2026-04-12T06:45:00Z', '2026-04-13T08:00:00Z'),
('lead10', 'PCT-20260413-C9D0E', 'David & Anna Kowalski', 'david.kowalski@gmail.com', '+48 501 234 567', 'website', 'new', 'Sri Lanka', '2026-06-20', 2, 'First time in Asia. Want comprehensive cultural experience.', 'p6', 'acc12', 'tr11', 'm15', 5480, '2026-04-13T10:00:00Z', '2026-04-13T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TOURS (scheduled from confirmed/completed leads)
-- ============================================================
INSERT INTO tours (id, package_id, package_name, lead_id, client_name, start_date, end_date, pax, status, total_value, currency, availability_status, created_at, updated_at) VALUES
('tour1', 'p1', 'Ceylon Heritage & Wildlife', 'lead1', 'Emma Thompson', '2026-05-10', '2026-05-17', 2, 'scheduled', 2290, 'USD', 'confirmed', '2026-03-21T10:00:00Z', '2026-03-21T10:00:00Z'),
('tour2', 'p6', 'Extended Heritage Journey', 'lead2', 'Hans Müller', '2026-04-20', '2026-04-29', 4, 'scheduled', 3860, 'USD', 'confirmed', '2026-03-23T09:00:00Z', '2026-03-23T09:00:00Z'),
('tour3', 'p10', 'East Coast Beaches', 'lead5', 'Pierre Dubois', '2026-04-25', '2026-04-29', 3, 'scheduled', 1860, 'USD', 'confirmed', '2026-04-06T12:00:00Z', '2026-04-06T12:00:00Z'),
('tour4', 'p2', 'Beach & Culture Escape', 'lead7', 'Olivia Chen', '2026-03-01', '2026-03-05', 2, 'completed', 1380, 'USD', 'confirmed', '2026-02-15T14:00:00Z', '2026-03-06T18:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INVOICES
-- ============================================================
INSERT INTO invoices (id, lead_id, reference, invoice_number, status, client_name, client_email, client_phone, package_name, travel_date, pax, base_amount, line_items, total_amount, currency, notes, paid_at, created_at, updated_at) VALUES
('inv1', 'lead1', 'PCT-20260315-A1B2C', 'INV-2026-0001', 'paid', 'Emma Thompson', 'emma.thompson@gmail.com', '+44 7700 900123', 'Ceylon Heritage & Wildlife', '2026-05-10', 2, 1890, '[{"description":"Base package (2 pax)","amount":1890},{"description":"HB Meal upgrade (2 pax)","amount":200},{"description":"Private Car & Driver (8 days)","amount":200}]', 2290, 'USD', 'Paid in full via bank transfer.', '2026-03-25T12:00:00Z', '2026-03-21T10:00:00Z', '2026-03-25T12:00:00Z'),
('inv2', 'lead2', 'PCT-20260320-D3E4F', 'INV-2026-0002', 'paid', 'Hans Müller', 'hans.mueller@web.de', '+49 170 1234567', 'Extended Heritage Journey', '2026-04-20', 4, 2490, '[{"description":"Base package (4 pax)","amount":2490},{"description":"HB Meal upgrade (4 pax)","amount":560},{"description":"Premium Van (10 days)","amount":810}]', 3860, 'USD', '50% deposit paid. Balance due 7 days before travel.', '2026-03-28T10:00:00Z', '2026-03-23T09:00:00Z', '2026-03-28T10:00:00Z'),
('inv3', 'lead5', 'PCT-20260401-M9N0P', 'INV-2026-0003', 'sent', 'Pierre Dubois', 'pierre.dubois@free.fr', '+33 6 12 34 56 78', 'East Coast Beaches', '2026-04-25', 3, 620, '[{"description":"Base package (3 pax)","amount":620},{"description":"Private Car & Driver (5 days)","amount":350},{"description":"Accommodation (4 nights)","amount":480},{"description":"BB Meals","amount":0}]', 1860, 'USD', 'Invoice sent, awaiting payment.', NULL, '2026-04-06T12:00:00Z', '2026-04-06T12:00:00Z'),
('inv4', 'lead7', 'PCT-20260408-T3U4V', 'INV-2026-0004', 'paid', 'Olivia Chen', 'olivia.chen@gmail.com', '+61 412 345 678', 'Beach & Culture Escape', '2026-03-01', 2, 690, '[{"description":"Base package (2 pax)","amount":690},{"description":"Private Car & Driver (5 days)","amount":300},{"description":"Accommodation (4 nights)","amount":380},{"description":"BB Meals","amount":0}]', 1380, 'USD', 'Fully paid and completed. Guest tipped guide.', '2026-02-20T16:00:00Z', '2026-02-15T14:00:00Z', '2026-03-06T18:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PAYMENTS
-- ============================================================
INSERT INTO payments (id, type, amount, currency, description, client_name, reference, lead_id, tour_id, invoice_id, supplier_id, status, date, created_at) VALUES
-- Incoming payments from clients
('pay1', 'incoming', 2290, 'USD', 'Full payment — Ceylon Heritage & Wildlife', 'Emma Thompson', 'PCT-20260315-A1B2C', 'lead1', 'tour1', 'inv1', NULL, 'completed', '2026-03-25', NOW()),
('pay2', 'incoming', 1930, 'USD', '50% deposit — Extended Heritage Journey', 'Hans Müller', 'PCT-20260320-D3E4F', 'lead2', 'tour2', 'inv2', NULL, 'completed', '2026-03-28', NOW()),
('pay3', 'incoming', 1380, 'USD', 'Full payment — Beach & Culture Escape', 'Olivia Chen', 'PCT-20260408-T3U4V', 'lead7', 'tour4', 'inv4', NULL, 'completed', '2026-02-20', NOW()),
-- Outgoing payments to suppliers
('pay4', 'outgoing', 840, 'USD', 'Accommodation — Jetwing Lagoon (7 nights)', NULL, 'SUP-2026-001', 'lead1', 'tour1', NULL, 'h1', 'completed', '2026-04-01', NOW()),
('pay5', 'outgoing', 640, 'USD', 'Transport — Lanka Chauffeur Service (8 days)', NULL, 'SUP-2026-002', 'lead1', 'tour1', NULL, 'ht1', 'completed', '2026-04-01', NOW()),
('pay6', 'outgoing', 1080, 'USD', 'Accommodation — Jetwing Lagoon (9 nights)', NULL, 'SUP-2026-003', 'lead2', 'tour2', NULL, 'h1', 'pending', '2026-04-15', NOW()),
('pay7', 'outgoing', 1200, 'USD', 'Transport — Comfort Van Hire (10 days)', NULL, 'SUP-2026-004', 'lead2', 'tour2', NULL, 'ht2', 'pending', '2026-04-15', NOW()),
('pay8', 'outgoing', 380, 'USD', 'Accommodation — Fort Bazaar (4 nights)', NULL, 'SUP-2026-005', 'lead7', 'tour4', NULL, 'h3', 'completed', '2026-02-25', NOW()),
('pay9', 'outgoing', 300, 'USD', 'Transport — Lanka Chauffeur Service (5 days)', NULL, 'SUP-2026-006', 'lead7', 'tour4', NULL, 'ht1', 'completed', '2026-02-25', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PAYROLL RUNS
-- ============================================================
INSERT INTO payroll_runs (id, period_start, period_end, pay_date, status, items, total_gross, total_deductions, total_net, currency, paid_at, created_at) VALUES
('pr1', '2026-03-01', '2026-03-31', '2026-04-05', 'paid', '[
  {"employeeId":"emp1","employeeName":"Nimal Perera","role":"Operations Manager","grossPay":3200,"deductions":534,"netPay":2666},
  {"employeeId":"emp2","employeeName":"Sanduni Fernando","role":"Sales Agent","grossPay":1800,"deductions":296,"netPay":1504},
  {"employeeId":"emp3","employeeName":"Kasun Silva","role":"Tour Guide","grossPay":420,"deductions":33.6,"netPay":386.4},
  {"employeeId":"emp4","employeeName":"Anjali Dias","role":"Accountant","grossPay":2400,"deductions":408,"netPay":1992},
  {"employeeId":"emp5","employeeName":"Ruwan Jayawardena","role":"Driver","grossPay":1280,"deductions":76.8,"netPay":1203.2}
]', 9100, 1348.4, 7751.6, 'USD', '2026-04-05T10:00:00Z', '2026-04-01T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
INSERT INTO audit_logs (id, entity_type, entity_id, action, summary, actor, details, metadata, created_at) VALUES
('aud1', 'lead', 'lead1', 'status_change', 'Lead status changed from new to confirmed', 'admin', '[{"field":"status","from":"new","to":"confirmed"}]', '{}', '2026-03-20T14:00:00Z'),
('aud2', 'lead', 'lead2', 'status_change', 'Lead status changed from new to confirmed', 'admin', '[{"field":"status","from":"new","to":"confirmed"}]', '{}', '2026-03-22T09:00:00Z'),
('aud3', 'tour', 'tour1', 'created', 'Tour scheduled for Emma Thompson — Ceylon Heritage & Wildlife', 'admin', '[]', '{}', '2026-03-21T10:00:00Z'),
('aud4', 'tour', 'tour2', 'created', 'Tour scheduled for Hans Müller — Extended Heritage Journey', 'admin', '[]', '{}', '2026-03-23T09:00:00Z'),
('aud5', 'invoice', 'inv1', 'created', 'Invoice INV-2026-0001 created for Emma Thompson', 'admin', '[]', '{}', '2026-03-21T10:30:00Z'),
('aud6', 'payment', 'pay1', 'created', 'Payment of $2,290 received from Emma Thompson', 'admin', '[]', '{}', '2026-03-25T12:00:00Z'),
('aud7', 'lead', 'lead7', 'status_change', 'Lead status changed from confirmed to completed', 'admin', '[{"field":"status","from":"confirmed","to":"completed"}]', '{}', '2026-03-06T18:00:00Z'),
('aud8', 'lead', 'lead9', 'status_change', 'Lead status changed from new to cancelled', 'admin', '[{"field":"status","from":"new","to":"cancelled"}]', '{}', '2026-04-13T08:00:00Z'),
('aud9', 'employee', 'emp1', 'created', 'Employee Nimal Perera added as Operations Manager', 'admin', '[]', '{}', '2025-06-01T08:00:00Z'),
('aud10', 'payroll', 'pr1', 'created', 'March 2026 payroll run processed — $7,751.60 net', 'admin', '[]', '{}', '2026-04-01T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TODOS
-- ============================================================
INSERT INTO todos (id, title, completed, created_at) VALUES
('todo1', 'Follow up with Liu Wei on conference room requirements', false, '2026-04-07T10:00:00Z'),
('todo2', 'Send Pierre Dubois payment reminder for INV-2026-0003', false, '2026-04-10T09:00:00Z'),
('todo3', 'Prepare honeymoon surprise cake order for Emma Thompson tour', false, '2026-04-08T11:00:00Z'),
('todo4', 'Arrange halal restaurant list for Ahmed Al-Rashid', false, '2026-04-11T14:00:00Z'),
('todo5', 'Collect remaining 50% balance from Hans Müller before Apr 13', false, '2026-04-01T08:00:00Z'),
('todo6', 'Contact Maria Santos about rebooking after visa resolved', false, '2026-04-13T09:00:00Z'),
('todo7', 'Request Olivia Chen 5-star review for TripAdvisor', true, '2026-03-07T10:00:00Z'),
('todo8', 'Update Yuki Tanaka with photography workshop options', false, '2026-03-26T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- APP SETTINGS
-- ============================================================
INSERT INTO app_settings (id, company, portal, ai, updated_at) VALUES
('main', '{
  "name": "Paraíso Ceylon Tours",
  "tagline": "Your Gateway to Sri Lanka",
  "email": "hello@paraisotours.lk",
  "phone": "+94 77 100 2000",
  "address": "42 Galle Road, Colombo 03, Sri Lanka",
  "website": "https://paraiso-tours.vercel.app",
  "currency": "USD",
  "timezone": "Asia/Colombo",
  "logo": ""
}', '{
  "heroTitle": "Discover Sri Lanka with Paraíso",
  "heroSubtitle": "Curated tours, authentic experiences, unforgettable memories",
  "primaryColor": "#0d9488",
  "accentColor": "#b45309"
}', '{
  "provider": "none",
  "model": ""
}', NOW())
ON CONFLICT (id) DO UPDATE SET company = EXCLUDED.company, portal = EXCLUDED.portal, ai = EXCLUDED.ai, updated_at = NOW();

-- ============================================================
-- AI KNOWLEDGE BASE (sample docs)
-- ============================================================
INSERT INTO ai_knowledge_documents (id, title, content, source_type, tags, active, created_at, updated_at) VALUES
('aikb1', 'Visa Requirements for Sri Lanka', 'Most nationalities can obtain an Electronic Travel Authorization (ETA) online at eta.gov.lk. Cost is $50 USD for tourism. Valid for 30 days, extendable to 90 days. UK, EU, Japan, Australia — ETA required. Indian nationals get visa on arrival. Always advise clients to check 6 months before travel.', 'manual', '["visa","travel-info","faq"]', true, NOW(), NOW()),
('aikb2', 'Best Time to Visit Sri Lanka', 'Southwest coast & hill country: December to March (dry season). East coast: April to September. Cultural Triangle: year-round, best Jan–Apr. Whale watching in Mirissa: November to April. Yala safari: February to July (dry = animals near water holes). Avoid booking east coast Nov–Feb (monsoon).', 'manual', '["weather","seasons","planning"]', true, NOW(), NOW()),
('aikb3', 'Cancellation & Refund Policy', 'Free cancellation up to 14 days before tour start — full refund. 7–14 days: 50% refund. Under 7 days: no refund, but credit note valid 12 months. Force majeure (natural disaster, pandemic): full credit note or reschedule at no charge. All refunds processed within 10 business days.', 'manual', '["policy","cancellation","refund"]', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

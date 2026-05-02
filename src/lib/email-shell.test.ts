import test from "node:test";
import assert from "node:assert/strict";
import { buildBrandedEmail } from "./email";

const branding = {
  companyName: "Paraíso Ceylon Tours",
  tagline: "Sri Lanka travel shaped by people who live it",
  email: "hello@example.com",
  address: "Colombo, Sri Lanka",
  phone: "+94 11 234 5678",
  logoUrl: "",
};

test("buildBrandedEmail: renders header with company name and tagline", () => {
  const html = buildBrandedEmail(
    { title: "Hello" },
    branding
  );
  assert.match(html, /Paraíso Ceylon Tours/);
  assert.match(html, /Sri Lanka travel shaped/);
});

test("buildBrandedEmail: includes viewport + doctype + preheader", () => {
  const html = buildBrandedEmail(
    { title: "T", preheader: "Secret preview text" },
    branding
  );
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /viewport/);
  assert.match(html, /Secret preview text/);
  // Preheader must be hidden
  assert.match(html, /display:none/);
});

test("buildBrandedEmail: uses Paraiso palette (navy header + cream body)", () => {
  const html = buildBrandedEmail({ title: "T" }, branding);
  assert.match(html, /#12343b/); // navy header band
  assert.match(html, /#fdf7ea/); // cream page background
  assert.match(html, /#c9922f/); // gold accent
});

test("buildBrandedEmail: does NOT use old teal palette", () => {
  const html = buildBrandedEmail(
    {
      title: "T",
      intro: "Welcome",
      sections: [{ variant: "card", body: "<p>x</p>" }],
    },
    branding
  );
  assert.doesNotMatch(html, /#0d9488/);
  assert.doesNotMatch(html, /teal/i);
});

test("buildBrandedEmail: renders rows with labels + values", () => {
  const html = buildBrandedEmail(
    {
      title: "T",
      sections: [
        {
          label: "Details",
          variant: "card",
          rows: [
            { label: "Reference", value: "REF-001", emphasis: true },
            { label: "Amount", value: "1,000 USD" },
          ],
        },
      ],
    },
    branding
  );
  assert.match(html, /Reference/);
  assert.match(html, /REF-001/);
  assert.match(html, /1,000 USD/);
});

test("buildBrandedEmail: renders primary + secondary CTAs with correct styling", () => {
  const html = buildBrandedEmail(
    {
      title: "T",
      primaryCta: { label: "View booking", href: "https://example.com/b/1" },
      secondaryCta: { label: "All bookings", href: "https://example.com/b" },
    },
    branding
  );
  assert.match(html, /View booking/);
  assert.match(html, /All bookings/);
  assert.match(html, /href="https:\/\/example\.com\/b\/1"/);
  // Primary should be navy-filled
  assert.match(html, /background:#12343b/);
});

test("buildBrandedEmail: callout-warn uses red accent", () => {
  const html = buildBrandedEmail(
    {
      title: "T",
      sections: [{ variant: "callout-warn", body: "<p>cancel</p>" }],
    },
    branding
  );
  assert.match(html, /#c9502f/);
});

test("buildBrandedEmail: footer contains contact email and company name", () => {
  const html = buildBrandedEmail({ title: "T" }, branding);
  assert.match(html, /hello@example\.com/);
  assert.match(html, /Questions\? Reply/);
});

test("buildBrandedEmail: escapes user-provided title", () => {
  const html = buildBrandedEmail(
    { title: "<script>alert(1)</script>" },
    branding
  );
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

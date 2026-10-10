# Roadmap

## Done
- Billing page redesign to match the reference screenshot (single flat statement layout)
- Merge into ONE page: /usage is the only billing page; /settings/billing + /billing redirect to it; duplicate page deleted

## Open
- Make every button on the billing page do something real (no "coming soon" toasts):
  - "View bill" + each past-statement row open a real statement/bill detail (plan, amount, period, status, credits)
  - "Auto pay" row: real cancel-subscription flow (already wired to kashier-checkout) — keep
  - Back / Help rows go to real existing routes (verify /support exists)
- Clean glass design pass on the billing page: translucent surfaces, thin borders, soft shadows, tidy spacing
- Verify visually with a temporary signed-in render, then remove the temp route

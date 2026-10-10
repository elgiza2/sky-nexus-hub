# Roadmap

## Done
- Billing page redesign to match the reference screenshot
- ONE billing page: /usage is the only one; /settings/billing + /billing redirect to it; duplicate deleted
- Every button on the billing page works for real (bill sheet, statement rows, auto-pay cancel, help, back) + glass styling
- Shared glass primitives built (src/styles/settings-glass.css + SubShell.tsx + ProfileGlassShell.tsx)
- Main settings home (mobile + desktop) restored to its original design and icons — do not restyle it again

## Open
- Redesign every settings sub-page with the shared glass design (same sheet/slide opening animation, clean icons)
  - EXCLUDED: the main settings home page (keep exactly as-is) and the Integrations page
  - In progress: memory, composer/customization, language (subagent finished — verify)
  - In progress: security, privacy, help, support, contact (subagent running)
  - In progress: skills, passwords, desktop bridge, cloud browser, data category (subagent running)
  - Still to do: profile edit, AI personalization, data controls, notifications, referrals, delete account, system status, capabilities, image models, mail
- Verify each converted page visually, then report

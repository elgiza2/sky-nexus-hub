# Roadmap

## Done
- Billing page redesign to match the reference screenshot
- ONE billing page: /usage is the only one; /settings/billing + /billing redirect to it; duplicate deleted
- Every button on the billing page works for real (bill sheet, statement rows, auto-pay cancel, help, back) + glass styling
- Shared glass primitives built (src/styles/settings-glass.css + SubShell.tsx + ProfileGlassShell.tsx)
- Main settings home (mobile + desktop) restored to its original design and icons — do not restyle it again
- Settings sub-pages converted to the glass design: memory, composer, language, security, privacy, help, support, contact, passwords, skills (list/new/library), cloud browser, data category, desktop bridge
- Agents page (/agents) redesigned: glass rows, one distinct icon per agent (chosen from its name/description/prompt, deterministic fallback), colour-tinted tiles, loading spinner instead of the animated orb — the orb stays only inside the conversation
- All temporary /glass-check-* preview routes removed from AppRoutes.tsx

## Open
- Restyle the remaining settings pages with the same glass design: profile edit, AI personalization, data controls, notifications, referrals, delete account, system status, capabilities, image models, mail
- EXCLUDED from any restyle: the main settings home page (keep exactly as-is) and the Integrations page

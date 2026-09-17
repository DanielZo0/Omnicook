# Google Ad Manager setup (to finish later)

The ad code is already merged (`src/lib/ads/`, `src/components/ads/`) and fully wired into
`src/app/page.tsx` — a tab-bar banner, a recipe-detail banner, and an interstitial every N
navigations. Everything currently no-ops (no ad script loads, nothing renders) because no
`NEXT_PUBLIC_GAM_*` env vars are set anywhere. This doc tracks what's left to actually turn ads on.

## 1. Google Ad Manager account

- [ ] Get (or confirm) a GAM account. For a small/new publisher this is **Google Ad Manager for
      small publishers**, which requires an approved **AdSense** account underneath it — start
      there if you don't already have AdSense approved for this site. GAM 360 (enterprise) is
      invite/sales-only, not needed here.
- [ ] Find the **network code** (Admin → Global settings, or visible in the GAM URL once logged
      in) — a number like `123456789`.

## 2. Create ad units

In GAM: **Inventory → Ad units → New ad unit**. Create three, matching the placements already
built into the app:

| Placement | Where it shows | Sizes to configure | Suggested ad unit code |
|---|---|---|---|
| Tab-bar banner | Above the bottom nav on vault/planner/grocery/profile | 320×50 | `omnicook_banner_tabbar` |
| Recipe detail banner | On the recipe detail screen, below the source link | 320×50 | `omnicook_banner_detail` |
| Interstitial | Full-screen overlay every N in-app navigations | 300×250, 320×480 | `omnicook_interstitial` |

The **ad unit code** (short name, not the full path) is what goes into the env vars below — the
app builds the full path itself as `/{networkCode}/{unit}`.

- [ ] Create the three ad units above and note their codes.
- [ ] Set up **line items** (or link AdSense/Ad Exchange for programmatic fill) so the units
      actually have inventory to serve — an ad unit with no line items just returns empty.

## 3. Set env vars and redeploy

Add to the production environment (e.g. Vercel project settings → Environment Variables) and
redeploy:

```
NEXT_PUBLIC_GAM_NETWORK_CODE=<network code from step 1>
NEXT_PUBLIC_GAM_BANNER_TABBAR_UNIT=omnicook_banner_tabbar
NEXT_PUBLIC_GAM_BANNER_DETAIL_UNIT=omnicook_banner_detail
NEXT_PUBLIC_GAM_INTERSTITIAL_UNIT=omnicook_interstitial
NEXT_PUBLIC_GAM_INTERSTITIAL_EVERY_N=6
```

(`.env.example` documents the same vars.)

## 4. Consent management (EU/UK traffic) — separate follow-up

If the app serves real ads to users in the EU/UK, GAM requires a Google-certified **CMP** wired
in via the **IAB TCF**, or Google will restrict/limit fill in those regions. Not built yet —
revisit once there's a real GAM account and a decision on target regions. Options to evaluate:

- [ ] Google's own **Funding Choices / Privacy & messaging** (simplest, built for GAM/AdSense)
- [ ] A third-party CMP (OneTrust, Cookiebot, etc.) with an IAB TCF integration

Whichever is picked, it needs to load and get user consent *before* `loadGpt()` fires in
`src/lib/ads/gpt.ts`, and the consent signal needs to reach GPT (most CMPs do this automatically
via the TCF API once installed).

## 5. Nice-to-haves not built (optional, lower priority)

- Ad-free experience for paying/premium users — no subscription concept exists in the app today,
  would need to be built first, then `isAdsEnabled()` in `src/lib/ads/gpt.ts` gated on it.
- Non-personalized-ads flag for users who decline consent but the site still wants limited fill.

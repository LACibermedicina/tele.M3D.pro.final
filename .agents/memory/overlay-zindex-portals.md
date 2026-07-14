---
name: Full-screen overlays vs Radix portals
description: App layers full-screen fixed overlays up to z-[10002]; default z-50 Radix portal content (dropdown/select/popover/dialog) opens BEHIND them and looks broken.
---

Rule: any Radix portal content (DropdownMenu, Select, Popover, Tooltip, Dialog) that can be triggered from inside one of the app's full-screen overlay surfaces must carry a z-index above the overlay stack. LanguageSelector's dropdown now defaults to `z-[10050]`.

**Why:** The app renders whole experiences as `fixed inset-0` overlays with high z-indexes (immersive landing z-[60], immersive layers z-[9999], assisted shell z-[10000..10002]). Radix portals mount at `document.body` with shadcn's default `z-50`, so the menu paints behind the overlay — items invisible/unclickable. This bit twice: assisted-layout language menu (fixed with z-[10002] override) and the landing page language menu (users "couldn't change language").

**How to apply:** When adding portal-based UI reachable from landing/immersive/assisted/mode-selection (or any new full-screen overlay), pass a content className with z above the overlay (z-[10050] is the current safe ceiling; desktop window zCounter starts at 100 and increments by 1, never close). Check with `grep -o 'z-\[[0-9]*\]'` for the current max before picking a value.

**Second variant — trigger interception:** an absolutely-positioned button placed BEFORE a later full-viewport positioned sibling with the same z-index gets covered by that (transparent) sibling — DOM order wins on z ties, so clicks never reach the button and it silently "does nothing". Bit us on the immersive landing (selector wrapper z-10 vs full-screen content `relative z-10` after it; fixed by raising the wrapper to z-20). When a corner-positioned control "doesn't respond", check `document.elementFromPoint()` thinking before blaming the handler.

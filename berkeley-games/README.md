# Elections Have Consequences: Berkeley Edition

An anthology of short, satirical Berkeley civic games. Each one takes a real
political decision or governing behaviour and lets you play through the
consequence.

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## Games

### BUDGET QUEST
*If you’re wondering who the ATM is, you’re the ATM.*

Balance Berkeley’s budget. Each fiscal year you assemble one package in the
**City Budget Garage** and cannot leave until the **BUDGET GAP** reaches zero.
Then the door opens and you drive through the city your budget created.
Common Sense Mode gives you all seven fiscal tools; City Council Mode leaves
three and a red **SLASH SERVICES** button.

### HOW BERKELEY CAN YOU BE?
A Special Meeting, opening against a standing $8.7M gap. `PANDER` until
`CREDIBILITY EXHUASTED!`, `MEGA PANDER` a new recurring program with no funding
identified, fast-track it on consent, `EXTEND MEETING TO MIDNIGHT!`. It ends
with a typed tally, then the gap before and after side by side failing to move,
then **`$0 CLOSED`**.

### HOPKINS
One council decision, lived three ways. A cold open where an earnest banner
burns and the vote reverses ninety seconds later, a 1950s-television vision of
*The Hopkins of Tomorrow*, then crossing the street, answering an emergency
call, and taking out the trash.

### GET TO SACRAMENTO OR DIE TRYIN’
Five constituencies, two buttons, twenty-eight days. Approval decays if you
ignore anyone, and repeating either lever stops working — you have to
alternate. You need a majority of all available approval points, however
unevenly distributed.

## Sourcing

Factual claims live in content files with their state and citation. The Hopkins
7–2 vote and the Fire Chief testimony are verified against the Berkeley Council
record and cited in `js/episodes/hopkins/content.js`. Claims marked
`verified: false` render as unattributed paraphrase rather than as quotations,
and no unverified wording is attributed to a named person.

The cold open is a partial case and says so in code: its quotations are
verified line by line against the 2026-07-28 caption file, but the **speaker
attributions are not**, because that file labels almost every line
`Boardroom:`. `COLD_OPEN` carries `attributionVerified: false`, and the names
must be confirmed against the meeting video before public release. See
`docs/SOURCING-BEFORE-RELEASE.md`, which is not yet closed.

Everything else — budget figures, constituency
labels, program names — is configurable game content and is never presented as
a sourced fact.

## Layout

```
index.html                  anthology mission select
v1.html                     the original Berkeley Budget Driver, kept for reference
styles-v2.css               shared visual identity across every game
js/shared/                  shell: routing, anthology content
js/episodes/
  budget-quest/             the fiscal game
  how-berkeley/             the Special Meeting, standalone
  hopkins/                  council cold open and three arcade consequences
  sacramento/               coalition management
js/v2/                      Budget Quest internals: state, garage, tour, meeting
js/                         shared engine: audio, rng, meeting logic, renderers
```

Episodes are independent: nothing unlocks anything, and no progress is required
to play any of them. Optional completion markers are stored in `localStorage`
and never leave the browser.

## Privacy

Entirely client-side. No backend, no account, no analytics, no cookies, no
network requests beyond the page’s own origin. Verified in Chromium, Firefox
and WebKit.

## Running and testing

```
python3 -m http.server 8611     # then open http://localhost:8611/
test/run.sh                     # six Playwright suites
```

`HANDOFF.md` has the working notes: deploy steps, the design rules that are
load-bearing, and the traps that have bitten before.

## Specs

`docs/` holds the canonical specifications: the anthology front matter, the
reboot spec that Budget Quest implements, and the Hopkins and Sacramento
game specs. `docs/v1.0/` archives the original spec and its eleven addenda
as design history — they describe superseded mechanics and should not be used
to restore them.

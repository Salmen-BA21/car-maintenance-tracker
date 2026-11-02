# PRD · Appendix A: default parts catalog

> Part of [02-prd.md](../02-prd.md). Sections: A. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## Appendix A. Default parts catalog (approved, D-09)

Intervals are editable starting points. Distance in km, time in months. "Profile rule" decides whether the part is shown by default.

| Category | Part | Profile rule | Type | Default interval |
|---|---|---|---|---|
| Engine | Engine oil and oil filter | All | Distance + time | 10,000 km / 12 months |
| Engine | Spark plugs | Petrol | Distance | 30,000 km |
| Engine | Timing belt | Cars with a belt | Distance + time | None, owner enters it (BR-12) |
| Engine | Drive/serpentine belt | All | Condition-based | Inspect |
| Filters | Air filter | All | Distance | 15,000 km |
| Filters | Cabin filter | All | Distance + time | 20,000 km / 12 months |
| Fuel | Fuel filter | Diesel (petrol can add it) | Distance | 30,000 km |
| Fuel | Glow plugs | Diesel | Distance | 120,000 km |
| Brakes | Brake fluid | All | Time | 24 months |
| Brakes | Brake pads and discs | All | Condition-based | Inspect |
| Fluids | Coolant | All | Distance + time | 100,000 km / 60 months |
| Fluids | Transmission or gearbox oil | All | Distance | Owner enters it from the manual |
| Tires | Rotation | All | Distance | 10,000 km |
| Tires | Replacement and alignment | All | Condition-based | Inspect |
| Electrical | Battery | All | Time | 48 months |
| Visibility | Wiper blades | All | Time | 12 months |
| Emissions | DPF | Diesel with DPF | Condition-based | Inspect |

Notes:
- Engine oil and oil filter are tracked as separate parts that share the same default interval (matching the owner's original example). The table lists them on one line only for brevity.
- Defaults are a proposal derived from public maintenance guidance, and the car's manual always takes priority (BR-14). Gearbox oil and timing belt have no number on purpose.
- The profile records the gearbox type, but no default part depends on it yet (D-09).

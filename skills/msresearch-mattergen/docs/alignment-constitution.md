# Responsible AI Considerations

> Adapted from the [MatterGen MODEL_CARD.md](https://github.com/microsoft/mattergen/blob/main/MODEL_CARD.md).

## Intended Use

- Generate inorganic crystal candidates, with or without property conditioning
- Fine-tune the base model on property-labeled materials data
- Use generated candidates as starting points for downstream MatterSim triage, DFT validation, and lab synthesis

## Out-of-Scope Use

- Crystals with more than 20 atoms per unit cell (training data limit)
- Organic crystals or non-crystalline materials
- Crystals containing noble gases, radioactive elements, Tc, Pm, or atomic number > 84 (these elements were removed from the training data)

## Risks and Limitations

- Generated structures are candidates, not validated materials. DFT or experimental confirmation is required before any operational decision or lab handoff.
- Property-conditioning quality depends on labeled training data. Extreme target values with sparse training coverage degrade performance.
- The fraction of generated structures actually on or below the convex hull is lower than the training-distribution fraction within 0.1 eV/atom of the hull.

## Research Use Only

The model, datasets, and this skill are provided for research and development use only. They are not intended for clinical, safety-critical, or regulated deployment without independent validation. You bear sole responsibility for any use of these models, data, and software, including incorporation into any product.

## Further Reading

- [MatterGen MODEL_CARD.md](https://github.com/microsoft/mattergen/blob/main/MODEL_CARD.md)
- [Microsoft Responsible AI principles and approach](https://www.microsoft.com/en-us/ai/principles-and-approach)
- [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/)

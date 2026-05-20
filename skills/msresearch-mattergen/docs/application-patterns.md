# Application Patterns

Six high-impact workflows drawn from the MatterGen paper and supporting collateral.

> **Launch pattern** — every scenario below maps to a `mattergen-generate` call:
>
> ```bash
> mattergen-generate "$RESULTS_PATH" \
>   --pretrained-name <checkpoint> \
>   --batch_size 16 \
>   --properties_to_condition_on="<JSON prompt>" \
>   --diffusion_guidance_factor 2.0
> ```
>
> See [quick-start.md](./quick-start.md) for setup; substitute the checkpoint and prompt from each scenario below.

## 1. Superhard material discovery

- **Goal:** Identify crystals with bulk modulus >400 GPa for cutting tools and protective coatings.
- **Prompt:** `{'bulk_modulus': '>=400'}` with `ml_bulk_modulus` checkpoint.
- **Workflow:**
  1. Generate 5k samples (batch 64 × 80 iterations) and filter to stability ≤0.1 eV/atom.
  2. Rank by predicted bulk modulus and novelty score.
  3. Send top 200 to MatterSim relaxation, then queue DFT for the top 50.
  4. Record lab candidates with synthesis metadata.
- **Metrics:** Count of hits above 400 GPa, % stable, DFT-confirmed vs. predicted.

## 2. Magnetic/spintronic materials

- **Goal:** Produce high magnetic density (>0.2 Å⁻³) candidates for spintronics.
- **Prompt:** `{'dft_mag_density': 0.2}` with `dft_mag_density` checkpoint.
- **Workflow:**
  1. Generate 3k structures (see quick-start for guidance-factor tuning).
  2. Apply element filters (e.g., 3d transition metals) to enforce fabrication constraints.
  3. Evaluate magnetization, stability, uniqueness via MatterSim metrics.
  4. Export top 30 to DFT/experimental validation.
- **Metrics:** Magnetization adherence, novelty %, coherence with spintronic fabrication guidelines.

## 3. Band-gap & symmetry steering

- **Goal:** Tailor optoelectronic compounds with specific band gap (e.g., 1.8–2.2 eV) and space group.
- **Prompt:** `{'dft_band_gap': 2.0, 'space_group': 'P6_3/mmc'}` using joint adapter.
- **Workflow:**
  1. Generate 2k samples across a grid of band gap targets.
  2. Cluster by predicted band gap and space group to identify promising families.
  3. Run MatterSim evaluation, export CIFs to your device-simulation pipeline.
  4. Feed validated structures into supply-chain feasibility review.
- **Metrics:** % within ±0.1 eV of target, structural symmetry compliance, novelty vs. MP-20.

## 4. Supply-chain risk mitigation

- **Goal:** Suggest alternates with diversified critical elements using HHI (Herfindahl–Hirschman Index) adapter.
- **Prompt:** `{'dft_mag_density_hhi_score': {'hhi': '<2000', 'mag_density': 0.15}}`.
- **Workflow:**
  1. Run targeted generations for each at-risk material.
  2. Score outputs by HHI, stability, and property alignment.
  3. Join with corporate procurement data to verify material availability.
  4. Present short list to sourcing team with property and risk deltas.
- **Metrics:** HHI reduction vs. baseline, property satisfaction rate, supplier coverage.

## 5. Rapid lab validation loop

- **Goal:** Close the loop from AI proposals to lab synthesis (e.g., TaCr₂O₆ case study).
- **Workflow:**
  1. Generate property-steered candidates (superhard, magnetic, etc.).
  2. MatterSim-relax and compute metrics.
  3. Run targeted DFT on top hits and push to ELN.
  4. Track synthesis attempts, measurements (XRD, nanoindentation), and feed back into dataset for retraining.
- **Metrics:** Turnaround time from generation → synthesis, success rate of AI-recommended candidates, delta between MatterSim and DFT energies.

## 6. Hosted inference for low-friction prototyping

- **Goal:** Allow product teams to sample materials without provisioning GPUs.
- **Workflow:**
  1. Deploy Azure AI Foundry endpoint (MatterGen/version/1).
  2. Build lightweight web form or Power Automate flow to capture prompts and dispatch REST calls.
  3. Store artifacts in Blob Storage; trigger Logic Apps to run MatterSim evaluation using Azure Container Instances.
  4. Route results to scientists via Teams/SharePoint along with metrics summary.
- **Use the prototype:** see [prototype.md](./prototype.md) for setup — it's the recommended way to demo this scenario to product teams (web UI, structure viewer, MatterSim metrics).
- **Metrics:** Latency per request, endpoint costs vs. GPU cluster, number of candidate batches evaluated per week.

## Cross-cutting considerations

- **Adapter maintenance:** Document which dataset snapshot and property stats each adapter uses.
- **DFT prioritization:** Use novelty and stability thresholds to cap expensive simulations.
- **Compliance:** Ensure dataset licensing (MP-20, Alexandria) is honored when exporting workflows to partners.
- **Visualization:** Evaluate using notebooks (benchmark plots) or standard materials viewers (VESTA, OVITO, pymatgen).
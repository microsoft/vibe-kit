# Data Integration & Adapters

This guide shows how to acquire training/evaluation data, preprocess it for MatterGen, and build property adapters for custom prompts.

## 1. Core datasets

| Dataset | Source | Size | Purpose |
| --- | --- | --- | --- |
| `mp-20` | Git LFS `data-release/mp-20/mp_20.zip` | ~1.2 GB | Baseline training & adapter tuning |
| `alex-mp-20` | Git LFS `data-release/alex-mp/alex_mp_20.zip` | ~6 GB | Expanded corpus (MP-20 + Alexandria) |
| Reference LMDB | `data-release/alex-mp/reference_MP2020correction.gz` | ~3.5 GB | MatterSim evaluation metrics |

Download via Git LFS:

```bash
git lfs pull -I "data-release/mp-20/mp_20.zip" --exclude=""
git lfs pull -I "data-release/alex-mp/alex_mp_20.zip" --exclude=""
git lfs pull -I "data-release/alex-mp/reference_MP2020correction.gz" --exclude=""
```

Unzip into a working directory (e.g., `datasets/`).

## 2. Preprocess CSV datasets

Convert CSV exports into LMDB caches optimized for training/fine-tuning.

```bash
mkdir -p datasets/cache

# MP-20
unzip data-release/mp-20/mp_20.zip -d datasets/
csv-to-dataset \
  --csv-folder datasets/mp_20/ \
  --dataset-name mp_20 \
  --cache-folder datasets/cache

# Alexandria + MP-20
unzip data-release/alex-mp/alex_mp_20.zip -d datasets/
csv-to-dataset \
  --csv-folder datasets/alex_mp_20/ \
  --dataset-name alex_mp_20 \
  --cache-folder datasets/cache
```

Caches appear under `datasets/cache/<dataset_name>` and feed directly into training or adapter workflows.

## 3. Building property adapters

MatterGen ships adapter configs for bulk modulus, magnetic density, band gap, and supply-chain HHI. To create a new property:

1. Add your property name to `mattergen/common/utils/globals.py` → `PROPERTY_SOURCE_IDS`.
2. Add a column with that property to the relevant CSV files and regenerate the dataset via `csv-to-dataset` (step above).
3. Create a config under `mattergen/conf/lightning_module/diffusion_module/model/property_embeddings/<property>.yaml` (copy an existing float example and adjust bounds).
4. Fine-tune with:

```bash
export PROPERTY=my_custom_property
mattergen-finetune \
  adapter.pretrained_name=mattergen_base \
  data_module=alex_mp_20 \
  data_module.properties=["$PROPERTY"] \
  +lightning_module/diffusion_module/model/property_embeddings@adapter.adapter.property_embeddings_adapt.$PROPERTY=$PROPERTY \
  ~trainer.logger
```

5. Store the resulting adapter checkpoint and document it for collaborators.

## 4. Custom chemical constraints

To enforce elemental systems or stoichiometry (e.g., Li-O only), use the `chemical_system` adapter:

```bash
mattergen-generate results/ \
  --pretrained-name chemical_system_energy_above_hull \
  --properties_to_condition_on="{'chemical_system': 'Li-O', 'energy_above_hull': 0.05}"
```

For formula-level CSP generation, train with `--config-name=csp` and sample via `--target_compositions` overrides (see the [upstream MatterGen repo README](https://github.com/microsoft/mattergen)'s "Train MatterGen" section).

## 5. Integrating external property estimators

When property labels are scarce:

- Use surrogate models (e.g., pretrained regressors) to score existing structures, then append predicted values to the CSV before `csv-to-dataset`.
- Track provenance for compliance and mark generated adapters as "ML-predicted" in documentation.

## 6. Hosted endpoint data flow

For Azure AI Foundry deployments:

1. Store prompt payloads (JSON) and returned structure archives in Azure Blob Storage.
2. Automate post-processing (MatterSim evaluation, novelty triage) with Azure Functions or Logic Apps.
3. Sync curated hits back into your lab ELN/PLM systems via custom connectors.

## 7. Evaluation datasets

- `mattergen-evaluate` supports custom structure lists (`.cif`, `.extxyz`, `.zip`). Provide `--energies_path` if you have DFT energies instead of using MatterSim.
- Serialize custom reference datasets with:

```python
from mattergen.evaluation.reference.reference_dataset import ReferenceDataset
from mattergen.evaluation.reference.reference_dataset_serializer import LMDBGZSerializer

ref = ReferenceDataset.from_entries(name="my_reference", entries=entries)
LMDBGZSerializer().serialize(ref, "my_reference.gz")
```

Ensure energy corrections match `MaterialsProject2020Compatibility` for consistent metrics.
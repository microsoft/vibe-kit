# Responsible AI Considerations

> Adapted from the [Dayhoff README](https://github.com/microsoft/dayhoff#responsible-ai-considerations).

## Intended Use

Generate high-quality, realistic protein sequences or sets of homologous protein sequences. Generations can be designed from scratch or conditioned on partial sequences in both N→C and C→N directions.

## Out-of-Scope Use Cases

This model should **not** be used to generate anything that is not a protein sequence or a set of homologous protein sequences. It is not meant for natural language or other biological sequences, such as DNA sequences.

## Risks and Limitations

- Not all sequences are guaranteed to be realistic.
- It remains difficult to generate high-quality sequences with no sequence homology to any natural sequence.

## Research Use Only

The code and datasets are provided for **research and development use only**. They are not intended for use in clinical decision-making or for any other clinical use, and the performance of these models for clinical use has not been established.

You bear sole responsibility for any use of these models, data, and software, including incorporation into any product.

## Further Reading

- [Dayhoff Preprint](https://aka.ms/dayhoff/preprint)
- [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/)

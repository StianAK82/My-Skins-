# Controlled AI pipeline

Current requests pass the centralized SafetyGateway, structured provider contract, normalization, multilingual faithfulness scoring, and bounded targeted correction. The canonical pipeline target is: safety and language/intent parsing → structured plan → UniversalOutfitSpec validation → faithfulness → AssetRouter → compatibility → preview/export validation → quality scoring → bounded repair. Raw provider responses and revision instructions must not become logs or canonical history.

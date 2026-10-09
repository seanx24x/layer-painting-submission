# Asset provenance

## Pauldron reference

The supplied model was named ` Pauldron 1.stl`. Its creator, original listing and publication or redistribution terms have not been recorded. No ownership or licence claim is made for this model.

The original STL is excluded from the repository and deployment. The compressed inspection buffer under [public/models/pauldron](../public/models/pauldron) preserves the original geometry, so excluding the STL does not establish permission to redistribute the derived buffer.

The [public manifest](../public/models/pauldron/manifest.json) records the source and payload SHA256 values, 85,424 retained triangles, zero position mismatches, seven surface regions and unspecified coordinate units. Two collapsed source triangles remain in the geometry; their invalid normals are corrected only for display. The [exporter](../scripts/models/export-pauldron-viewer.mjs) and [viewer tests](../src/lib/pauldron-viewer.test.ts) document the buffer format and integrity checks. Tests comparing directly with the original STL require that separately supplied file.

[Guide colour assignments](../src/lib/guide-pauldron.ts) adapt each guide’s paints to this sculpt. They are palette studies, not universal faction markings or a claim that every faction uses this armour shape. Creator/source and redistribution terms for the supplied model remain unresolved.

## Earlier full-miniature reference

The separate `primaris-space-marine.glb` model has a [shipped attribution and modification notice](../public/models/primaris-space-marine-LICENSE.txt). It identifies **DicamoCM** as creator, links to the [Nexprint listing](https://www.nexprint.com/en/models/G6817715), and records the creator-listed **CC BY 4.0** terms. Preserve that notice and its description of Layer’s conversion, simplification and authored material regions when redistributing that asset.

This is a different model. Its licence and attribution do not apply to the supplied pauldron. Neither asset is presented as an official Games Workshop model or endorsement.

## Painting content, paints and equipment

Guide source links are retained in [guides.ts](../src/lib/guides.ts) and the faction records under [src/data](../src/data). Paint records under [src/data/paints](../src/data/paints) include their manufacturer references, verification dates and swatch provenance. [Equipment records](../src/lib/equipment-products.json) retain manufacturer URLs and checked dates.

Layer’s lesson structure, observation prompts and geometric demonstrations are teaching adaptations. Referenced creators remain the authority for their full methods. Digital swatches are approximate references, not calibrated physical matches, product equivalences or evidence of a painted result. Source links do not imply ownership of the referenced material.

## Illustration assets

[ultramarine-study.png](../public/images/ultramarine-study.png) was generated with an AI image tool on 7 October 2026 and edited to remove chest and belt insignia. It is concept artwork, not a source photograph, an artist’s documented miniature or a demonstrated physical result of the guide.

The earlier JPEG previews under [public/images/techniques](../public/images/techniques) were rendered from code. Current [technique covers](../src/components/TechniqueCover.tsx) and [surface demonstrations](../src/lib/surface-painting-renderer.ts) are code-authored educational illustrations. They do not simulate pigment physics or certify painting outcomes.

import type { EquipmentCategory } from "@/lib/equipment-types";

/** Original category studies, deliberately not illustrations of branded products. */
export function EquipmentArtwork({ category }: { category: EquipmentCategory }) {
  return <svg viewBox="0 0 360 220" aria-hidden="true" focusable="false" className="equipment-artwork">
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {category === "paint" && <>
        <rect x="65" y="53" width="194" height="130" rx="22" fill="#dde2e8" />
        <rect x="73" y="61" width="178" height="114" rx="16" fill="#fafbfc" />
        <path d="M94 109C100 70 142 79 145 106S114 140 101 128Z" fill="#aec1ba" />
        <path d="M147 104C160 78 203 89 201 113S165 139 152 122Z" fill="#c3aec6" />
        <path d="M106 147C113 128 146 137 143 156L111 157Z" fill="#e1c39c" />
        <path d="M229 167L287 35" stroke="#343f4c" strokeWidth="7" />
        <path d="M229 167L241 139" stroke="#abb4bf" strokeWidth="8" />
        <path d="M225 167Q219 177 223 188Q234 181 233 169Z" fill="#a78268" />
      </>}
      {category === "prepare" && <>
        <path d="M83 57L103 157Q109 177 127 177" stroke="#a7b2c0" strokeWidth="14" />
        <path d="M159 56L139 157Q135 177 117 177" stroke="#a7b2c0" strokeWidth="14" />
        <path d="M112 90L92 49L111 56L126 95L143 55L161 49L141 100Z" fill="#f9fafb" stroke="#9ba7b4" strokeWidth="2" />
        <circle cx="126" cy="100" r="7" fill="#6b798a" />
        <path d="M212 174L255 70" stroke="#b6afa8" strokeWidth="16" />
        <path d="M247 83L262 48L275 33L268 65L256 86Z" fill="#fafbfc" stroke="#9ba7b4" strokeWidth="1.5" />
        <path d="M208 153L221 157M211 144L225 149M215 135L228 140" stroke="#d6d1cc" strokeWidth="2" />
      </>}
      {category === "assemble" && <>
        <path d="M96 86L101 69H141L146 86V170Q146 178 138 178H104Q96 178 96 170Z" fill="#d9e1dc" />
        <path d="M106 68L114 29H128L136 68Z" fill="#8fa79a" />
        <rect x="103" y="112" width="36" height="35" rx="3" fill="#f7faf8" />
        <path d="M194 151Q187 122 214 120H260Q279 126 270 151L256 176H206Z" fill="#c6b8aa" />
        <path d="M218 64L281 170" stroke="#a6b0bd" strokeWidth="6" />
        <path d="M211 48Q196 41 204 60L218 73L223 68Z" fill="#f8fafb" stroke="#a6b0bd" strokeWidth="2" />
      </>}
      {category === "workspace" && <>
        <path d="M150 177H252" stroke="#a3adb9" strokeWidth="9" />
        <path d="M204 173L239 90L168 54" stroke="#a3adb9" strokeWidth="9" />
        <circle cx="239" cy="90" r="9" fill="#cbd3dc" />
        <path d="M149 48L111 69Q99 76 105 87L175 53Z" fill="#8e9bad" />
        <path d="M111 86L68 163H205L172 57Z" fill="#f9f8ee" opacity=".8" />
        <path d="M83 179H142L136 136H90Z" fill="#c5b6a7" />
        <path d="M98 147V170M108 147V170M118 147V170" stroke="#eee8df" strokeWidth="3" />
      </>}
      {category === "powered" && <>
        <path d="M93 107H245L282 112L245 120H93Z" fill="#a3aeba" />
        <path d="M92 111L66 106V119L92 115" fill="#d0d7df" />
        <path d="M153 104V75H197V104" fill="#ced6df" />
        <ellipse cx="175" cy="75" rx="22" ry="5" fill="#e9edf1" stroke="#b2bdca" />
        <path d="M201 100V87" stroke="#8796a7" strokeWidth="4" />
        <path d="M201 86H216" stroke="#8796a7" strokeWidth="7" />
        <path d="M166 120V143Q166 181 217 176T297 187" stroke="#7f908c" strokeWidth="8" />
      </>}
      {category === "resin" && <>
        <rect x="109" y="42" width="143" height="139" rx="13" fill="#b6babf" />
        <path d="M109 144V55Q109 42 123 42H238Q252 42 252 55V144Z" fill="#bdb0c5" />
        <path d="M128 57H234V132H128Z" fill="#d9d0df" />
        <path d="M181 62V122" stroke="#9a8fa2" strokeWidth="6" />
        <path d="M150 84H211" stroke="#f4eff7" strokeWidth="7" />
        <path d="M169 89L163 111H196L190 89" fill="#eee9f2" />
        <rect x="163" y="154" width="38" height="14" rx="3" fill="#f3f5f7" />
        <path d="M76 145V119H92V145L100 155V182H68V155Z" fill="#c3cdd5" />
      </>}
    </g>
  </svg>;
}

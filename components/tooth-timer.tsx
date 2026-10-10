const shapes = [
  "M119 48Q180 43 241 48C249 78 244 124 228 151Q218 167 218 189C215 247 204 320 187 374Q180 393 173 374C156 320 145 247 142 189Q142 167 132 151C116 124 111 78 119 48Z",
  "M134 52Q180 43 223 57C237 78 232 125 216 148Q206 162 207 186C211 245 212 309 202 358Q199 381 188 385Q179 383 176 365C166 312 151 247 151 186Q151 161 142 147C129 124 123 78 134 52Z",
  "M180 38C162 59 139 65 124 82C111 103 120 132 138 151Q149 169 146 194C142 256 151 326 171 382Q177 398 185 383C205 337 217 260 214 194Q211 168 224 151C242 132 249 103 237 82C221 65 198 59 180 38Z",
  "M180 64C158 43 135 43 122 61C106 83 114 129 132 151Q146 171 141 200C137 253 121 318 119 370Q120 388 130 376C150 349 168 286 176 244Q180 225 186 245C191 285 208 348 229 375Q241 389 242 370C241 321 226 253 220 200Q214 172 229 151C247 128 254 82 239 61C225 43 202 43 180 64Z",
  "M180 60C158 46 134 45 121 63C107 85 114 128 132 150Q146 169 145 195C146 256 157 320 177 376Q183 393 192 378C215 339 220 280 215 227L214 195Q213 169 227 150C246 128 253 85 239 63C226 45 203 46 180 60Z",
  "M118 57C94 40 76 48 71 70C62 101 74 136 95 153Q109 168 105 192C100 243 85 307 88 371Q90 393 101 376C124 337 139 274 147 224Q151 204 161 220C175 249 169 310 178 355Q183 375 192 356C209 316 207 261 213 224Q218 202 225 225C237 273 244 331 269 375Q280 393 282 370C285 310 270 239 258 190Q252 168 268 152C289 133 300 102 289 70C282 48 263 40 241 57Q220 37 199 55Q180 37 160 56Q139 39 118 57Z",
  "M123 59C100 43 82 51 81 76C77 104 87 135 105 152Q118 168 115 193C109 252 112 313 129 365Q136 384 141 366C146 330 146 281 155 247Q160 232 167 249C178 286 174 323 181 352Q186 371 193 352C204 320 202 280 210 248Q215 234 221 250C226 283 230 326 244 361Q254 380 255 357C259 305 247 247 244 194Q240 169 255 151C274 130 283 101 277 76C274 51 255 43 233 59Q212 43 193 58Q180 44 165 58Q144 44 123 59Z",
] as const;

const rootLines = [
  "M165 179Q162 262 178 344",
  "M173 179Q177 266 190 351",
  "M168 180Q162 277 179 357",
  "M159 182Q157 250 137 335M200 182Q203 252 226 337",
  "M166 180Q164 266 187 351",
  "M123 178Q120 250 103 338M181 172Q189 252 185 323M240 177Q245 253 267 342",
  "M134 177Q129 253 137 334M183 174Q188 247 187 321M228 177Q226 256 244 333",
] as const;

export function randomTooth(current?: number) {
  if (current === undefined) return Math.floor(Math.random() * shapes.length) + 1;
  const candidate = Math.floor(Math.random() * (shapes.length - 1)) + 1;
  return candidate >= current ? candidate + 1 : candidate;
}

export function ToothTimer({ progress, running, resting, variant }: {
  progress: number; running: boolean; resting: boolean; variant: number;
}) {
  const shape = shapes[variant - 1] ?? shapes[0];
  return <svg className={`tooth-illustration ${running ? "is-running" : ""}`} data-tooth={variant}
    viewBox="0 0 360 420" role="img" aria-label={`Зуб № ${variant}, ${resting ? "отдыхает" : "сосредоточен"}`}>
    <defs>
      <clipPath id="tooth-clip"><path d={shape}/></clipPath>
      <linearGradient id="enamel" x1="0" y1="0" x2="1" y2="1"><stop className="enamel-start"/><stop offset="1" className="enamel-end"/></linearGradient>
    </defs>
    <ellipse className="tooth-shadow" cx="180" cy="402" rx="81" ry="6"/>
    <path className="tooth-body" d={shape} strokeWidth="3"/>
    <g clipPath="url(#tooth-clip)">
      <path d="M35 20H325V155Q180 178 35 155Z" fill="url(#enamel)"/>
      <path className="tooth-neck" d="M35 155Q180 178 325 155" fill="none" strokeWidth="1.8"/>
      <path className="tooth-root-lines" d={rootLines[variant - 1] ?? rootLines[0]} fill="none" strokeWidth="2" strokeLinecap="round"/>
      <rect x="35" y={390 - progress * 365} width="290" height="390" fill={resting ? "#c8e8de" : "#f8c6bc"} opacity=".65" className="tooth-fill"/>
      <path d={variant >= 6 ? "M93 104Q84 81 101 71" : "M140 101Q134 83 145 73"} fill="none" stroke="#fff" opacity=".6" strokeWidth="7" strokeLinecap="round"/>
    </g>
    {resting ? <g fill="none" stroke="#345c50" strokeWidth="3" strokeLinecap="round"><path d="M153 110q5 6 10 0"/><path d="M197 110q5 6 10 0"/></g>
      : <g fill="#345c50"><ellipse cx="158" cy="110" rx="3.5" ry="4.5"/><ellipse cx="202" cy="110" rx="3.5" ry="4.5"/></g>}
    <ellipse cx="148" cy="126" rx="7" ry="3.5" fill="#efb1a8" opacity=".55"/><ellipse cx="212" cy="126" rx="7" ry="3.5" fill="#efb1a8" opacity=".55"/>
    <path d="M172 125q8 10 16 0" fill="none" stroke="#345c50" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>;
}

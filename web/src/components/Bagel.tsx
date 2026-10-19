/** @jsxRuntime automatic */
// Bagel, a tri-color beagle drawn as one SVG. Poses change the face and
// props; CSS handles the wagging, ear sway, blinking and sniffing.
type Pose = "happy" | "sniff" | "sleep" | "paper" | "phone" | "proud" | "talk"

const C = {
  line: "#5a3720",
  tan: "#dc8f4a",
  tanShade: "#c4773a",
  ear: "#93552a",
  earShade: "#7a4321",
  white: "#fffaf2",
  saddle: "#3d2b22",
  ink: "#2b1b14",
  blush: "#ff8fa3",
  tongue: "#ff7f95",
}

export function Bagel({
  pose = "happy",
  headlamp = false,
  frisbee = false,
  size = 200,
  className = "",
}: {
  pose?: Pose
  headlamp?: boolean
  frisbee?: boolean
  size?: number
  className?: string
}) {
  const eyes = pose === "sleep" ? "closed" : pose === "proud" ? "happy" : "open"
  const mouth =
    pose === "talk" ? "talk" : pose === "paper" || frisbee ? "none" : pose === "happy" || pose === "proud" ? "tongue" : "smile"
  return (
    <svg
      className={`bagel bagel--${pose} ${className}`}
      viewBox="0 0 240 250"
      width={size}
      height={(size * 250) / 240}
      role="img"
      aria-label="Bagel the beagle"
    >
      <g className="bagel__bob">
        {/* tail */}
        <g className="bagel__tail">
          <path d="M150 206 C 194 206, 218 176, 208 134" fill="none" stroke={C.line} strokeWidth={20} strokeLinecap="round" />
          <path d="M150 206 C 194 206, 218 176, 208 134" fill="none" stroke={C.tan} strokeWidth={14} strokeLinecap="round" />
          <path d="M208 134 C 207 128, 205 124, 203 121" fill="none" stroke={C.line} strokeWidth={20} strokeLinecap="round" />
          <path d="M209 136 C 208 129, 206 125, 203 121" fill="none" stroke={C.white} strokeWidth={14} strokeLinecap="round" />
        </g>

        {/* back legs */}
        <ellipse cx={78} cy={216} rx={19} ry={15} fill={C.tan} stroke={C.line} strokeWidth={3} />
        <ellipse cx={162} cy={216} rx={19} ry={15} fill={C.tan} stroke={C.line} strokeWidth={3} />
        <ellipse cx={72} cy={226} rx={13} ry={8} fill={C.white} stroke={C.line} strokeWidth={3} />
        <ellipse cx={168} cy={226} rx={13} ry={8} fill={C.white} stroke={C.line} strokeWidth={3} />

        {/* body */}
        <path
          d="M74 214 C 66 178, 86 150, 120 150 C 154 150, 174 178, 166 214 C 162 228, 78 228, 74 214 Z"
          fill={C.tan}
          stroke={C.line}
          strokeWidth={3}
        />
        {/* black saddle peeking at the shoulders */}
        <path d="M76 204 C 70 182, 80 161, 101 152 C 92 166, 88 184, 89 204 Z" fill={C.saddle} />
        <path d="M164 204 C 170 182, 160 161, 139 152 C 148 166, 152 184, 151 204 Z" fill={C.saddle} />
        {/* white bib */}
        <path d="M100 160 C 108 156, 132 156, 140 160 C 146 184, 140 214, 120 220 C 100 214, 94 184, 100 160 Z" fill={C.white} />

        {/* front paws */}
        <g>
          <ellipse cx={101} cy={229} rx={15} ry={10} fill={C.white} stroke={C.line} strokeWidth={3} />
          <ellipse cx={139} cy={229} rx={15} ry={10} fill={C.white} stroke={C.line} strokeWidth={3} />
          <path d="M96 232 v-5 M106 232 v-5 M134 232 v-5 M144 232 v-5" stroke={C.line} strokeWidth={2} strokeLinecap="round" opacity={0.55} />
        </g>

        {/* head */}
        <g className="bagel__head">
          <ellipse cx={120} cy={100} rx={62} ry={54} fill={C.tan} stroke={C.line} strokeWidth={3} />
          {/* white blaze + muzzle */}
          <path d="M112 50 C 116 47, 124 47, 128 50 C 131 66, 133 84, 134 100 L 106 100 C 107 84, 109 66, 112 50 Z" fill={C.white} />
          <ellipse cx={120} cy={120} rx={31} ry={24} fill={C.white} />

          {/* ears */}
          <g className="bagel__ear bagel__ear--l">
            <path
              d="M70 72 C 46 78, 36 116, 44 148 C 49 166, 70 166, 77 150 C 85 130, 87 96, 70 72 Z"
              fill={C.ear}
              stroke={C.line}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <path d="M66 86 C 54 100, 50 124, 54 144" stroke={C.earShade} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.6} />
          </g>
          <g className="bagel__ear bagel__ear--r">
            <path
              d="M170 72 C 194 78, 204 116, 196 148 C 191 166, 170 166, 163 150 C 155 130, 153 96, 170 72 Z"
              fill={C.ear}
              stroke={C.line}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <path d="M174 86 C 186 100, 190 124, 186 144" stroke={C.earShade} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.6} />
          </g>

          {/* cheeks */}
          <ellipse cx={86} cy={122} rx={10} ry={6} fill={C.blush} opacity={0.55} />
          <ellipse cx={154} cy={122} rx={10} ry={6} fill={C.blush} opacity={0.55} />

          {/* eyes */}
          <g className="bagel__eyes">
            {eyes === "open" && (
              <>
                <ellipse cx={99} cy={99} rx={9} ry={11} fill={C.ink} />
                <ellipse cx={141} cy={99} rx={9} ry={11} fill={C.ink} />
                <circle cx={96} cy={94} r={3.4} fill="#fff" />
                <circle cx={138} cy={94} r={3.4} fill="#fff" />
                <circle cx={102} cy={104} r={1.6} fill="#fff" opacity={0.9} />
                <circle cx={144} cy={104} r={1.6} fill="#fff" opacity={0.9} />
              </>
            )}
            {eyes === "closed" && (
              <path d="M90 101 Q 99 108 108 101 M132 101 Q 141 108 150 101" stroke={C.ink} strokeWidth={3.4} strokeLinecap="round" fill="none" />
            )}
            {eyes === "happy" && (
              <path d="M90 103 Q 99 92 108 103 M132 103 Q 141 92 150 103" stroke={C.ink} strokeWidth={3.6} strokeLinecap="round" fill="none" />
            )}
          </g>

          {/* nose + mouth */}
          <g className="bagel__nose">
            <path d="M109 112 Q 120 106 131 112 Q 129 123 120 125 Q 111 123 109 112 Z" fill={C.ink} />
            <ellipse cx={115.5} cy={112.5} rx={3.5} ry={1.8} fill="#fff" opacity={0.7} />
          </g>
          {mouth !== "none" && <path d="M120 125 L 120 130" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" />}
          {mouth === "tongue" && <path d="M114 133 Q 120 147 126 133 Z" fill={C.tongue} stroke={C.line} strokeWidth={1.6} />}
          {(mouth === "smile" || mouth === "tongue") && (
            <path d="M110 129 Q 115 135 120 130 Q 125 135 130 129" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          )}
          {mouth === "talk" && <ellipse className="bagel__talk" cx={120} cy={134} rx={6} ry={5} fill="#7a2f3a" stroke={C.ink} strokeWidth={2} />}

          {/* newspaper in mouth */}
          {pose === "paper" && (
            <g className="bagel__paper">
              <rect x={66} y={124} width={108} height={22} rx={11} fill="#f4efe4" stroke={C.line} strokeWidth={3} transform="rotate(-6 120 135)" />
              <path d="M84 128 v18 M156 122 v18" stroke="#c8bfae" strokeWidth={3} transform="rotate(-6 120 135)" />
              <rect x={108} y={124} width={22} height={22} fill="#e2574c" opacity={0.9} transform="rotate(-6 120 135)" />
            </g>
          )}

          {/* frisbee in mouth, for when the work's done */}
          {frisbee && (
            <g className="bagel__frisbee" transform="rotate(-8 120 140)">
              <ellipse cx={120} cy={141} rx={50} ry={14} fill="#ff5a5f" stroke={C.line} strokeWidth={3} />
              <ellipse cx={120} cy={137} rx={34} ry={8} fill="#ff8a80" />
              <ellipse cx={120} cy={136} rx={18} ry={4} fill="none" stroke="#fff3f0" strokeWidth={2} opacity={0.8} />
            </g>
          )}

          {/* headset for calls */}
          {pose === "talk" || pose === "phone" ? (
            <g>
              <path d="M62 96 C 62 40, 178 40, 178 96" fill="none" stroke="#3b3b4a" strokeWidth={7} strokeLinecap="round" />
              <rect x={52} y={86} width={18} height={28} rx={8} fill="#5c6ef8" stroke="#2c2c3a" strokeWidth={3} />
              <rect x={170} y={86} width={18} height={28} rx={8} fill="#5c6ef8" stroke="#2c2c3a" strokeWidth={3} />
              <path d="M178 112 C 176 136, 160 142, 144 140" fill="none" stroke="#3b3b4a" strokeWidth={4} strokeLinecap="round" />
              <circle cx={141} cy={140} r={5} fill="#2c2c3a" />
            </g>
          ) : null}

          {/* headlamp for the night shift */}
          {headlamp && (
            <g className="bagel__lamp">
              <path d="M74 64 C 96 50, 144 50, 166 64" fill="none" stroke="#4b3a6b" strokeWidth={7} strokeLinecap="round" />
              <path className="bagel__beam" d="M120 52 L 70 -10 L 170 -10 Z" fill="url(#beam)" opacity={0.7} />
              <circle cx={120} cy={54} r={11} fill="#ffd166" stroke="#4b3a6b" strokeWidth={3} />
              <circle cx={117} cy={51} r={3} fill="#fff8d6" />
            </g>
          )}
        </g>

        {pose === "sleep" && (
          <g className="bagel__zzz" fill="#cfd5ff" fontFamily="Nunito, sans-serif" fontWeight={800}>
            <text x={178} y={52} fontSize={20}>z</text>
            <text x={192} y={36} fontSize={15}>z</text>
            <text x={203} y={22} fontSize={11}>z</text>
          </g>
        )}
      </g>
      <defs>
        <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff3b0" stopOpacity={0.9} />
          <stop offset="1" stopColor="#fff3b0" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** A single paw print, used for the trail and as a stamp. */
export function Paw({ size = 22, color = "currentColor", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <g fill={color}>
        <ellipse cx={16} cy={21} rx={8} ry={6.5} />
        <ellipse cx={7} cy={13} rx={3.4} ry={4.2} transform="rotate(-20 7 13)" />
        <ellipse cx={12.5} cy={7.5} rx={3.4} ry={4.4} transform="rotate(-8 12.5 7.5)" />
        <ellipse cx={19.5} cy={7.5} rx={3.4} ry={4.4} transform="rotate(8 19.5 7.5)" />
        <ellipse cx={25} cy={13} rx={3.4} ry={4.2} transform="rotate(20 25 13)" />
      </g>
    </svg>
  )
}
